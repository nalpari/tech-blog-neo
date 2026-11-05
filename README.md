# tech-blog-neo

interplug 팀 테크블로그. 팀원이 Google 계정으로 로그인해 markdown 으로 글을 쓰고, 사내와 외부 독자가 함께 읽는다.

| 디렉터리 | 내용 |
| --- | --- |
| `tech-blog-neo-api/` | NestJS + PostgreSQL API. 글, 태그, 프로필, 커버 이미지, Google OAuth 세션 |
| `tech-blog-neo-front/` | Next.js 프론트엔드 |
| `deploy/` | EC2 용 docker compose, nginx 설정, 데이터 이전 스크립트 |
| `.github/workflows/deploy.yml` | `main` 푸시 시 이미지 빌드와 EC2 배포 |

두 앱은 따로 관리한다. 각자 pnpm lockfile 이 있고 루트에는 패키지 실행기가 없다.

## 로컬 실행

필요한 것: Node.js, pnpm, PostgreSQL.

### DB

빈 데이터베이스에 `tech-blog-neo-api/db/` 의 SQL 을 번호 순서대로 적용한다.

### API

`tech-blog-neo-api/.env` 를 만든다. 프론트는 기본으로 `http://localhost:4000` 의 API 를 부르므로 `PORT=4000` 으로 띄운다.

```bash
PORT=4000
DATABASE_URL=postgres://<user>:<password>@localhost:5432/techlog
FRONT_URL=http://localhost:3000
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
OBSERVE_APP_KEY=
OBSERVE_APP_SECRET=
# 커버 이미지 목록 (/covers). 리전과 키는 AWS SDK 가 읽는다.
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_COVER_PREFIX=covers/
```

```bash
cd tech-blog-neo-api
pnpm install
pnpm start:dev
```

Swagger UI 는 `http://localhost:4000/docs` 에 있다.

### 프론트엔드

```bash
cd tech-blog-neo-front
pnpm install
pnpm dev
```

`http://localhost:3000` 으로 접속한다. API 주소를 바꾸려면 `NEXT_PUBLIC_API_URL` 을 설정한다.

## 명령

| 위치 | 명령 | 설명 |
| --- | --- | --- |
| API | `pnpm build` | 빌드 |
| API | `pnpm lint` | oxlint |
| API | `pnpm test:e2e` | e2e 테스트 |
| 프론트 | `pnpm build` | 빌드 |
| 프론트 | `pnpm lint` | ESLint |

e2e 테스트는 `.env` 의 실제 PostgreSQL 에 데이터를 쓰고, admin 과 user 프로필이 이미 있어야 한다. 운영 DB 가 아닌 곳에서 돌린다. `pnpm test` 는 단위 테스트만 고르므로 e2e 를 돌리지 않는다.

## 권한

프로필 역할은 `admin`, `author`, `user` 다. 글쓰기와 커버 목록 조회는 `admin`, `author` 만 할 수 있고, 역할은 admin 이 바꾼다.

## 배포

`main` 에 푸시하면 GitHub Actions 가 다음을 한다.

1. API 와 프론트 이미지를 빌드해 Docker Hub 에 `latest` 와 커밋 SHA 태그로 올린다.
2. `deploy/docker-compose.yml` 과 `tech-blog-neo-api/db/` 를 EC2 의 `~/tech-blog-neo` 로 복사한다.
3. EC2 에서 `docker compose pull` 과 `up -d` 를 실행한다.

GitHub 에 필요한 값:

- secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`
- variables: `DOMAIN`

### EC2 준비

- `deploy/.env.example` 을 EC2 의 `~/tech-blog-neo/deploy/.env` 로 복사해 채운다.
- `deploy/nginx-blog.devgrr.kr.conf` 를 `/etc/nginx/sites-available/` 에 두고 활성화한 뒤 `certbot --nginx` 로 HTTPS 를 붙인다.
- nginx 는 `/api/` 를 API(127.0.0.1:4000)로, 나머지를 프론트(127.0.0.1:3000)로 넘긴다. 세션 쿠키가 호스트 단위라 두 앱을 한 도메인에 둔다.

### DB 스키마와 데이터

- `db` 컨테이너가 빈 볼륨으로 처음 뜰 때만 `tech-blog-neo-api/db/` 의 SQL 이 실행된다. 이후 마이그레이션은 직접 적용한다.
- 로컬 DB 의 데이터를 EC2 로 옮길 때는 다음을 실행한다.

  ```bash
  deploy/migrate-data.sh ec2-user@<host> -i ~/.ssh/<key>.pem
  ```

  한 트랜잭션으로 복원하므로, EC2 에 이미 데이터가 있어 키가 충돌하면 전부 되돌린다.

## 운영 모니터링

API 의 트레이스, 오류, 로그, 지표는 NestJS Observe 로 보낸다. 키는 `OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET` 이다.
