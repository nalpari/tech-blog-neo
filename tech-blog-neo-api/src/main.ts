import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module.js';
import { buildDocument } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
  });
  // 기본 100kb 로는 긴 마크다운 본문을 저장하지 못한다 (nginx 는 30M 까지 받음).
  app.useBodyParser('json', { limit: '10mb' });
  // 세션 쿠키를 프론트에서 credentials: 'include' 로 보내기 위해 필요
  app.enableCors({ origin: process.env.FRONT_URL, credentials: true });
  // Swagger UI: /docs. 로그인은 같은 브라우저에서 /auth/google 을 먼저 열면 세션 쿠키가 붙는다.
  SwaggerModule.setup('docs', app, buildDocument(app));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
