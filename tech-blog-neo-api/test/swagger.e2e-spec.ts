import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { buildDocument, SCHEMAS } from './../src/swagger.js';

// Swagger 응답 스키마가 실제 응답과 어긋나지 않는지 확인한다 (로컬 techlog DB 사용).
describe('Swagger 응답 스키마', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = m.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('모든 $ref 가 등록된 스키마를 가리킨다', () => {
    const json = JSON.stringify(buildDocument(app));
    const refs = [...json.matchAll(/#\/components\/schemas\/(\w+)/g)].map(
      (m) => m[1],
    );
    expect(refs.length).toBeGreaterThan(10);
    for (const r of refs) expect(SCHEMAS).toHaveProperty(r);
  });

  const keys = (name: keyof typeof SCHEMAS) =>
    [...(SCHEMAS[name].required ?? [])].sort((a, b) => a.localeCompare(b));

  it('실제 응답 키 = 스키마 키', async () => {
    const http = app.getHttpServer();
    const list = (await request(http).get('/posts?limit=1').expect(200)).body;
    expect(Object.keys(list).sort((a, b) => a.localeCompare(b))).toEqual(
      keys('PostList'),
    );
    const item = list.items[0];
    expect(Object.keys(item).sort((a, b) => a.localeCompare(b))).toEqual(
      keys('PostSummary'),
    );
    expect(Object.keys(item.author).sort((a, b) => a.localeCompare(b))).toEqual(
      keys('Author'),
    );

    const detail = (await request(http).get(`/posts/${item.slug}`)).body;
    expect(Object.keys(detail).sort((a, b) => a.localeCompare(b))).toEqual(
      keys('PostDetail'),
    );

    const tags = (await request(http).get('/tags')).body;
    expect(Object.keys(tags[0]).sort((a, b) => a.localeCompare(b))).toEqual(
      keys('TagWithCount'),
    );

    const profile = (
      await request(http).get(`/profiles/${item.author.username}`)
    ).body;
    expect(Object.keys(profile).sort((a, b) => a.localeCompare(b))).toEqual(
      keys('PublicProfile'),
    );

    const err = (await request(http).get('/posts/__nope__').expect(404)).body;
    for (const k of keys('Error')) expect(err).toHaveProperty(k);
  });
});
