import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

// 로컬 techlog DB 데이터를 그대로 읽는다.
describe('Posts / Tags (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = m.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /posts 페이지네이션 + 필터', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/posts?limit=3')
      .expect(200);
    expect(body.items).toHaveLength(3);
    expect(body.total).toBeGreaterThan(3);
    expect(body.items[0]).toHaveProperty('author.username');
    expect(body.items[0]).not.toHaveProperty('content');

    const tag = body.items.find((p: any) => p.tags.length)?.tags[0].slug;
    const byTag = await request(app.getHttpServer())
      .get(`/posts?tag=${tag}&limit=50`)
      .expect(200);
    expect(byTag.body.total).toBeLessThanOrEqual(body.total);
    for (const p of byTag.body.items)
      expect(p.tags.map((t: any) => t.slug)).toContain(tag);

    await request(app.getHttpServer()).get('/posts?featured=abc').expect(400);
    await request(app.getHttpServer()).get('/posts?sort=abc').expect(400);

    const popular = await request(app.getHttpServer())
      .get('/posts?sort=popular&limit=10')
      .expect(200);
    const views = popular.body.items.map((p: any) => p.viewCount);
    expect(views).toEqual([...views].sort((a, b) => b - a));

    // 빈 값으로 온 필터는 무시한다 (Swagger UI / 폼에서 tag= 처럼 보내는 경우)
    const empty = await request(app.getHttpServer())
      .get('/posts?limit=3&tag=&author=&q=')
      .expect(200);
    expect(empty.body.total).toBe(body.total);
  });

  it('GET /posts/:slug, POST /posts/:slug/views', async () => {
    const { body: list } = await request(app.getHttpServer()).get(
      '/posts?limit=1',
    );
    const slug = list.items[0].slug;
    const { body } = await request(app.getHttpServer())
      .get(`/posts/${slug}`)
      .expect(200);
    expect(body.content).toBeTruthy();

    const { body: v } = await request(app.getHttpServer())
      .post(`/posts/${slug}/views`)
      .expect(200);
    expect(v.viewCount).toBe(body.viewCount + 1);

    await request(app.getHttpServer()).get('/posts/__nope__').expect(404);
    await request(app.getHttpServer())
      .post('/posts/__nope__/views')
      .expect(404);
  });

  it('공개 조회는 깨진 세션 쿠키가 있어도 200', async () => {
    const http = app.getHttpServer();
    const { body } = await request(http).get('/posts?limit=1');
    for (const cookie of [
      'session=a.b.c%',
      'session=abc.def.ghi',
      'session=',
    ]) {
      for (const u of ['/posts', `/posts/${body.items[0].slug}`, '/tags']) {
        await request(http).get(u).set('Cookie', cookie).expect(200);
      }
      await request(http).get('/posts/mine').set('Cookie', cookie).expect(401);
    }
  });

  it('GET /tags', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/tags')
      .expect(200);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('postCount');
  });
});
