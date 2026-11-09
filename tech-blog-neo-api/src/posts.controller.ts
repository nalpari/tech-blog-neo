import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { arrayOf, ref } from './swagger.js';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type pg from 'pg';
import { checkSlug, optionalUser, pick, requireUser, User } from './auth.js';
import { Db } from './db.js';

const SUMMARY = `
  p.slug, p.title, p.excerpt, p.status,
  p.cover_image "coverImage", p.cover_gradient "coverGradient",
  p.featured, p.read_time "readTime",
  p.view_count "viewCount", p.like_count "likeCount",
  p.published_at "publishedAt",
  (select json_build_object('username', a.username, 'displayName', a.display_name, 'avatarUrl', a.avatar_url)
     from profiles a where a.id = p.author_id) author,
  coalesce((select json_agg(json_build_object('slug', t.slug, 'name', t.name) order by t.name)
     from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = p.id), '[]') tags`;

// 요청 body 키 → posts 컬럼
const COLUMNS = {
  slug: 'slug',
  title: 'title',
  excerpt: 'excerpt',
  content: 'content',
  coverImage: 'cover_image',
  coverGradient: 'cover_gradient',
  status: 'status',
  featured: 'featured',
  readTime: 'read_time',
  publishedAt: 'published_at',
} as const;

const INPUT = {
  ...Object.fromEntries(Object.keys(COLUMNS).map((k) => [k, 'string'])),
  featured: 'boolean',
  tags: 'string[]',
} as const;

const NON_NULL = ['slug', 'title', 'status'];

const POST_SCHEMA = {
  type: 'object',
  properties: {
    slug: { type: 'string', example: 'my-first-post' },
    title: { type: 'string', example: '제목' },
    excerpt: { type: 'string', nullable: true },
    content: { type: 'string', nullable: true, description: 'markdown' },
    coverImage: { type: 'string', nullable: true },
    coverGradient: { type: 'string', nullable: true },
    status: { type: 'string', enum: ['draft', 'published'] },
    featured: { type: 'boolean' },
    readTime: { type: 'string', nullable: true, example: '5 min read' },
    publishedAt: { type: 'string', format: 'date-time', nullable: true },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: '태그 slug 목록 (통째로 교체)',
    },
  },
};

// GET /posts/mine 이 :slug 보다 먼저 매칭되므로 글 slug 로 쓸 수 없다.
const RESERVED_SLUGS = new Set(['mine']);

/** slug 형식·예약어 확인, featured 는 admin 만 바꿀 수 있다. */
function checkPostInput(f: Record<string, unknown>, user: User) {
  checkSlug(f.slug);
  if (RESERVED_SLUGS.has(f.slug as string))
    throw new BadRequestException(`slug "${f.slug as string}" is reserved`);
  if ('featured' in f && user.role !== 'admin')
    throw new ForbiddenException('only admin can set featured');
}

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly db: Db) {}

  @Get()
  @ApiOkResponse({ schema: ref('PostList') })
  @ApiResponse({ status: 400, description: '입력 오류', schema: ref('Error') })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: '최대 50',
  })
  @ApiQuery({ name: 'tag', required: false, description: '태그 slug' })
  @ApiQuery({ name: 'author', required: false, description: 'username' })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiQuery({ name: 'q', required: false, description: '제목·요약 검색' })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['latest', 'popular'],
    description: 'popular: 조회수 순',
  })
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('tag') tag?: string,
    @Query('author') author?: string,
    @Query('featured', new ParseBoolPipe({ optional: true }))
    featured?: boolean,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
  ) {
    if (sort && sort !== 'latest' && sort !== 'popular')
      throw new BadRequestException('sort must be latest or popular');
    page = Math.max(page, 1);
    limit = Math.min(Math.max(limit, 1), 50);
    const { rows } = await this.db.query(
      `with f as (
         select * from posts p
         where p.status = 'published'
           and ($1::text is null or exists (
                 select 1 from post_tags pt join tags t on t.id = pt.tag_id
                 where pt.post_id = p.id and t.slug = $1))
           and ($2::boolean is null or p.featured = $2)
           and ($3::text is null or p.title ilike '%' || $3 || '%' or p.excerpt ilike '%' || $3 || '%')
           and ($6::text is null or p.author_id = (select id from profiles where username = $6))
       )
       select (select count(*)::int from f) total,
              coalesce((select json_agg(x) from (
                select ${SUMMARY} from f p
                order by case when $7 then p.view_count end desc nulls last,
                         p.sort_date desc, p.id desc
                limit $4 offset $5) x), '[]') items`,
      [
        tag || null,
        featured ?? null,
        q || null,
        limit,
        (page - 1) * limit,
        author || null,
        sort === 'popular',
      ],
    );
    return { ...rows[0], page, limit };
  }

  /** 내가 쓴 글 전체 (draft 포함). */
  @Get('mine')
  @ApiOkResponse({ schema: arrayOf('MyPost') })
  @ApiResponse({
    status: 401,
    description: '로그인 필요',
    schema: ref('Error'),
  })
  async mine(@Req() req: Request) {
    const { id } = await requireUser(this.db, req);
    const { rows } = await this.db.query(
      `select ${SUMMARY}, p.updated_at "updatedAt" from posts p
       where p.author_id = $1 order by p.sort_date desc, p.id desc`,
      [id],
    );
    return rows;
  }

  @Get(':slug')
  @ApiOkResponse({ schema: ref('PostDetail') })
  @ApiResponse({ status: 404, description: '없음', schema: ref('Error') })
  async detail(@Param('slug') slug: string, @Req() req: Request) {
    const post = await this.find(slug, await optionalUser(this.db, req));
    if (!post) throw new NotFoundException();
    return post;
  }

  @Post()
  @ApiCreatedResponse({ schema: ref('PostDetail') })
  @ApiResponse({ status: 400, description: '입력 오류', schema: ref('Error') })
  @ApiResponse({
    status: 401,
    description: '로그인 필요',
    schema: ref('Error'),
  })
  @ApiResponse({ status: 403, description: '권한 없음', schema: ref('Error') })
  @ApiResponse({
    status: 409,
    description: 'slug/username 중복',
    schema: ref('Error'),
  })
  @ApiBody({ schema: { ...POST_SCHEMA, required: ['slug', 'title'] } })
  async create(@Req() req: Request, @Body() body: unknown) {
    const user = await requireUser(this.db, req, 'admin', 'author');
    const f = pick(body, INPUT, NON_NULL, ['slug', 'title']);
    checkPostInput(f, user);
    const cols = Object.keys(COLUMNS).filter((k) => k in f);
    await this.db.tx(async (c) => {
      const { rows } = await c.query(
        `insert into posts (author_id, ${cols.map((k) => COLUMNS[k as keyof typeof COLUMNS]).join(', ')})
         values ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}) returning id`,
        [user.id, ...cols.map((k) => f[k])],
      );
      await this.afterWrite(c, rows[0].id, f.tags);
    });
    return this.find(f.slug, user);
  }

  @Patch(':slug')
  @ApiOkResponse({ schema: ref('PostDetail') })
  @ApiResponse({ status: 400, description: '입력 오류', schema: ref('Error') })
  @ApiResponse({
    status: 401,
    description: '로그인 필요',
    schema: ref('Error'),
  })
  @ApiResponse({ status: 403, description: '권한 없음', schema: ref('Error') })
  @ApiResponse({ status: 404, description: '없음', schema: ref('Error') })
  @ApiResponse({
    status: 409,
    description: 'slug/username 중복',
    schema: ref('Error'),
  })
  @ApiBody({ schema: POST_SCHEMA })
  async update(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    const user = await requireUser(this.db, req, 'admin', 'author');
    const id = await this.ownedPostId(slug, user);
    const f = pick(body, INPUT, NON_NULL);
    checkPostInput(f, user);
    const cols = Object.keys(COLUMNS).filter((k) => k in f);
    await this.db.tx(async (c) => {
      if (cols.length) {
        await c.query(
          `update posts set ${cols.map((k, i) => `${COLUMNS[k as keyof typeof COLUMNS]} = $${i + 2}`).join(', ')}
           where id = $1`,
          [id, ...cols.map((k) => f[k])],
        );
      }
      await this.afterWrite(c, id, f.tags);
    });
    return this.find(f.slug ?? slug, user);
  }

  @Delete(':slug')
  @ApiNoContentResponse()
  @ApiResponse({
    status: 401,
    description: '로그인 필요',
    schema: ref('Error'),
  })
  @ApiResponse({ status: 403, description: '권한 없음', schema: ref('Error') })
  @ApiResponse({ status: 404, description: '없음', schema: ref('Error') })
  @HttpCode(204)
  async remove(@Param('slug') slug: string, @Req() req: Request) {
    const id = await this.ownedPostId(
      slug,
      await requireUser(this.db, req, 'admin', 'author'),
    );
    await this.db.query('delete from posts where id = $1', [id]);
  }

  @Post(':slug/views')
  @ApiOkResponse({ schema: ref('ViewCount') })
  @ApiResponse({ status: 404, description: '없음', schema: ref('Error') })
  @HttpCode(200)
  async view(@Param('slug') slug: string) {
    const { rows } = await this.db.query(
      `select public.increment_post_view_count(slug, null::uuid) "viewCount"
       from posts where slug = $1 and status = 'published'`,
      [slug],
    );
    if (!rows[0]) throw new NotFoundException();
    return rows[0];
  }

  /** 좋아요 토글. { liked, likeCount } */
  @Post(':slug/like')
  @ApiOkResponse({ schema: ref('LikeResult') })
  @ApiResponse({
    status: 401,
    description: '로그인 필요',
    schema: ref('Error'),
  })
  @ApiResponse({ status: 404, description: '없음', schema: ref('Error') })
  @HttpCode(200)
  async like(@Param('slug') slug: string, @Req() req: Request) {
    const { id } = await requireUser(this.db, req);
    const { rows } = await this.db.query(
      `select public.toggle_post_like(slug, $2::uuid) r
       from posts where slug = $1 and status = 'published'`,
      [slug, id],
    );
    if (!rows[0]) throw new NotFoundException();
    return rows[0].r;
  }

  /** published 는 누구나, draft 는 작성자·admin 만. 로그인했으면 liked 포함. */
  private async find(slug: string, user: User | null) {
    const { rows } = await this.db.query(
      `select ${SUMMARY}, p.content, p.updated_at "updatedAt",
              exists (select 1 from post_likes l where l.post_id = p.id and l.user_id = $2) liked
       from posts p
       where p.slug = $1 and (p.status = 'published' or p.author_id = $2 or $3 = 'admin')`,
      [slug, user?.id ?? null, user?.role ?? null],
    );
    return rows[0];
  }

  /** 수정·삭제 권한: 작성자 또는 admin. 볼 수 없는 글은 404. */
  private async ownedPostId(slug: string, user: User): Promise<string> {
    const { rows } = await this.db.query(
      `select id, author_id, status from posts where slug = $1`,
      [slug],
    );
    const p = rows[0];
    const mine = p?.author_id === user.id || user.role === 'admin';
    if (!p || (!mine && p.status !== 'published'))
      throw new NotFoundException();
    if (!mine) throw new ForbiddenException();
    return p.id;
  }

  /** 처음 published 가 되면 published_at 을 채우고, tags 를 주면 통째로 교체한다. */
  private async afterWrite(c: pg.PoolClient, id: string, tags?: string[]) {
    await c.query(
      `update posts set published_at = now()
       where id = $1 and status = 'published' and published_at is null`,
      [id],
    );
    if (!tags) return;
    const slugs = [...new Set(tags)];
    await c.query('delete from post_tags where post_id = $1', [id]);
    const { rowCount } = await c.query(
      'insert into post_tags (post_id, tag_id) select $1, id from tags where slug = any($2)',
      [id, slugs],
    );
    if (rowCount !== slugs.length)
      throw new BadRequestException('unknown tag slug');
  }
}
