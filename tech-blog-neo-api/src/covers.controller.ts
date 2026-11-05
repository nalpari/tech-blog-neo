import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import type { Request } from 'express';
import { requireUser } from './auth.js';
import { Db } from './db.js';

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

@ApiTags('covers')
@Controller('covers')
export class CoversController {
  // 리전·키는 AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY 에서 SDK 가 읽는다.
  private readonly s3 = new S3Client({});

  constructor(private readonly db: Db) {}

  /** 버킷(공개 읽기)의 커버 폴더에 있는 이미지 URL 목록. 글을 쓸 수 있는 사람만 본다. */
  @Get()
  @ApiOkResponse({ schema: { type: 'array', items: { type: 'string' } } })
  async list(@Req() req: Request) {
    await requireUser(this.db, req, 'admin', 'author');
    const bucket = process.env.S3_BUCKET!;
    // ponytail: 한 번에 최대 1000개. 커버가 그보다 많아지면 ContinuationToken 으로 이어 받는다.
    const res = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: process.env.S3_COVER_PREFIX ?? '',
      }),
    );
    const base = `https://${bucket}.s3.${await this.s3.config.region()}.amazonaws.com/`;
    return (res.Contents ?? [])
      .flatMap((o) => (o.Key && IMAGE_RE.test(o.Key) ? [o.Key] : []))
      .map((k) => base + k.split('/').map(encodeURIComponent).join('/'));
  }
}
