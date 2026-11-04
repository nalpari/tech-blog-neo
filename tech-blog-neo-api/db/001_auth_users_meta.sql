-- handle_new_user 트리거가 new.raw_user_meta_data 를 읽는데 컬럼이 없어서
-- auth.users 에 새 사용자를 넣으면 실패했다. 컬럼을 추가해 트리거를 살린다.
alter table auth.users add column if not exists raw_user_meta_data jsonb;
