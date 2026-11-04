import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { get, getPosts, type Me, type PostDetail, type Profile } from "@/lib/api";
import { getAuthed } from "@/lib/server-api";
import { Markdown, sectionsOf } from "@/components/markdown";
import { Loading, Sheet, SmallFooter } from "@/components/ui";
import { TopNav } from "@/components/top-nav";
import { PostReader } from "./post-reader";

export async function generateMetadata({ params }: PageProps<"/posts/[slug]">): Promise<Metadata> {
  const post = await get<PostDetail>(`/posts/${encodeURIComponent((await params).slug)}`);
  return post ? { title: `${post.title} | interplug tech`, description: post.excerpt ?? undefined } : {};
}

async function Post({ params }: Pick<PageProps<"/posts/[slug]">, "params">) {
  const { slug } = await params;
  // 쿠키를 넘겨야 작성자 본인의 draft 와 liked 가 보인다.
  const [post, me] = await Promise.all([
    getAuthed<PostDetail>(`/posts/${encodeURIComponent(slug)}`),
    getAuthed<Me>("/auth/me"),
  ]);
  if (!post) notFound();
  const isAuthor = post.author.username === me?.username;
  const [profile, all] = await Promise.all([
    get<Profile>(`/profiles/${encodeURIComponent(post.author.username)}`),
    // ponytail: 이전·다음 글을 찾으려고 최신순 전체를 받는다. 글이 수백 편이 되면 API 에 이웃 조회를 추가.
    getPosts("sort=latest"),
  ]);
  const i = all.items.findIndex((p) => p.slug === post.slug);
  const content = post.content ?? "";
  return (
    <>
      <PostReader
        post={post}
        profile={profile}
        sections={sectionsOf(content)}
        body={<Markdown content={content} />}
        editHref={isAuthor ? `/write?slug=${encodeURIComponent(post.slug)}` : undefined}
        deleteHref={isAuthor ? `/posts/${encodeURIComponent(post.slug)}` : undefined}
      />
      <hr className="ff-fold" />
      <nav aria-label="이전 글과 다음 글" className="grid md:grid-cols-2">
        {[
          { label: "이전 글", p: i >= 0 ? all.items[i + 1] : undefined },
          { label: "다음 글", p: i > 0 ? all.items[i - 1] : undefined },
        ].map(({ label, p }, n) =>
          p ? (
            <Link key={label} href={`/posts/${p.slug}`} className={`group block px-6 py-10 md:px-12 ${n === 0 ? "bg-[var(--band)] hover:bg-[var(--band-deep)]" : "hover:bg-[var(--hover)] md:col-start-2 md:text-right"}`}>
              <span className="block text-[14px] text-[var(--ink-2)]">{label}</span>
              <span className="mt-2 block text-[21px] font-bold leading-snug group-hover:text-[var(--accent)] group-hover:underline group-hover:underline-offset-4">{p.title}</span>
            </Link>
          ) : null,
        )}
      </nav>
    </>
  );
}

export default function PostPage(props: PageProps<"/posts/[slug]">) {
  return (
    <Sheet>
      <TopNav current="글" />
      <Suspense fallback={<Loading label="글을 불러오는 중…" />}>
        <Post params={props.params} />
      </Suspense>
      <SmallFooter />
    </Sheet>
  );
}
