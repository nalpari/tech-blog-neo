import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { signSession } from './../src/auth.js';
import { Db } from './../src/db.js';

// 로컬 techlog DB 에 실제로 쓰고, 끝나면 만든 데이터를 지우고 바꾼 값을 되돌린다.
describe('글/태그/좋아요/프로필 쓰기 (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  const run = Date.now().toString(36);
  const postSlug = `e2e-post-${run}`;
  const tagSlug = `e2e-tag-${run}`;
  let admin: string, user: string, userName: string, userBio: string | null;

  const as = (cookie: string | null) => {
    const http = app.getHttpServer();
    const wrap = (r: request.Test) =>
      cookie ? r.set('Cookie', `session=${cookie}`) : r;
    return {
      get: (u: string) => wrap(request(http).get(u)),
      post: (u: string, b?: object) => wrap(request(http).post(u)).send(b),
      patch: (u: string, b?: object) => wrap(request(http).patch(u)).send(b),
      del: (u: string) => wrap(request(http).delete(u)),
    };
  };

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = m.createNestApplication();
    await app.init();
    db = app.get(Db);
    const a = await db.query(
      `select id from profiles where role = 'admin' limit 1`,
    );
    const u = await db.query(
      `select id, username, bio from profiles where role = 'user' limit 1`,
    );
    admin = signSession(a.rows[0].id);
    user = signSession(u.rows[0].id);
    userName = u.rows[0].username;
    userBio = u.rows[0].bio;
  });

  afterAll(async () => {
    await db.query('delete from posts where slug like $1', [
      `e2e-post-${run}%`,
    ]);
    await db.query('delete from tags where slug like $1', [`e2e-tag-${run}%`]);
    await db.query(
      `update profiles set role = 'user', bio = $2 where username = $1`,
      [userName, userBio],
    );
    await app.close();
  });

  it('권한: 비로그인 401, 일반 사용자 403', async () => {
    await as(null).post('/posts', { slug: postSlug, title: 't' }).expect(401);
    await as(user).post('/posts', { slug: postSlug, title: 't' }).expect(403);
    await as(user).post('/tags', { slug: tagSlug, name: 'x' }).expect(403);
    await as(user)
      .patch(`/profiles/${userName}/role`, { role: 'admin' })
      .expect(403);
  });

  it('태그 생성/수정, 입력 검증', async () => {
    await as(admin).post('/tags', { slug: 'Bad Slug', name: 'x' }).expect(400);
    await as(admin).post('/tags', { name: 'x' }).expect(400);
    await as(admin).post('/tags', { slug: tagSlug, name: 'E2E' }).expect(201);
    await as(admin).post('/tags', { slug: tagSlug, name: 'dup' }).expect(409);
    const { body } = await as(admin)
      .patch(`/tags/${tagSlug}`, { description: 'd' })
      .expect(200);
    expect(body).toEqual({ slug: tagSlug, name: 'E2E', description: 'd' });
  });

  it('글 작성(draft) → 비공개 → 발행 → 수정 → 삭제', async () => {
    const { body: created } = await as(admin)
      .post('/posts', {
        slug: postSlug,
        title: 'E2E',
        content: '# hi',
        status: 'draft',
        tags: [tagSlug],
      })
      .expect(201);
    expect(created).toMatchObject({
      status: 'draft',
      publishedAt: null,
      tags: [{ slug: tagSlug }],
    });

    await as(null).get(`/posts/${postSlug}`).expect(404);
    await as(user).patch(`/posts/${postSlug}`, { title: 'x' }).expect(403); // user 역할은 글 수정 불가
    expect(
      (await as(admin).get('/posts/mine').expect(200)).body.map(
        (p: any) => p.slug,
      ),
    ).toContain(postSlug);

    await as(admin)
      .post('/posts', { slug: postSlug, title: 'dup' })
      .expect(409);
    await as(admin)
      .patch(`/posts/${postSlug}`, { tags: ['no-such-tag'] })
      .expect(400);
    await as(admin).patch(`/posts/${postSlug}`, { status: 'nope' }).expect(400);
    await as(admin).patch(`/posts/${postSlug}`, { title: null }).expect(400);

    const { body: pub } = await as(admin)
      .patch(`/posts/${postSlug}`, {
        status: 'published',
        excerpt: 'ex',
        tags: [],
      })
      .expect(200);
    expect(pub).toMatchObject({ status: 'published', excerpt: 'ex', tags: [] });
    expect(pub.publishedAt).toBeTruthy();
    expect(pub.tags[0]).toBeUndefined();

    await as(null).get(`/posts/${postSlug}`).expect(200);
    await as(user).patch(`/posts/${postSlug}`, { title: 'x' }).expect(403);
    await as(user).del(`/posts/${postSlug}`).expect(403);

    // 좋아요 토글
    const l1 = await as(user).post(`/posts/${postSlug}/like`).expect(200);
    expect(l1.body).toEqual({ liked: true, likeCount: 1 });
    expect((await as(user).get(`/posts/${postSlug}`)).body.liked).toBe(true);
    const l2 = await as(user).post(`/posts/${postSlug}/like`).expect(200);
    expect(l2.body).toEqual({ liked: false, likeCount: 0 });
    await as(null).post(`/posts/${postSlug}/like`).expect(401);

    await as(admin).del(`/posts/${postSlug}`).expect(204);
    await as(admin).get(`/posts/${postSlug}`).expect(404);
  });

  it('역할 변경 후 author 는 자기 글만 관리', async () => {
    await as(admin)
      .patch(`/profiles/${userName}/role`, { role: 'boss' })
      .expect(400);
    await as(admin)
      .patch(`/profiles/${userName}/role`, { role: 'author' })
      .expect(200);
    const slug = `${postSlug}-author`;
    await as(user).post('/posts', { slug, title: 'mine' }).expect(201);
    await as(user).patch(`/posts/${slug}`, { title: 'mine2' }).expect(200);
    await as(user).del(`/tags/${tagSlug}`).expect(403); // 태그 삭제는 admin 만
    // featured 는 admin 만, 'mine' 은 GET /posts/mine 과 겹쳐서 예약어
    await as(user).patch(`/posts/${slug}`, { featured: true }).expect(403);
    await as(user)
      .post('/posts', { slug: `${slug}-f`, title: 'f', featured: true })
      .expect(403);
    await as(user).post('/posts', { slug: 'mine', title: 'x' }).expect(400);
    // user 로 강등되면 자기 글도 못 고친다
    await as(admin)
      .patch(`/profiles/${userName}/role`, { role: 'user' })
      .expect(200);
    await as(user).patch(`/posts/${slug}`, { title: 'x' }).expect(403);
    await as(user).del(`/posts/${slug}`).expect(403);
    await as(admin)
      .patch(`/profiles/${userName}/role`, { role: 'author' })
      .expect(200);
    await as(user).del(`/posts/${slug}`).expect(204);
    await as(admin).del(`/tags/${tagSlug}`).expect(204);
  });

  it('내 프로필 수정, 공개 프로필', async () => {
    const { body } = await as(user)
      .patch('/auth/me', { bio: 'e2e bio', role: 'admin' })
      .expect(200);
    expect(body).toMatchObject({ bio: 'e2e bio', role: 'author' }); // role 은 무시됨
    await as(user).patch('/auth/me', { username: 'Has Space' }).expect(400);
    const { body: p } = await as(null).get(`/profiles/${userName}`).expect(200);
    expect(p).toMatchObject({ username: userName, bio: 'e2e bio' });
    expect(p).not.toHaveProperty('email');
    await as(null).get('/profiles/__nope__').expect(404);
  });
});
