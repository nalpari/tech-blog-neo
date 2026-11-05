import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { get, getPosts, nameOf, type Author, type Profile } from "@/lib/api";
import { OthersNav, PostListing, Stats, chip, sortOf } from "@/components/listing";
import { Avatar, Loading, Sheet, SmallFooter } from "@/components/ui";
import { TopNav } from "@/components/top-nav";

const ROLE_LABEL = { admin: "관리자", author: "저자", user: "독자" } as const;

async function AuthorContent({ params, searchParams }: PageProps<"/authors/[username]">) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const sort = sortOf(sp.sort);
  const [author, posts, all] = await Promise.all([
    get<Profile>(`/profiles/${encodeURIComponent(username)}`),
    getPosts(new URLSearchParams({ author: username, sort }).toString()),
    // ponytail: 저자 목록 API 가 없어서 발행 글의 저자를 모은다. 글 없는 저자는 빠진다.
    getPosts("sort=latest"),
  ]);
  if (!author) notFound();
  const others = [...new Map<string, Author>(all.items.map((p) => [p.author.username, p.author])).values()];
  const totalViews = posts.items.reduce((n, p) => n + p.viewCount, 0);
  return (
    <>
      <header className="grid gap-8 px-6 pb-12 pt-12 md:px-12 lg:grid-cols-[auto_minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
        <Avatar author={author} size={128} />
        <div className="min-w-0">
          <h1 className="break-words font-extrabold leading-[0.95] tracking-[-0.04em]" style={{ fontSize: "clamp(3rem, 7vw, 6rem)" }}>{nameOf(author)}</h1>
          <p className="mt-3 text-[16px] text-[var(--ink-2)]">@{author.username}, {ROLE_LABEL[author.role]}</p>
          {author.bio && <p className="mt-5 max-w-[48ch] text-[19px] leading-[1.6]">{author.bio}</p>}
        </div>
        <Stats items={[["발행한 글", `${author.postCount}편`], ["누적 조회", totalViews.toLocaleString("ko-KR")]]} />
      </header>
      {others.length > 0 && (
        <OthersNav label="다른 저자">
          {others.map((a) => (
            <Link key={a.username} href={`/authors/${a.username}`} aria-current={a.username === username ? "page" : undefined} className={`${chip(a.username === username)} gap-2 pl-1`}>
              <Avatar author={a} size={26} />
              {nameOf(a)}
            </Link>
          ))}
        </OthersNav>
      )}
      <hr className="ff-fold" />
      <PostListing title={`${nameOf(author)}의 글`} posts={posts.items} sort={sort} showAuthor={false} />
    </>
  );
}

export default function AuthorPage(props: PageProps<"/authors/[username]">) {
  return (
    <Sheet>
      <TopNav current="저자" />
      <Suspense fallback={<Loading />}>
        <AuthorContent {...props} />
      </Suspense>
      <SmallFooter />
    </Sheet>
  );
}
