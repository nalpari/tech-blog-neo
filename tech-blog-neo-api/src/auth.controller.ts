import {
  Controller,
  Body,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  Req,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { ref } from './swagger.js';
import {
  ApiBody,
  ApiExcludeEndpoint,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  pick,
  readCookie,
  requireUser,
  SESSION,
  SESSION_TTL,
  signSession,
} from './auth.js';
import { Db } from './db.js';

const STATE = 'oauth_state';
const NEXT = 'oauth_next';
// 로그인 뒤 돌아갈 프론트 경로. 같은 사이트 안의 절대 경로만 받는다.
const safeNext = (next?: string) =>
  next && /^\/(?![/\\])/.test(next) ? next : undefined;

const cookieOpts = (maxAgeSec: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: maxAgeSec * 1000,
});

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly db: Db) {}

  @Get('google')
  @ApiResponse({
    status: 302,
    description:
      'Google 로그인 화면으로 이동. 끝나면 FRONT_URL(+next 경로)로 돌아온다',
  })
  @ApiQuery({ name: 'next', required: false, example: '/posts/my-post' })
  google(@Res() res: Response, @Query('next') next?: string) {
    const state = randomBytes(16).toString('hex');
    res.cookie(STATE, state, cookieOpts(600));
    const back = safeNext(next);
    if (back) res.cookie(NEXT, back, cookieOpts(600));
    else res.clearCookie(NEXT, { path: '/' });
    const q = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
  }

  @Get('google/callback')
  @ApiExcludeEndpoint() // Google 이 리다이렉트로만 호출
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.clearCookie(STATE, { path: '/' });
    res.clearCookie(NEXT, { path: '/' });
    if (!code || !state || state !== readCookie(req, STATE)) {
      throw new UnauthorizedException('invalid oauth state');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok)
      throw new UnauthorizedException('google token exchange failed');
    const { id_token } = (await tokenRes.json()) as { id_token: string };

    // id_token 은 TLS 로 Google 토큰 엔드포인트에서 직접 받았으므로 서명 검증 없이
    // 클레임만 확인한다 (OpenID Connect Core 3.1.3.7).
    const claims = JSON.parse(
      Buffer.from(id_token.split('.')[1], 'base64url').toString(),
    );
    if (
      claims.aud !== process.env.GOOGLE_CLIENT_ID ||
      !['accounts.google.com', 'https://accounts.google.com'].includes(
        claims.iss,
      ) ||
      !claims.email_verified
    ) {
      throw new UnauthorizedException('invalid google id token');
    }

    const userId = await this.findOrCreateUser(
      claims.email,
      claims.name,
      claims.picture,
    );
    res.cookie(SESSION, signSession(userId), cookieOpts(SESSION_TTL));
    const front = (process.env.FRONT_URL ?? '').replace(/\/$/, '');
    res.redirect(front + (safeNext(readCookie(req, NEXT)) ?? '/'));
  }

  @Get('me')
  @ApiOkResponse({ schema: ref('Me') })
  @ApiResponse({
    status: 401,
    description: '로그인 필요',
    schema: ref('Error'),
  })
  async me(@Req() req: Request) {
    const { id } = await requireUser(this.db, req);
    return this.profile(id);
  }

  /** 내 프로필 수정. role 은 PATCH /profiles/:username/role (admin) 으로만 바꾼다. */
  @Patch('me')
  @ApiOkResponse({ schema: ref('Me') })
  @ApiResponse({ status: 400, description: '입력 오류', schema: ref('Error') })
  @ApiResponse({
    status: 401,
    description: '로그인 필요',
    schema: ref('Error'),
  })
  @ApiResponse({
    status: 409,
    description: 'slug/username 중복',
    schema: ref('Error'),
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        displayName: { type: 'string', nullable: true },
        avatarUrl: { type: 'string', nullable: true },
        bio: { type: 'string', nullable: true },
      },
    },
  })
  async updateMe(@Req() req: Request, @Body() body: unknown) {
    const { id } = await requireUser(this.db, req);
    const f = pick(
      body,
      {
        username: 'string',
        displayName: 'string',
        avatarUrl: 'string',
        bio: 'string',
      },
      ['username'],
    );
    if (f.username !== undefined && !/^[a-z0-9._-]+$/.test(f.username)) {
      throw new BadRequestException(
        'username must be lowercase letters, digits, ".", "_" or "-"',
      );
    }
    await this.db.query(
      `update profiles set
         username = coalesce($2, username),
         display_name = case when $3 then $4 else display_name end,
         avatar_url = case when $5 then $6 else avatar_url end,
         bio = case when $7 then $8 else bio end
       where id = $1`,
      [
        id,
        f.username ?? null,
        'displayName' in f,
        f.displayName,
        'avatarUrl' in f,
        f.avatarUrl,
        'bio' in f,
        f.bio,
      ],
    );
    return this.profile(id);
  }

  private async profile(id: string) {
    const { rows } = await this.db.query(
      `select p.id, u.email, p.username, p.display_name "displayName",
              p.avatar_url "avatarUrl", p.bio, p.role
       from profiles p join auth.users u on u.id = p.id where p.id = $1`,
      [id],
    );
    return rows[0];
  }

  @Post('logout')
  @ApiNoContentResponse()
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION, { path: '/' });
  }

  /** 기존 사용자는 email 로 찾는다 (auth.users 에 Google sub 가 없음). */
  private async findOrCreateUser(
    email: string,
    name?: string,
    picture?: string,
  ) {
    const found = await this.db.query(
      'select id from auth.users where email = $1',
      [email],
    );
    if (found.rows[0]) return found.rows[0].id as string;

    // profiles 행은 handle_new_user 트리거가 raw_user_meta_data 로 만든다.
    // username 은 email 앞부분, 이미 있으면 id 앞 6자리를 붙인다.
    const id = randomUUID();
    const base = email.split('@')[0];
    await this.db.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, $2, jsonb_build_object(
         'username', case when exists (select 1 from profiles where username = $3)
                          then $3 || '-' || left($1::text, 6) else $3 end,
         'display_name', coalesce($4, $3),
         'avatar_url', $5::text))`,
      [id, email, base, name ?? null, picture ?? null],
    );
    return id;
  }
}
