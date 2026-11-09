"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Sprocket rail: holes advance one pitch at a time as the reader scrolls. */
export function Rail({ side }: { side: "left" | "right" }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    // 프레임당 한 번만 갱신한다. 값이 같으면 React 가 다시 그리지 않는다.
    let frame = 0;
    const read = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          setStep(Math.round(window.scrollY) % 36);
        });
    };
    window.addEventListener("scroll", read, { passive: true });
    return () => {
      window.removeEventListener("scroll", read);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className={`ff-rail ${side}`} aria-hidden="true">
      <div className="ff-rail-holes" style={{ transform: `translateY(${-step}px)` }} />
    </div>
  );
}

/** ?sort= 를 바꾸는 정렬 선택. 서버 컴포넌트가 searchParams 로 다시 그린다. */
export function SortSelect({ value }: { value: "latest" | "popular" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[14px]">
      <span className="text-[var(--ink-2)]">정렬</span>
      <select
        value={value}
        onChange={(e) => {
          const q = new URLSearchParams(params);
          q.set("sort", e.target.value);
          q.delete("limit");
          router.replace(`${pathname}?${q}`, { scroll: false });
        }}
        className="h-9 border-0 bg-[var(--band)] px-3 text-[14px] font-medium"
      >
        <option value="latest">최신순</option>
        <option value="popular">많이 읽은 순</option>
      </select>
    </label>
  );
}

export function CopyButton({ text, label, done, className }: { text: string | (() => string); label: string; done: string; className: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof text === "string" ? text : text());
    } catch {
      /* 클립보드 권한이 없으면 표시만 바꾼다 */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button type="button" onClick={copy} className={className} aria-live="polite">
      {copied ? done : label}
    </button>
  );
}

/** 마운트될 때 id 요소로 스크롤. 검색 결과가 스트리밍으로 늦게 그려져 #hash 스크롤이 빗나가는 걸 메운다. */
export function ScrollTo({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView();
  }, [id]);
  return null;
}

/** 헤더의 검색 버튼. 누르면 검색 레이어(<dialog>)가 뜨고, 제출하면 홈의 글 목록을 ?q= 로 거른다. */
export function SearchButton() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label="검색" className="inline-flex h-10 w-10 items-center justify-center text-[var(--ink-2)] hover:bg-[var(--band)] hover:text-[var(--ink)]">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        aria-label="글 검색"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="mx-auto mt-[12vh] w-[min(560px,calc(100%-2rem))] bg-[var(--band)] p-0 text-[var(--ink)] backdrop:bg-black/60"
      >
        <form
          role="search"
          action="/"
          onSubmit={(e) => {
            e.preventDefault();
            const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
            dialog.current?.close();
            router.push(q ? `/?${new URLSearchParams({ q })}#recent` : "/");
          }}
          className="flex gap-2 p-4"
        >
          <label htmlFor="site-search" className="sr-only">제목·요약 검색</label>
          <input id="site-search" name="q" type="search" placeholder="제목·요약 검색" className="h-11 min-w-0 flex-1 border-0 bg-[var(--band-deep)] px-4 text-[16px]" />
          <button type="submit" className="ff-btn primary h-11 shrink-0 px-5 text-[15px]">검색</button>
        </form>
      </dialog>
    </>
  );
}
