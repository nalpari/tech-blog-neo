"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Sprocket rail: holes advance one pitch at a time as the reader scrolls. */
export function Rail({ side }: { side: "left" | "right" }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const read = () => setStep(window.scrollY % 36);
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
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
