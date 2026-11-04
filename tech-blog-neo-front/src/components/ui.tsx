// MagicPath "[다크]" 시리즈의 shared.tsx 를 실제 데이터용으로 옮긴 것.
import Link from "next/link";
import type { ReactNode } from "react";
import { nameOf, type Author, type Me, type PostSummary } from "@/lib/api";
import { Rail } from "./client";
import { UserMenu } from "./user-menu";
import { DotmSquare18 } from "./ui/dotm-square-18";

export function Sheet({ children, className = "min-w-0" }: { children: ReactNode; className?: string }) {
  return (
    <div className="ff">
      <div className="ff-sheet">
        <Rail side="left" />
        <div className={className}>{children}</div>
        <Rail side="right" />
      </div>
    </div>
  );
}

export function Avatar({ author, size = 32 }: { author: Author; size?: number }) {
  if (author.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- 외부 아바타 URL
    return <img src={author.avatarUrl} alt="" aria-hidden="true" width={size} height={size} className="block shrink-0 object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.42 }} className="inline-flex shrink-0 items-center justify-center bg-[#1e2f4f] font-semibold text-[#cfe0ff]">
      {nameOf(author).slice(0, 1)}
    </span>
  );
}

export function Wordmark({ size = "small" }: { size?: "small" | "large" }) {
  return (
    <span
      className={size === "large" ? "block font-extrabold tracking-[-0.045em] leading-[0.9]" : "font-extrabold tracking-[-0.03em]"}
      style={size === "large" ? { fontSize: "clamp(3.25rem, 8vw, 7.5rem)" } : { fontSize: 22 }}
    >
      interplug tech
    </span>
  );
}

const NAV = [
  ["글", "/"],
  ["태그", "/tags"],
  ["저자", "/authors"],
] as const;

export function TopNavLinks({ current, user }: { current?: "글" | "태그" | "저자"; user?: Me | null }) {
  return (
    <nav aria-label="주요 메뉴" className="flex items-center justify-between gap-6 px-6 py-4 md:px-12">
      <Link href="/" aria-label="interplug tech 홈"><Wordmark /></Link>
      <div className="flex items-center gap-1 md:gap-2">
        {NAV.map(([it, href]) => (
          <Link key={it} href={href} aria-current={current === it ? "page" : undefined} className={`hidden px-3 py-2 text-[15px] font-medium sm:inline-block ${current === it ? "bg-[var(--band-deep)] text-[var(--ink)]" : "text-[var(--ink-2)] hover:bg-[var(--band)] hover:text-[var(--ink)]"}`}>
            {it}
          </Link>
        ))}
        <Link href="/write" className="ff-btn primary ml-2 h-10 px-4 text-[14px]">글쓰기</Link>
        {user && <UserMenu me={user} />}
      </div>
    </nav>
  );
}

export function SmallFooter() {
  return (
    <footer className="flex flex-col justify-between gap-3 bg-[var(--deep)] px-6 py-8 text-[15px] text-[var(--ink-2)] md:flex-row md:px-12">
      <Link href="/" className="font-extrabold tracking-[-0.03em] text-[var(--ink)]">interplug tech</Link>
      <span>© 2026 interplug</span>
    </footer>
  );
}

/** 커버 이미지 → 그라디언트 → 기본 커버 이미지 순으로 대체. */
export function Cover({ post, className }: { post: PostSummary; className: string }) {
  if (post.coverGradient && !post.coverImage) {
    return <span className={`block ${className}`} style={{ background: post.coverGradient }} />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- 외부 커버 URL
  return <img src={post.coverImage ?? "/default-cover.jpg"} alt="" className={`block object-cover ${className}`} />;
}

export function Loading({ label = "불러오는 중…", inline = false }: { label?: string; inline?: boolean }) {
  const body = (
    <>
      {/* Dot Matrix 레지스트리의 Sound Bars(dotm-square-18) */}
      <DotmSquare18 size={44} color="var(--ink)" ariaLabel={label} />
      <span className="text-[15px] text-[var(--ink-2)]">{label}</span>
    </>
  );
  if (inline) {
    // 특정 요소를 불러오는 동안 해당 요소 자리에 표시
    return <div role="status" className="flex items-center justify-center gap-3 px-6 py-16 md:px-12">{body}</div>;
  }
  // 페이지 로딩: 화면 정중앙에 레이어로 표시
  return <div role="status" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0f1419]/80">{body}</div>;
}

export function Empty({ title, body, href = "/", cta = "전체 글 보기" }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="mx-6 mt-4 bg-[var(--band)] px-6 py-12 md:mx-12">
      <p className="text-[19px] font-bold">{title}</p>
      <p className="mt-2 text-[15px] text-[var(--ink-2)]">{body}</p>
      <Link href={href} className="ff-btn primary mt-6">{cta}</Link>
    </div>
  );
}
