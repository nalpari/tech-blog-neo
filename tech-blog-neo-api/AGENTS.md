# AGENTS.md

## API map and conventions

- `src/main.ts` configures credentialed CORS using `FRONT_URL`, serves Swagger at `/docs`, and defaults to port 3000.
- `src/app.module.ts` registers the flat controllers; `src/auth.ts` contains session, authorization and input helpers; `src/db.ts` owns the PostgreSQL pool, transactions and database error mapping.
- Controllers use parameterized SQL directly. Local TypeScript imports use `.js` specifiers under NodeNext; keep OpenAPI schemas in `src/swagger.ts` and controller decorators in sync with responses.
- `db/001_auth_users_meta.sql` is a database migration; inspect its assumptions before applying it.

## Commands and tests

Run from this directory: `pnpm install`, `pnpm start:dev`, `pnpm build`, `pnpm lint`, and `pnpm test:e2e`. Start scripts load `.env`; the e2e configuration loads environment files separately. `pnpm test` selects unit specs and passes with no tests, so it does not run the existing e2e suite.

E2e tests use the configured real PostgreSQL database and require existing data, including admin and user profiles. They write data: the write suite cleans up its records and restores profile changes, but the posts suite increments an existing view count. Use an appropriate non-production database.

## Production data: NestJS Observe

This app reports its traces, errors, logs and metrics to [NestJS Observe](https://observe.nestjs.com) through `ObserveModule` in `src/app.module.ts`. Its key pair comes from `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in `.env`, which `npx @nestjs/observe link` writes.

When a task depends on how the app behaves in production - an error users hit, a slow endpoint, a failing job, whether a release made things worse - work from that data, not from the code alone:

- The Observe MCP server answers those questions directly: errors with their traces and logs, slow operations, jobs, and what a release changed (`find_regressions`, `diff_release`). It is included on the Pro plan and above. In Claude Code: `claude mcp add observe --transport http https://observe-api.nestjs.com/mcp`, and the client opens a browser to approve. Other clients: https://www.observe.nestjs.com/documentation/mcp
- Without it, the user can open the request or error in the Observe dashboard and click **Copy agent prompt**, which hands over that page's trace, stack and logs as text.
