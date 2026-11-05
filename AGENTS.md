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
| Frontend API client | `tech-blog-neo-front/src/lib/api.ts`, `server-api.ts` |
| EC2 deployment (compose, nginx, data migration) | `deploy/`, `.github/workflows/deploy.yml` |
| Package-specific commands and rules | Each package's `AGENTS.md` |

## Code map

| Symbol | Location | Role |
| --- | --- | --- |
| `AppModule` | `tech-blog-neo-api/src/app.module.ts` | Registers API controllers, database, error filter and observability |
| `CoversController` | `tech-blog-neo-api/src/covers.controller.ts` | Lists cover image URLs from the S3 bucket for admins and authors |
| `Db` | `tech-blog-neo-api/src/db.ts` | PostgreSQL pool and transaction helper |
| `buildDocument` | `tech-blog-neo-api/src/swagger.ts` | Builds the API's OpenAPI document |
| `RootLayout` | `tech-blog-neo-front/src/app/layout.tsx` | Frontend root layout and fonts |

The frontend calls the API at `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`). Both applications default to port 3000, so run the API locally with `PORT=4000`. In production nginx serves both on one domain and forwards `/api/` to the API.
