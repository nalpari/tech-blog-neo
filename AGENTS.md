# Project knowledge base

## Overview

Two independently managed TypeScript applications: a NestJS/PostgreSQL API and a Next.js frontend. Each has its own pnpm lockfile; there is no root package runner.

## Where to look

| Task | Location |
| --- | --- |
| API routes, authentication, database | `tech-blog-neo-api/src/` |
| API integration tests | `tech-blog-neo-api/test/` |
| Database change | `tech-blog-neo-api/db/` |
| Frontend routes and styles | `tech-blog-neo-front/src/app/` |
| Package-specific commands and rules | Each package's `AGENTS.md` |

## Code map

| Symbol | Location | Role |
| --- | --- | --- |
| `AppModule` | `tech-blog-neo-api/src/app.module.ts` | Registers API controllers, database, error filter and observability |
| `Db` | `tech-blog-neo-api/src/db.ts` | PostgreSQL pool and transaction helper |
| `buildDocument` | `tech-blog-neo-api/src/swagger.ts` | Builds the API's OpenAPI document |
| `RootLayout` | `tech-blog-neo-front/src/app/layout.tsx` | Frontend root layout and fonts |

The frontend is currently the Next.js starter and has no API integration in its app source. Both applications default to port 3000; configure a different port when running them together.
