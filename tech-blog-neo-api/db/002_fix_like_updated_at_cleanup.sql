-- 1) 조회수·좋아요 갱신이 updated_at(수정일)을 바꾸지 않도록 posts 트리거를 내용 컬럼 변경에만 건다.
-- 2) toggle_post_like 를 동시 요청에도 like_count 와 post_likes 행 수가 어긋나지 않게 바꾼다.
-- 3) Supabase 시절에 남은, 앱이 쓰지 않는 함수·RLS 정책·중복 인덱스를 지운다.
--    API 는 테이블 소유자(슈퍼유저)로 붙으므로 RLS 는 적용된 적이 없다. 권한 검사는 API 가 한다.
-- 빈 볼륨 첫 기동 때는 000, 001 다음에 자동 실행되고, 운영 DB 에는 수동으로 한 번 적용한다.

begin;

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at before update on public.posts for each row
  when ((old.slug, old.title, old.excerpt, old.content, old.cover_image, old.cover_gradient,
         old.status, old.featured, old.read_time, old.published_at)
        is distinct from
        (new.slug, new.title, new.excerpt, new.content, new.cover_image, new.cover_gradient,
         new.status, new.featured, new.read_time, new.published_at))
  execute function public.update_updated_at();

-- delete/insert 결과(행이 실제로 바뀌었는지)로 분기한다. 동시에 같은 사용자의 요청이 와도
-- 행 잠금으로 직렬화되고, 실제로 바뀐 경우에만 카운트를 움직인다.
create or replace function public.toggle_post_like(post_slug text, liker_id uuid) returns json
    language plpgsql security definer
    set search_path to ''
    as $$
declare
  target_post_id uuid;
  new_count integer;
begin
  select id into target_post_id from public.posts where slug = post_slug;
  if not found then
    return null;
  end if;

  delete from public.post_likes where post_id = target_post_id and user_id = liker_id;
  if found then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = target_post_id
    returning like_count into new_count;
    return json_build_object('liked', false, 'likeCount', new_count);
  end if;

  insert into public.post_likes (post_id, user_id) values (target_post_id, liker_id)
  on conflict do nothing;
  if found then
    update public.posts set like_count = like_count + 1 where id = target_post_id
    returning like_count into new_count;
  else
    -- 동시에 들어온 다른 요청이 먼저 좋아요를 넣었다. 카운트는 그쪽이 올렸다.
    select like_count into new_count from public.posts where id = target_post_id;
  end if;
  return json_build_object('liked', true, 'likeCount', new_count);
end;
$$;

-- RLS 정책이 auth.uid()·get_user_role() 을 참조하므로 정책부터 지운다.
drop policy if exists post_likes_delete on public.post_likes;
drop policy if exists post_likes_insert on public.post_likes;
drop policy if exists post_likes_select on public.post_likes;
drop policy if exists post_tags_delete on public.post_tags;
drop policy if exists post_tags_insert on public.post_tags;
drop policy if exists post_tags_select on public.post_tags;
drop policy if exists post_views_insert_all on public.post_views;
drop policy if exists post_views_select_admin on public.post_views;
drop policy if exists posts_delete on public.posts;
drop policy if exists posts_insert on public.posts;
drop policy if exists posts_select on public.posts;
drop policy if exists posts_update on public.posts;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists tags_delete on public.tags;
drop policy if exists tags_insert on public.tags;
drop policy if exists tags_select on public.tags;
drop policy if exists tags_update on public.tags;
alter table public.post_likes disable row level security;
alter table public.post_tags disable row level security;
alter table public.post_views disable row level security;
alter table public.posts disable row level security;
alter table public.profiles disable row level security;
alter table public.tags disable row level security;

drop function if exists public.get_user_role();
drop function if exists auth.uid();
drop function if exists public.increment_post_view_count(text);
drop function if exists public.toggle_post_like(text, boolean);
drop function if exists public.update_updated_at_column();

-- posts_slug_key, tags_slug_key unique 제약의 인덱스와 겹친다.
drop index if exists public.idx_posts_slug;
drop index if exists public.idx_tags_slug;

commit;
