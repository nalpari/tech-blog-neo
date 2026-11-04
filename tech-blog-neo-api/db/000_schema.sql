-- 로컬 DB 에서 pg_dump --schema-only --no-owner --no-privileges 로 뽑은 기준 스키마.
-- 운영 postgres 컨테이너가 빈 볼륨으로 처음 뜰 때 docker-entrypoint-initdb.d 로 실행된다.

--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;


--
-- Name: get_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select role from public.profiles where id = auth.uid();
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;


--
-- Name: increment_post_view_count(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_post_view_count(post_slug text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE posts
  SET view_count = view_count + 1
  WHERE slug = post_slug
  RETURNING view_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;


--
-- Name: increment_post_view_count(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_post_view_count(post_slug text, viewer_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  target_post_id uuid;
  new_count integer;
BEGIN
  SELECT id INTO target_post_id FROM public.posts WHERE slug = post_slug;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 조회 이력 기록
  INSERT INTO public.post_views (post_id, user_id) VALUES (target_post_id, viewer_id);

  -- view_count 증가
  UPDATE public.posts SET view_count = view_count + 1 WHERE id = target_post_id
  RETURNING view_count INTO new_count;

  RETURN new_count;
END;
$$;


--
-- Name: toggle_post_like(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_post_like(post_slug text, should_like boolean) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  current_count integer;
BEGIN
  IF should_like THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE slug = post_slug
    RETURNING like_count INTO current_count;
  ELSE
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE slug = post_slug
    RETURNING like_count INTO current_count;
  END IF;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN current_count;
END;
$$;


--
-- Name: toggle_post_like(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_post_like(post_slug text, liker_id uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  target_post_id uuid;
  already_liked boolean;
  new_count integer;
BEGIN
  SELECT id INTO target_post_id FROM public.posts WHERE slug = post_slug;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 기존 좋아요 여부 확인
  SELECT EXISTS(
    SELECT 1 FROM public.post_likes WHERE post_id = target_post_id AND user_id = liker_id
  ) INTO already_liked;

  IF already_liked THEN
    -- 좋아요 취소
    DELETE FROM public.post_likes WHERE post_id = target_post_id AND user_id = liker_id;
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = target_post_id
    RETURNING like_count INTO new_count;
    RETURN json_build_object('liked', false, 'likeCount', new_count);
  ELSE
    -- 좋아요 추가
    INSERT INTO public.post_likes (post_id, user_id) VALUES (target_post_id, liker_id);
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = target_post_id
    RETURNING like_count INTO new_count;
    RETURN json_build_object('liked', true, 'likeCount', new_count);
  END IF;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    id uuid NOT NULL,
    email text,
    raw_user_meta_data jsonb
);


--
-- Name: post_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_likes (
    user_id uuid NOT NULL,
    post_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE post_likes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.post_likes IS '포스트 좋아요';


--
-- Name: post_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_tags (
    post_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: TABLE post_tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.post_tags IS '포스트-태그 다대다 관계';


--
-- Name: post_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    excerpt text,
    content text,
    cover_image text,
    cover_gradient text,
    status text DEFAULT 'draft'::text NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    read_time text,
    view_count integer DEFAULT 0 NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    like_count integer DEFAULT 0 NOT NULL,
    sort_date timestamp with time zone GENERATED ALWAYS AS (COALESCE(published_at, created_at)) STORED,
    CONSTRAINT posts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))
);


--
-- Name: TABLE posts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.posts IS '블로그 포스트';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    display_name text,
    avatar_url text,
    bio text,
    role text DEFAULT 'user'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'author'::text, 'user'::text])))
);


--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.profiles IS '사용자 프로필 (auth.users 1:1)';


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tags IS '태그 마스터';


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: post_likes post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_pkey PRIMARY KEY (user_id, post_id);


--
-- Name: post_tags post_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_tags
    ADD CONSTRAINT post_tags_pkey PRIMARY KEY (post_id, tag_id);


--
-- Name: post_views post_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_views
    ADD CONSTRAINT post_views_pkey PRIMARY KEY (id);


--
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (id);


--
-- Name: posts posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tags tags_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_slug_key UNIQUE (slug);


--
-- Name: idx_post_likes_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_likes_post_id ON public.post_likes USING btree (post_id);


--
-- Name: idx_post_tags_tag_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_tags_tag_id ON public.post_tags USING btree (tag_id);


--
-- Name: idx_post_views_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_views_post_id ON public.post_views USING btree (post_id);


--
-- Name: idx_post_views_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_post_views_user_id ON public.post_views USING btree (user_id);


--
-- Name: idx_posts_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_author_id ON public.posts USING btree (author_id);


--
-- Name: idx_posts_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_slug ON public.posts USING btree (slug);


--
-- Name: idx_posts_status_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_posts_status_published_at ON public.posts USING btree (status, published_at DESC);


--
-- Name: idx_tags_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tags_slug ON public.tags USING btree (slug);


--
-- Name: posts_featured_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_featured_sort_idx ON public.posts USING btree (sort_date DESC) WHERE ((status = 'published'::text) AND (featured = true));


--
-- Name: posts_published_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX posts_published_sort_idx ON public.posts USING btree (sort_date DESC, id DESC) WHERE (status = 'published'::text);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: posts set_posts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles set_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: post_likes post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_likes post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_likes
    ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: post_tags post_tags_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_tags
    ADD CONSTRAINT post_tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_tags post_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_tags
    ADD CONSTRAINT post_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: post_views post_views_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_views
    ADD CONSTRAINT post_views_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;


--
-- Name: post_views post_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_views
    ADD CONSTRAINT post_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: posts posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: post_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: post_likes post_likes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY post_likes_delete ON public.post_likes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: post_likes post_likes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY post_likes_insert ON public.post_likes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: post_likes post_likes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY post_likes_select ON public.post_likes FOR SELECT USING (true);


--
-- Name: post_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: post_tags post_tags_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY post_tags_delete ON public.post_tags FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.posts
  WHERE ((posts.id = post_tags.post_id) AND ((posts.author_id = auth.uid()) OR (public.get_user_role() = 'admin'::text))))));


--
-- Name: post_tags post_tags_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY post_tags_insert ON public.post_tags FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.posts
  WHERE ((posts.id = post_tags.post_id) AND ((posts.author_id = auth.uid()) OR (public.get_user_role() = 'admin'::text))))));


--
-- Name: post_tags post_tags_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY post_tags_select ON public.post_tags FOR SELECT USING (true);


--
-- Name: post_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

--
-- Name: post_views post_views_insert_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY post_views_insert_all ON public.post_views FOR INSERT WITH CHECK (true);


--
-- Name: post_views post_views_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY post_views_select_admin ON public.post_views FOR SELECT USING ((public.get_user_role() = 'admin'::text));


--
-- Name: posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

--
-- Name: posts posts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY posts_delete ON public.posts FOR DELETE USING (((author_id = auth.uid()) OR (public.get_user_role() = 'admin'::text)));


--
-- Name: posts posts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY posts_insert ON public.posts FOR INSERT WITH CHECK (((author_id = auth.uid()) AND (public.get_user_role() = ANY (ARRAY['admin'::text, 'author'::text]))));


--
-- Name: posts posts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY posts_select ON public.posts FOR SELECT USING (((status = 'published'::text) OR (author_id = auth.uid()) OR (public.get_user_role() = 'admin'::text)));


--
-- Name: posts posts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY posts_update ON public.posts FOR UPDATE USING (((author_id = auth.uid()) OR (public.get_user_role() = 'admin'::text)));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (true);


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

--
-- Name: tags tags_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tags_delete ON public.tags FOR DELETE USING ((public.get_user_role() = 'admin'::text));


--
-- Name: tags tags_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tags_insert ON public.tags FOR INSERT WITH CHECK ((public.get_user_role() = ANY (ARRAY['admin'::text, 'author'::text])));


--
-- Name: tags tags_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tags_select ON public.tags FOR SELECT USING (true);


--
-- Name: tags tags_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tags_update ON public.tags FOR UPDATE USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'author'::text])));


--
-- PostgreSQL database dump complete
--


