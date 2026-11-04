import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { arrayOf, ref } from './swagger.js';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { checkSlug, pick, requireUser } from './auth.js';
import { Db } from './db.js';

const INPUT = {
  slug: 'string',
  name: 'string',
  description: 'string',
} as const;
const ROW = 'slug, name, description';

const TAG_SCHEMA = {
  type: 'object',
  properties: {
    slug: { type: 'string', example: 'nestjs' },
    name: { type: 'string', example: 'NestJS' },
    description: { type: 'string', nullable: true },
  },
};

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly db: Db) {}

  @Get()
  @ApiOkResponse({ schema: arrayOf('TagWithCount') })
  async list() {
    const { rows } = await this.db.query(
      `select t.slug, t.name, t.description, count(p.id)::int "postCount"
       from tags t
       left join post_tags pt on pt.tag_id = t.id
       left join posts p on p.id = pt.post_id and p.status = 'published'
       group by t.id order by t.name`,
    );
    return rows;
  }

  @Post()
  @ApiCreatedResponse({ schema: ref('Tag') })
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
  @ApiBody({ schema: { ...TAG_SCHEMA, required: ['slug', 'name'] } })
  async create(@Req() req: Request, @Body() body: unknown) {
    await requireUser(this.db, req, 'admin', 'author');
    const f = pick(body, INPUT, ['slug', 'name'], ['slug', 'name']);
    checkSlug(f.slug);
    const { rows } = await this.db.query(
      `insert into tags (slug, name, description) values ($1, $2, $3) returning ${ROW}`,
      [f.slug, f.name, f.description ?? null],
    );
    return rows[0];
  }

  @Patch(':slug')
  @ApiOkResponse({ schema: ref('Tag') })
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
  @ApiBody({ schema: TAG_SCHEMA })
  async update(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    await requireUser(this.db, req, 'admin', 'author');
    const f = pick(body, INPUT, ['slug', 'name']);
    checkSlug(f.slug);
    const { rows } = await this.db.query(
      `update tags set slug = coalesce($2, slug), name = coalesce($3, name),
         description = case when $4 then $5 else description end
       where slug = $1 returning ${ROW}`,
      [slug, f.slug ?? null, f.name ?? null, 'description' in f, f.description],
    );
    if (!rows[0]) throw new NotFoundException();
    return rows[0];
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
    await requireUser(this.db, req, 'admin');
    const { rowCount } = await this.db.query(
      'delete from tags where slug = $1',
      [slug],
    );
    if (!rowCount) throw new NotFoundException();
  }
}
