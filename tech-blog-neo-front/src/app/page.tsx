import Link from "next/link";
import { Suspense } from "react";
import { fmtDate, get, getPosts, nameOf, type PostList, type PostSummary, type TagInfo } from "@/lib/api";
import { ScrollTo, SortSelect } from "@/components/client";
import { Avatar, Cover, Empty, Loading, Sheet, Wordmark } from "@/components/ui";
import { TopNav } from "@/components/top-nav";
import { ResumeBanner } from "./resume-banner";

const STEP = 10;

function IndexRow({ post, index }: { post: PostSummary; index: number }) {
  return (
    <li style={{ animationDelay: `${index * 70}ms` }}>
      <Link href={`/posts/${post.slug}`} className={`group grid grid-cols-[1fr] gap-x-6 gap-y-2 px-6 py-5 transition-colors md:grid-cols-[96px_minmax(0,1fr)_140px_88px] md:items-center md:px-12 lg:grid-cols-[96px_120px_minmax(0,1fr)_150px_96px] ${index % 2 === 0 ? "bg-[var(--band)] hover:bg-[var(--band-deep)]" : "bg-transparent hover:bg-[var(--hover)]"}`}>
        <span className="num hidden text-[15px] text-[var(--ink-2)] md:block">{fmtDate(post.publishedAt)}</span>
        <span className="hidden lg:block">
          <Cover post={post} className="aspect-[4/3] w-[120px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-[19px] font-bold leading-snug tracking-[-0.01em] group-hover:text-[var(--accent)] group-hover:underline group-hover:underline-offset-4">{post.title}</span>
          {post.excerpt && <span className="mt-1 block max-w-[62ch] text-[15px] leading-relaxed text-[var(--ink-2)]">{post.excerpt}</span>}
          <span className="num mt-2 block text-[14px] text-[var(--ink-2)] md:hidden">
            {[fmtDate(post.publishedAt), nameOf(post.author), post.readTime].filter(Boolean).join(", ")}
          </span>
        </span>
        <span className="hidden min-w-0 items-center gap-2 text-[15px] md:flex">
          <Avatar author={post.author} size={26} />
          <span className="truncate">{nameOf(post.author)}</span>
        </span>
        <span className="num hidden text-right text-[14px] text-[var(--ink-2)] md:block">
          {post.readTime}
          <span className="block">{post.viewCount.toLocaleString("ko-KR")}회</span>
        </span>
      </Link>
    </li>
  );
}

async function Featured() {
  const featured = (await get<PostList>("/posts?featured=true&limit=1"))?.items[0] ?? (await get<PostList>("/posts?limit=1"))?.items[0];
  if (!featured) return null;
  const href = `/posts/${featured.slug}`;
  return (
    <>
      <section aria-labelledby="featured-title" className="grid gap-8 px-6 py-12 md:px-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12 lg:py-16">
        <Link href={href} className="group block overflow-hidden bg-[var(--band)]" tabIndex={-1} aria-hidden="true">
          <Cover post={featured} className="aspect-[16/10] w-full transition-transform duration-700 ease-out group-hover:scale-[1.02]" />
        </Link>
        <div className="flex flex-col justify-end">
          <div className="flex flex-wrap gap-2">
            {featured.tags.map((t) => <Link key={t.slug} href={`/tags/${t.slug}`} className="ff-tag hover:bg-[var(--line)]">{t.name}</Link>)}
          </div>
          <h2 id="featured-title" className="mt-5 text-[34px] font-extrabold leading-[1.18] tracking-[-0.03em] md:text-[44px]">
            <Link href={href} className="hover:text-[var(--accent)]">{featured.title}</Link>
          </h2>
          {featured.excerpt && <p className="mt-5 max-w-[46ch] text-[18px] leading-[1.6] text-[var(--ink-2)]">{featured.excerpt}</p>}
          <div className="mt-7 flex items-center gap-3 text-[15px]">
            <Avatar author={featured.author} size={36} />
            <span>
              <span className="block font-semibold">{nameOf(featured.author)}</span>
              <span className="num block text-[var(--ink-2)]">{fmtDate(featured.publishedAt)} 발행{featured.readTime && `, ${featured.readTime}`}</span>
            </span>
          </div>
          <div className="mt-8">
            <Link href={href} className="ff-btn primary">글 읽기</Link>
          </div>
        </div>
      </section>
      <hr className="ff-fold" />
    </>
  );
}

async function RecentPosts({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const sp = await searchParams;
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const sort = sp.sort === "popular" ? "popular" : "latest";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const limit = Math.max(STEP, Number(sp.limit) || STEP);
  const [tags, list] = await Promise.all([
    get<TagInfo[]>("/tags").then((t) => t ?? []),
    getPosts(new URLSearchParams({ tag, sort, q }).toString(), limit),
  ]);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(tag && { tag }), ...(sort === "popular" && { sort }), ...(q && { q }), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/?${p}#recent`;
  };
  const tagName = tags.find((t) => t.slug === tag)?.name ?? tag;
  const remaining = list.total - list.items.length;
  return (
    <>
      <section id="recent" aria-labelledby="index-title" className="scroll-mt-4 pb-6 pt-14">
        <div className="flex flex-col gap-6 px-6 md:px-12 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="index-title" className="shrink-0 text-[30px] font-extrabold tracking-[-0.02em]">최근 글</h2>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <nav aria-label="태그로 거르기" className="flex flex-wrap gap-1">
              {[{ slug: "", name: "전체" }, ...tags].map((t) => (
                <Link key={t.slug} href={qs({ tag: t.slug, limit: "" })} scroll={false} aria-current={tag === t.slug ? "true" : undefined} className={`inline-flex h-9 items-center px-3 text-[14px] font-medium transition-colors ${tag === t.slug ? "bg-[var(--strong)] text-[var(--on-strong)]" : "bg-transparent hover:bg-[var(--band)]"}`}>
                  {t.name}
                </Link>
              ))}
            </nav>
            <SortSelect value={sort} />
          </div>
        </div>

        {q && (
          <p className="mt-6 px-6 text-[15px] text-[var(--ink-2)] md:px-12" aria-live="polite">
            <ScrollTo key={q} id="recent" />
            <strong className="text-[var(--ink)]">&lsquo;{q}&rsquo;</strong> 검색 결과 {list.total}개
            <Link href={qs({ q: "", limit: "" })} scroll={false} className="ml-3 underline underline-offset-4 hover:text-[var(--accent)]">검색 지우기</Link>
          </p>
        )}

        <div className="mt-8 hidden px-6 pb-3 text-[13px] font-medium text-[var(--ink-2)] md:grid md:grid-cols-[96px_minmax(0,1fr)_140px_88px] md:gap-x-6 md:px-12 lg:grid-cols-[96px_120px_minmax(0,1fr)_150px_96px]" aria-hidden="true">
          <span>발행일</span>
          <span className="hidden lg:block" />
          <span>제목</span>
          <span>저자</span>
          <span className="text-right">읽기, 조회</span>
        </div>

        {list.items.length > 0 ? (
          <ul key={`${tag}-${sort}-${q}`} className="ff-printing">
            {list.items.map((p, i) => <IndexRow key={p.slug} post={p} index={i % STEP} />)}
          </ul>
        ) : (
          q ? (
          <Empty title={`'${q}'에 맞는 글이 없습니다.`} body="다른 검색어를 쓰거나 태그 거르기를 풀어 보세요." />
        ) : (
          <Empty title={tag ? `${tagName} 태그로 쓴 글이 아직 없습니다.` : "아직 발행한 글이 없습니다."} body="다른 태그를 고르거나 전체 글을 보세요." />
        )
        )}

        {remaining > 0 && (
          <div className="px-6 pt-8 md:px-12">
            <Link href={qs({ limit: String(limit + STEP) })} scroll={false} className="ff-btn quiet">
              글 {remaining}개 더 보기
            </Link>
          </div>
        )}
      </section>

      <hr className="ff-fold mt-16" />

      <section id="tags" aria-labelledby="tags-title" className="grid gap-8 px-6 py-14 md:px-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <h2 id="tags-title" className="text-[30px] font-extrabold tracking-[-0.02em]">주제별로 읽기</h2>
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {tags.map((t) => (
            <li key={t.slug}>
              <Link href={`/tags/${t.slug}`} className="group flex items-baseline justify-between gap-4 py-4 hover:bg-[var(--hover)]">
                <span>
                  <span className="block text-[19px] font-bold group-hover:text-[var(--accent)] group-hover:underline group-hover:underline-offset-4">{t.name}</span>
                  {t.description && <span className="block text-[15px] text-[var(--ink-2)]">{t.description}</span>}
                </span>
                <span className="num shrink-0 text-[15px] text-[var(--ink-2)]">글 {t.postCount}개</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function Home(props: PageProps<"/">) {
  return (
    <Sheet>
      <TopNav current="글" />
      <ResumeBanner />

      <header className="px-6 pb-10 pt-14 md:px-12 md:pt-20">
        <h1 className="sr-only">interplug tech, interplug 팀의 기술 블로그</h1>
        <Wordmark size="large" />
        <p className="mt-6 max-w-[46ch] text-[20px] leading-[1.55] md:text-[22px]">
          interplug 팀이 AI, 미래 기술, 코드를 직접 다루며 배운 것을 씁니다.
        </p>
      </header>

      <hr className="ff-fold" />

      <Suspense fallback={<Loading inline />}>
        <Featured />
      </Suspense>

      <Suspense fallback={<Loading label="글 목록을 불러오는 중…" inline />}>
        <RecentPosts searchParams={props.searchParams} />
      </Suspense>

      <footer className="bg-[var(--deep)] px-6 pb-10 pt-16 text-[var(--ink)] md:px-12">
        <div className="text-[var(--ink-2)]"><Wordmark size="large" /></div>
        <div className="mt-10 flex flex-col justify-between gap-4 text-[15px] text-[var(--ink-2)] md:flex-row">
          <nav aria-label="바닥 메뉴" className="flex flex-wrap gap-6">
            <Link href="/" className="hover:text-[var(--ink)]">글</Link>
            <Link href="/tags" className="hover:text-[var(--ink)]">태그</Link>
            <Link href="/authors" className="hover:text-[var(--ink)]">저자</Link>
            <Link href="/write" className="hover:text-[var(--ink)]">글쓰기</Link>
          </nav>
          <span>© 2026 interplug</span>
        </div>
      </footer>
    </Sheet>
  );
}
