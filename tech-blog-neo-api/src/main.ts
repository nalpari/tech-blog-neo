import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module.js';
import { buildDocument } from './swagger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  // 세션 쿠키를 프론트에서 credentials: 'include' 로 보내기 위해 필요
  app.enableCors({ origin: process.env.FRONT_URL, credentials: true });
  // Swagger UI: /docs. 로그인은 같은 브라우저에서 /auth/google 을 먼저 열면 세션 쿠키가 붙는다.
  SwaggerModule.setup('docs', app, buildDocument(app));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
