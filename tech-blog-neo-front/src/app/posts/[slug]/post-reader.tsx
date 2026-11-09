"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { API, fmtDate, nameOf, send, type PostDetail, type Profile } from "@/lib/api";
import { readResume, writeResume } from "@/lib/resume";
import type { Section } from "@/components/markdown";
import { CopyButton } from "@/components/client";
import { Avatar, Cover } from "@/components/ui";

const ROLE_LABEL = { admin: "관리자", author: "저자", user: "독자" } as const;

export function PostReader({ post, profile, sections, body, editHref, deleteHref }: { post: PostDetail; profile: Profile | null; sections: Section[]; body: ReactNode; editHref?: string; deleteHref?: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [like, setLike] = useState({ liked: post.liked, likeCount: post.likeCount });
  const [likeError, setLikeError] = useState("");
  const [liking, setLiking] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [stopped, setStopped] = useState<number | null>(null);
  const articleRef = useRef<HTMLElement>(null);

  // 조회수: 탭 세션당 한 번
  useEffect(() => {
    const key = `ff-viewed:${post.slug}`;
    if (post.status !== "published" || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    fetch(`${API}/posts/${encodeURIComponent(post.slug)}/views`, { method: "POST" }).catch(() => {});
  }, [post.slug, post.status]);

  useEffect(() => {
    const saved = readResume();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage 는 마운트 뒤에만 읽을 수 있다
    if (saved?.slug === post.slug) setStopped(saved.section);
    // 목차 항목과 같은 순서로 제목을 id 로 찾는다. 인덱스가 곧 sections 의 인덱스다.
    const heads = sections.map((s) => document.getElementById(s.id));
    let frame = 0;
    let last = "";
    const measure = () => {
      frame = 0;
      const el = articleRef.current;
      if (!el) return;
      let idx = 0;
      heads.forEach((h, i) => {
        if (h && h.getBoundingClientRect().top < window.innerHeight * 0.35) idx = i;
      });
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(100, Math.round((-r.top / Math.max(r.height - window.innerHeight, 1)) * 100)));
      if (`${idx}:${p}` === last) return;
      last = `${idx}:${p}`;
      setCurrent(idx);
      setProgress(p);
      if (p >= 95) {
        if (readResume()?.slug === post.slug) writeResume(null);
      } else if (p >= 3) {
        writeResume({ slug: post.slug, title: post.title, progress: p, section: idx });
      }
    };
    // 스크롤 이벤트는 프레임당 한 번만 측정한다.
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [post.slug, post.title, sections]);

  const toggleLike = async () => {
    if (liking) return;
    setLiking(true);
    setLikeError("");
    try {
      setLike(await send<{ liked: boolean; likeCount: number }>("POST", `/posts/${encodeURIComponent(post.slug)}/like`));
    } catch (e) {
      setLikeError((e as Error).message);
    } finally {
      setLiking(false);
    }
  };

  const deletePost = async () => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await send("DELETE", `/posts/${encodeURIComponent(post.slug)}`);
      router.push("/");
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTocOpen(false);
  };

  const Toc = (
    <ol className="flex flex-col">
      {sections.map((s, i) => {
        const state = i === current ? "now" : i < current ? "read" : "ahead";
        return (
          <li key={s.id} className="relative">
            <button type="button" onClick={() => jump(s.id)} aria-current={state === "now" ? "location" : undefined} className="group grid min-h-[36px] w-full grid-cols-[20px_1fr] items-start gap-3 py-1.5 text-left text-[15px] leading-snug">
              <span aria-hidden="true" className={`mt-[3px] block h-[14px] w-[14px] rounded-full border ${state === "now" ? "border-[var(--accent)] bg-[var(--accent)]" : state === "read" ? "border-[var(--ink-2)] bg-[var(--muted)]" : "border-[var(--line)] bg-[var(--deep)]"}`} />
              <span className={state === "now" ? "font-bold text-[var(--ink)]" : "text-[var(--ink-2)] group-hover:text-[var(--accent)]"}>{s.title}</span>
            </button>
            {i === stopped && (
              <span className="ml-8 inline-block -translate-y-0.5 bg-[var(--accent)] px-2 py-0.5 pr-4 text-[12px] font-semibold text-[var(--on-accent)] [clip-path:polygon(0_0,100%_0,92%_50%,100%_100%,0_100%)]">
                지난번에 여기서 멈춤
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );

  const authorHref = `/authors/${post.author.username}`;
  const edited = post.publishedAt && fmtDate(post.updatedAt) !== fmtDate(post.publishedAt);
  const primaryTag = post.tags[0];

  return (
    <>
      <div className="sticky top-0 z-10 h-[3px] bg-[var(--band)]" aria-hidden="true">
        <div className="h-full bg-[var(--accent)] transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>

      {post.status === "draft" && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-[var(--raised)] px-6 py-3 text-[15px] md:px-12">
          <span><b>초안입니다.</b> 작성자와 관리자에게만 보입니다.</span>
          <Link href={`/write?slug=${post.slug}`} className="ff-link">이어서 쓰기</Link>
        </div>
      )}

      <div className="grid gap-x-12 px-6 md:px-12 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,720px)_240px] xl:justify-center">
        {/* 목차 (데스크톱) */}
        <aside className="hidden pt-[280px] lg:block">
          {sections.length > 0 && (
            <nav aria-label="글 목차" className="sticky top-10 max-h-[calc(100vh-5rem)] overflow-y-auto">
              <p className="mb-3 text-[14px] font-semibold">이 글의 순서</p>
              {Toc}
              <p className="num mt-5 text-[14px] text-[var(--ink-2)]">{progress}% 읽음</p>
            </nav>
          )}
        </aside>

        <article ref={articleRef} className="min-w-0 pb-10 pt-12">
          <nav aria-label="위치" className="text-[14px] text-[var(--ink-2)]">
            <ol className="flex flex-wrap items-center gap-2">
              <li><Link href="/" className="hover:text-[var(--ink)]">글</Link></li>
              {primaryTag && (
                <>
                  <li aria-hidden="true">/</li>
                  <li><Link href={`/tags/${primaryTag.slug}`} className="hover:text-[var(--ink)]">{primaryTag.name}</Link></li>
                </>
              )}
            </ol>
          </nav>
          <div className="mt-5 flex flex-wrap gap-2">
            {post.tags.map((t) => <Link key={t.slug} href={`/tags/${t.slug}`} className="ff-tag hover:bg-[var(--line)]">{t.name}</Link>)}
          </div>
          <h1 className="sticky top-[3px] z-20 mt-5 bg-[var(--canvas)] py-6 text-[36px] font-extrabold leading-[1.2] tracking-[-0.03em] [text-wrap:balance] md:text-[48px]">{post.title}</h1>
          {post.excerpt && <p className="mt-5 text-[20px] leading-[1.6] text-[var(--ink-2)]">{post.excerpt}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[15px]">
            <Link href={authorHref} className="flex items-center gap-3 hover:text-[var(--accent)]">
              <Avatar author={post.author} size={36} />
              <span className="font-semibold">{nameOf(post.author)}</span>
            </Link>
            {post.publishedAt && (
              <span className="num text-[var(--ink-2)]">
                {fmtDate(post.publishedAt)} 발행{edited && `, ${fmtDate(post.updatedAt).slice(5)} 수정`}
              </span>
            )}
            {post.readTime && <span className="num text-[var(--ink-2)]">{post.readTime}</span>}
            <span className="num text-[var(--ink-2)]">조회 {post.viewCount.toLocaleString("ko-KR")}</span>
          </div>

          {/* 목차 (모바일·태블릿) */}
          {sections.length > 0 && (
            <div className="mt-8 lg:hidden">
              <button type="button" aria-expanded={tocOpen} onClick={() => setTocOpen((v) => !v)} className="ff-btn quiet w-full justify-between">
                <span>이 글의 순서</span>
                <span className="num">{progress}% 읽음</span>
              </button>
              {tocOpen && <nav aria-label="글 목차" className="bg-[var(--hover)] px-4 py-3">{Toc}</nav>}
            </div>
          )}

          <Cover post={post} className="mt-10 aspect-[16/9] w-full" />

          <div className="mt-6 text-[18px] leading-[1.8] text-[var(--ink)]">{body}</div>

          <div className="mt-14 flex flex-wrap items-center gap-3">
            {editHref && <Link href={editHref} className="ff-btn quiet">수정</Link>}
            {deleteHref && <button type="button" onClick={deletePost} className="ff-btn quiet text-[var(--err)]">삭제</button>}
            {post.status === "published" && (
              <button type="button" aria-pressed={like.liked} onClick={toggleLike} disabled={liking} className={`ff-btn ${like.liked ? "primary" : "quiet"}`}>
                {like.liked ? "좋아요 취소" : "좋아요"}
                <span className="num">{like.likeCount}</span>
              </button>
            )}
            <CopyButton text={() => window.location.href} label="링크 복사" done="링크를 복사했어요" className="ff-btn quiet" />
            {likeError && <p role="alert" className="text-[14px] font-medium text-[var(--err)]">{likeError}</p>}
          </div>
        </article>

        {/* 여백 주석: 저자, 이력 */}
        <aside className="pb-10 lg:col-start-2 xl:col-start-auto xl:pt-[280px]">
          <div className="xl:sticky xl:top-10">
            <section aria-labelledby="author-h" className="bg-[var(--band)] p-5">
              <h2 id="author-h" className="sr-only">저자</h2>
              <div className="flex items-center gap-3">
                <Avatar author={post.author} size={44} />
                <div className="min-w-0">
                  <Link href={authorHref} className="block text-[17px] font-bold hover:text-[var(--accent)]">{nameOf(post.author)}</Link>
                  <span className="block truncate text-[14px] text-[var(--ink-2)]">@{post.author.username}{profile && `, ${ROLE_LABEL[profile.role]}`}</span>
                </div>
              </div>
              {profile?.bio && <p className="mt-4 text-[15px] leading-relaxed">{profile.bio}</p>}
              {profile && <Link href={authorHref} className="ff-link mt-4 inline-block text-[15px]">이 저자의 글 {profile.postCount}편</Link>}
            </section>
            {(editHref || deleteHref) && (
              <div className="mt-3 flex gap-2">
                {editHref && <Link href={editHref} className="ff-btn quiet flex-1 justify-center">수정</Link>}
                {deleteHref && <button type="button" onClick={deletePost} className="ff-btn quiet flex-1 justify-center text-[var(--err)]">삭제</button>}
              </div>
            )}
            {post.publishedAt && (
              <section aria-labelledby="history-h" className="mt-6 px-1">
                <h2 id="history-h" className="text-[15px] font-bold">수정 이력</h2>
                <ol className="num mt-3 text-[14px] leading-relaxed text-[var(--ink-2)]">
                  {edited && <li className="grid grid-cols-[88px_1fr] gap-2 py-1"><span>{fmtDate(post.updatedAt)}</span><span>마지막 수정</span></li>}
                  <li className="grid grid-cols-[88px_1fr] gap-2 py-1"><span>{fmtDate(post.publishedAt)}</span><span>발행</span></li>
                </ol>
              </section>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
