import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import { ref } from './swagger.js';
import { ApiBody, ApiOkResponse, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { requireUser } from './auth.js';
import { Db } from './db.js';

const ROW = `p.username, p.display_name "displayName", p.avatar_url "avatarUrl", p.bio, p.role,
  p.created_at "createdAt"`;

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly db: Db) {}

  /** 공개 프로필. 글 목록은 GET /posts?author=:username */
  @Get(':username')
  @ApiOkResponse({ schema: ref('PublicProfile') })
  @ApiResponse({ status: 404, description: '없음', schema: ref('Error') })
  async get(@Param('username') username: string) {
    const { rows } = await this.db.query(
      `select ${ROW},
         (select count(*)::int from posts where author_id = p.id and status = 'published') "postCount"
       from profiles p where p.username = $1`,
      [username],
    );
    if (!rows[0]) throw new NotFoundException();
    return rows[0];
  }

  /** 역할 변경 (admin 전용). */
  @Patch(':username/role')
  @ApiOkResponse({ schema: ref('Profile') })
  @ApiResponse({ status: 400, description: '입력 오류', schema: ref('Error') })
  @ApiResponse({
    status: 401,
    description: '로그인 필요',
    schema: ref('Error'),
  })
  @ApiResponse({ status: 403, description: '권한 없음', schema: ref('Error') })
  @ApiResponse({ status: 404, description: '없음', schema: ref('Error') })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['role'],
      properties: {
        role: { type: 'string', enum: ['admin', 'author', 'user'] },
      },
    },
  })
  async setRole(
    @Param('username') username: string,
    @Req() req: Request,
    @Body() body: { role?: unknown },
  ) {
    await requireUser(this.db, req, 'admin');
    if (!['admin', 'author', 'user'].includes(body?.role as string)) {
      throw new BadRequestException('role must be admin, author or user');
    }
    const { rows } = await this.db.query(
      `update profiles p set role = $2 where username = $1 returning ${ROW}`,
      [username, body.role],
    );
    if (!rows[0]) throw new NotFoundException();
    return rows[0];
  }
}
