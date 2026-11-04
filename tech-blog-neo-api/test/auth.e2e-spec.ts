import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { signSession, verifySession } from './../src/auth.js';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const realFetch = globalThis.fetch;

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    const m = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = m.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    globalThis.fetch = realFetch;
    await app.close();
  });

  it('세션 토큰 서명/검증', () => {
    const t = signSession('abc');
    expect(verifySession(t)).toBe('abc');
    expect(verifySession(t.slice(0, -2) + 'xx')).toBeNull();
    expect(verifySession(signSession('abc', -1))).toBeNull();
    expect(verifySession(undefined)).toBeNull();
  });

  it('로그인 흐름: state 검증 → 기존 사용자 세션 발급 → /auth/me → logout', async () => {
    const http = app.getHttpServer();
    const start = await request(http).get('/auth/google').expect(302);
    expect(start.headers.location).toContain('accounts.google.com');
    const state = new URL(start.headers.location).searchParams.get('state')!;
    const stateCookie = `oauth_state=${state}`;

    await request(http)
      .get(`/auth/google/callback?code=c&state=${state}`)
      .expect(401); // 쿠키 없음
    await request(http)
      .get('/auth/google/callback?code=c&state=bad')
      .set('Cookie', stateCookie)
      .expect(401);

    const idToken = (claims: object) => `x.${b64(claims)}.x`;
    const good = {
      aud: 'test-client',
      iss: 'https://accounts.google.com',
      email_verified: true,
      email: 'yoo32767@gmail.com',
    };

    globalThis.fetch = (async () =>
      Response.json({
        id_token: idToken({ ...good, aud: 'other' }),
      })) as typeof fetch;
    await request(http)
      .get(`/auth/google/callback?code=c&state=${state}`)
      .set('Cookie', stateCookie)
      .expect(401);

    globalThis.fetch = (async () =>
      Response.json({ id_token: idToken(good) })) as typeof fetch;
    const cb = await request(http)
      .get(`/auth/google/callback?code=c&state=${state}`)
      .set('Cookie', stateCookie)
      .expect(302);
    const session = ([] as string[])
      .concat(cb.headers['set-cookie'])
      .find((c) => c.startsWith('session='))!;
    expect(session).toContain('HttpOnly');

    const me = await request(http)
      .get('/auth/me')
      .set('Cookie', session.split(';')[0])
      .expect(200);
    expect(me.body).toMatchObject({
      email: 'yoo32767@gmail.com',
      username: 'yoo32767',
      role: 'admin',
    });

    await request(http).get('/auth/me').expect(401);
    await request(http).post('/auth/logout').expect(204);
  });
});
