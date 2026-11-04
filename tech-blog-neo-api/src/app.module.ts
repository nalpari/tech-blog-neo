import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { AuthController } from './auth.controller.js';
import { Db, DbErrorFilter } from './db.js';
import { PostsController } from './posts.controller.js';
import { ProfilesController } from './profiles.controller.js';
import { TagsController } from './tags.controller.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com,
    // then run `npx @nestjs/observe link` to write your key pair into .env.
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'tech-blog-neo-api',
    }),
  ],
  controllers: [
    AuthController,
    PostsController,
    ProfilesController,
    TagsController,
  ],
  providers: [Db, { provide: APP_FILTER, useClass: DbErrorFilter }],
})
export class AppModule {}
