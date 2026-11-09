-- Supabase 프로젝트가 삭제되어 post-images 버킷 URL 이 전부 깨졌다.
-- 백업(post-images/)을 s3://devgrr/blog-assets/post-images/ 에 같은 경로로 올렸으므로 커버·본문 URL 의 앞부분만 바꾼다.
-- session_replication_role = replica: URL 교체가 updated_at(수정일) 트리거를 타지 않게 한다. 슈퍼유저로 실행한다.
-- 다시 실행해도 바꿀 행이 없어 안전하다. 빈 볼륨 첫 기동 때는 posts 가 비어 있어 아무 일도 하지 않는다.

begin;

set local session_replication_role = replica;

update public.posts set
  cover_image = replace(cover_image, 'https://stcwgfbjyvlyshdvojgn.supabase.co/storage/v1/object/public/post-images/',
                        'https://devgrr.s3.ap-northeast-2.amazonaws.com/blog-assets/post-images/'),
  content = replace(content, 'https://stcwgfbjyvlyshdvojgn.supabase.co/storage/v1/object/public/post-images/',
                    'https://devgrr.s3.ap-northeast-2.amazonaws.com/blog-assets/post-images/')
where cover_image like 'https://stcwgfbjyvlyshdvojgn.supabase.co/%'
   or content like '%https://stcwgfbjyvlyshdvojgn.supabase.co/%';

commit;
