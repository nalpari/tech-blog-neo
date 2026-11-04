import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import pg from 'pg';

@Injectable()
export class Db extends pg.Pool implements OnModuleDestroy {
  constructor() {
    super({ connectionString: process.env.DATABASE_URL });
  }

  /** 하나의 커넥션에서 begin/commit, 예외 시 rollback. */
  async tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await this.connect();
    try {
      await c.query('begin');
      const result = await fn(c);
      await c.query('commit');
      return result;
    } catch (e) {
      await c.query('rollback');
      throw e;
    } finally {
      c.release();
    }
  }

  onModuleDestroy() {
    return this.end();
  }
}

// 제약 위반 등 클라이언트 입력 때문에 난 DB 에러를 4xx 로 바꾼다. 나머지는 기본 처리(500).
const BAD_INPUT = new Set([
  '23502',
  '23503',
  '23514',
  '22P02',
  '22007',
  '22008',
]);

@Catch(pg.DatabaseError)
export class DbErrorFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  catch(e: pg.DatabaseError, host: ArgumentsHost) {
    if (e.code === '23505')
      return super.catch(
        new ConflictException(`${e.constraint} already exists`),
        host,
      );
    if (BAD_INPUT.has(e.code!))
      return super.catch(new BadRequestException(e.message), host);
    return super.catch(e, host);
  }
}
