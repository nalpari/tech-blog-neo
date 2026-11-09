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
    // 쉬고 있는 커넥션의 오류(DB 재시작 등)는 풀이 그 커넥션을 버리고 끝난다.
    // 리스너가 없으면 'error' 이벤트가 처리되지 않은 예외가 되어 프로세스가 죽는다.
    this.on('error', (e) => console.error('pg pool idle client error', e));
  }

  /** 하나의 커넥션에서 begin/commit, 예외 시 rollback. */
  async tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await this.connect();
    let broken: Error | undefined;
    try {
      await c.query('begin');
      const result = await fn(c);
      await c.query('commit');
      return result;
    } catch (e) {
      // rollback 이 실패하면 커넥션이 깨진 것이다. 원래 예외를 살리고 커넥션은 버린다.
      await c.query('rollback').catch((err: Error) => (broken = err));
      throw e;
    } finally {
      c.release(broken);
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
