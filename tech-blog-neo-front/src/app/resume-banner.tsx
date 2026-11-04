"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { readResume, writeResume } from "@/lib/resume";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

export function ResumeBanner() {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem("ff-resume"), () => null);
  const [closed, setClosed] = useState(false);
  const r = raw && !closed ? readResume() : null;
  if (!r) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-[var(--raised)] px-6 py-3 text-[15px] text-[var(--ink)] md:px-12">
      <span className="font-semibold">읽던 글이 있어요</span>
      <span className="min-w-0 flex-1 text-[var(--ink-2)]">{r.title}, {r.progress}% 지점에서 멈춤</span>
      <Link href={`/posts/${r.slug}`} className="ff-btn h-9 bg-[var(--accent)] px-4 text-[14px] text-[var(--on-accent)] hover:bg-[var(--accent-hi)]">이어 읽기</Link>
      <button
        type="button"
        onClick={() => {
          writeResume(null);
          setClosed(true);
        }}
        className="ff-btn h-9 bg-transparent px-3 text-[14px] text-[var(--ink-2)] hover:text-[var(--ink)]"
      >
        닫기
      </button>
    </div>
  );
}
