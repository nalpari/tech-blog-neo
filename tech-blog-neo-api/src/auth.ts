import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { Db } from './db.js';

export const SESSION = 'session';
export const SESSION_TTL = 7 * 24 * 3600; // 초

export type Role = 'admin' | 'author' | 'user';
export type User = { id: string; role: Role };

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');
const hmac = (data: string) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return createHmac('sha256', process.env.JWT_SECRET)
    .update(data)
    .digest('base64url');
};

/** HS256 JWT. 세션 쿠키 값으로 쓴다. */
export function signSession(sub: string, ttl = SESSION_TTL) {
  const body = `${b64('{"alg":"HS256","typ":"JWT"}')}.${b64(
    JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + ttl }),
  )}`;
  return `${body}.${hmac(body)}`;
}

/** 서명·만료가 유효하면 sub(사용자 id), 아니면 null. */
export function verifySession(token: string | undefined): string | null {
  const [h, p, sig] = token?.split('.') ?? [];
  if (!sig) return null;
  const expected = Buffer.from(hmac(`${h}.${p}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;
  const { sub, exp } = JSON.parse(Buffer.from(p, 'base64url').toString());
  return exp > Date.now() / 1000 ? sub : null;
}

export function readCookie(req: Request, name: string) {
  for (const part of req.headers.cookie?.split(';') ?? []) {
    const [k, ...v] = part.trim().split('=');
    if (k !== name) continue;
    try {
      return decodeURIComponent(v.join('='));
    } catch {
      return undefined; // 깨진 쿠키는 없는 것으로 본다 (공개 조회가 500 나지 않도록)
    }
  }
}

/** 세션이 있으면 사용자(역할 포함), 없거나 무효면 null. */
export async function optionalUser(db: Db, req: Request): Promise<User | null> {
  const id = verifySession(readCookie(req, SESSION));
  if (!id) return null;
  const { rows } = await db.query(
    'select id, role from profiles where id = $1',
    [id],
  );
  return rows[0] ?? null;
}

/** 로그인 필수. roles 를 주면 그 역할만 허용. */
export async function requireUser(
  db: Db,
  req: Request,
  ...roles: Role[]
): Promise<User> {
  const user = await optionalUser(db, req);
  if (!user) throw new UnauthorizedException();
  if (roles.length && !roles.includes(user.role))
    throw new ForbiddenException();
  return user;
}

type Kind = 'string' | 'boolean' | 'string[]';

/**
 * body 에서 spec 에 있는 키만 골라 타입을 확인한다.
 * nonNull 키는 null/빈 문자열 불가, required 키는 반드시 있어야 한다. 나머지 string 은 null 허용.
 */
export function pick(
  body: unknown,
  spec: Record<string, Kind>,
  nonNull: string[] = [],
  required: string[] = [],
) {
  if (typeof body !== 'object' || body === null)
    throw new BadRequestException('body must be an object');
  const out: Record<string, any> = {};
  for (const [k, kind] of Object.entries(spec)) {
    const v = (body as Record<string, unknown>)[k];
    const strict = nonNull.includes(k);
    if (v === undefined) {
      if (required.includes(k))
        throw new BadRequestException(`${k} is required`);
      continue;
    }
    const ok =
      v === null
        ? !strict && kind === 'string'
        : kind === 'string[]'
          ? Array.isArray(v) && v.every((x) => typeof x === 'string')
          : typeof v === kind &&
            !(strict && kind === 'string' && !(v as string).trim());
    if (!ok)
      throw new BadRequestException(
        `${k} must be ${strict ? 'non-empty ' : ''}${kind}`,
      );
    out[k] = typeof v === 'string' && strict ? v.trim() : v;
  }
  return out;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export function checkSlug(slug: unknown) {
  if (slug !== undefined && !SLUG.test(slug as string)) {
    throw new BadRequestException(
      'slug must be lowercase letters, digits and hyphens',
    );
  }
}
