import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';

type SchemaObject = NonNullable<OpenAPIObject['components']>['schemas'] extends
  Record<string, infer S> | undefined
  ? Extract<S, { type?: unknown }>
  : never;

// 응답 스키마. components.schemas 에 등록하고 컨트롤러에서 ref() 로 가리킨다.
// SQL 의 select 목록이 바뀌면 같이 고친다 (test/swagger.e2e-spec.ts 가 실제 응답과 비교).
const str = { type: 'string' } as const;
const strN = { type: 'string', nullable: true } as const;
const int = { type: 'integer' } as const;
const time = { type: 'string', format: 'date-time' } as const;
const role = { type: 'string', enum: ['admin', 'author', 'user'] } as const;

export const ref = (name: string) => ({
  $ref: `#/components/schemas/${name}`,
});
export const arrayOf = (name: string) => ({
  type: 'array',
  items: ref(name),
});

const POST_SUMMARY = {
  slug: str,
  title: str,
  excerpt: strN,
  status: { type: 'string', enum: ['draft', 'published'] },
  coverImage: strN,
  coverGradient: strN,
  featured: { type: 'boolean' },
  readTime: { ...strN, example: '5 min read' },
  viewCount: int,
  likeCount: int,
  publishedAt: { ...time, nullable: true },
  author: ref('Author'),
  tags: arrayOf('TagRef'),
};

const PROFILE = {
  username: str,
  displayName: strN,
  avatarUrl: strN,
  bio: strN,
  role,
  createdAt: time,
};

const obj = (properties: Record<string, object>): SchemaObject => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
});

export const SCHEMAS = {
  Author: obj({ username: str, displayName: strN, avatarUrl: strN }),
  TagRef: obj({ slug: str, name: str }),
  PostSummary: obj(POST_SUMMARY),
  MyPost: obj({ ...POST_SUMMARY, updatedAt: time }),
  PostDetail: obj({
    ...POST_SUMMARY,
    content: { ...strN, description: 'markdown' },
    updatedAt: time,
    liked: {
      type: 'boolean',
      description: '로그인한 사용자가 좋아요를 눌렀는지. 비로그인이면 false',
    },
  }),
  PostList: obj({
    total: int,
    page: int,
    limit: int,
    items: arrayOf('PostSummary'),
  }),
  ViewCount: obj({ viewCount: int }),
  LikeResult: obj({ liked: { type: 'boolean' }, likeCount: int }),
  Tag: obj({ slug: str, name: str, description: strN }),
  TagWithCount: obj({
    slug: str,
    name: str,
    description: strN,
    postCount: int,
  }),
  Me: obj({
    id: { type: 'string', format: 'uuid' },
    email: str,
    username: str,
    displayName: strN,
    avatarUrl: strN,
    bio: strN,
    role,
  }),
  Profile: obj(PROFILE),
  PublicProfile: obj({ ...PROFILE, postCount: int }),
  Error: obj({ statusCode: int, message: str }),
} satisfies Record<string, SchemaObject>;

export function buildDocument(app: INestApplication) {
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Tech Blog API').build(),
  );
  doc.components = {
    ...doc.components,
    schemas: { ...doc.components?.schemas, ...SCHEMAS },
  };
  return doc;
}
