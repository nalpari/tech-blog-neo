#!/usr/bin/env bash
# 로컬 techlog DB 의 데이터를 EC2 compose 의 postgres 로 옮긴다.
# 스키마는 EC2 db 컨테이너가 처음 뜰 때 000_schema.sql 로 이미 만들어져 있어야 한다.
#
# 사용: deploy/migrate-data.sh ec2-user@blog.devgrr.kr [-i ~/.ssh/key.pem]
#   로컬 컨테이너·계정은 LOCAL_CONTAINER(기본 pg), LOCAL_USER(기본 .env 의 DATABASE_URL 계정)로 바꿀 수 있다.
set -euo pipefail

[ $# -ge 1 ] || { echo "사용: $0 <user@host> [ssh 옵션...]" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_CONTAINER="${LOCAL_CONTAINER:-pg}"
LOCAL_USER="${LOCAL_USER:-$(sed -nE 's#^DATABASE_URL=[a-z]+://([^:@]+).*#\1#p' "$ROOT/tech-blog-neo-api/.env")}"
LOCAL_DB="${LOCAL_DB:-techlog}"
REMOTE="cd ~/tech-blog-neo/deploy && docker compose exec -T db psql -U techlog -d techlog -v ON_ERROR_STOP=1"

COUNTS="select 'profiles', count(*) from profiles union all select 'posts', count(*) from posts
  union all select 'tags', count(*) from tags union all select 'post_tags', count(*) from post_tags
  union all select 'post_likes', count(*) from post_likes union all select 'post_views', count(*) from post_views"

echo "== 로컬 행 수"
docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_USER" -d "$LOCAL_DB" -Atc "$COUNTS"

echo "== EC2 로 복원"
# --disable-triggers: auth.users 를 넣을 때 handle_new_user 트리거가 profiles 를 중복으로 만들지 않게 한다.
# --single-transaction: 중간에 실패하면(예: 이미 데이터가 있어 키 충돌) 전부 되돌린다.
docker exec "$LOCAL_CONTAINER" pg_dump -U "$LOCAL_USER" -d "$LOCAL_DB" --data-only --disable-triggers --no-owner --no-privileges \
  | ssh "$@" "$REMOTE --single-transaction -q"

echo "== EC2 행 수"
ssh "$@" "$REMOTE -Atc \"$COUNTS\""
