// "[다크] 태그·저자 페이지" 공용 조각.
import Link from "next/link";
import type { ReactNode } from "react";
import { fmtDate, nameOf, type PostSummary } from "@/lib/api";
import { SortSelect } from "./client";
import { Empty } from "./ui";

export function Stats({ items }: { items: [string, string][] }) {
  return (
    <dl className="num grid grid-cols-2 gap-px bg-[var(--band-deep)] text-[15px]">
      {items.map(([dt, dd]) => (
        <div key={dt} className="bg-[var(--band)] p-5">
          <dt className="text-[var(--ink-2)]">{dt}</dt>
          <dd className="mt-1 text-[32px] font-extrabold tracking-[-0.02em]">{dd}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OthersNav({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-x-1 gap-y-2 px-6 pb-10 md:px-12">
      <span className="mr-3 self-center text-[15px] text-[var(--ink-2)]">{label}</span>
      {children}
    </nav>
  );
}

export const chip = (active: boolean) =>
  `inline-flex h-9 items-center px-3 text-[14px] font-medium ${active ? "bg-[var(--strong)] text-[var(--on-strong)]" : "bg-[var(--band)] hover:bg-[var(--band-deep)]"}`;

export function PostListing({ title, posts, sort, showAuthor }: { title: string; posts: PostSummary[]; sort: "latest" | "popular"; showAuthor: boolean }) {
  return (
    <section aria-labelledby="list-h" className="pb-20 pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-6 md:px-12">
        <h2 id="list-h" className="text-[28px] font-extrabold tracking-[-0.02em]">{title}</h2>
        <SortSelect value={sort} />
      </div>
      {posts.length > 0 ? (
        <ul key={sort} className="ff-printing">
          {posts.map((p, i) => (
            <li key={p.slug} style={{ animationDelay: `${Math.min(i, 10) * 70}ms` }}>
              <Link href={`/posts/${p.slug}`} className={`group grid gap-x-6 gap-y-1 px-6 py-5 md:grid-cols-[96px_minmax(0,1fr)_150px_80px] md:items-center md:px-12 ${i % 2 === 0 ? "bg-[var(--band)] hover:bg-[var(--band-deep)]" : "hover:bg-[var(--hover)]"}`}>
                <span className="num text-[15px] text-[var(--ink-2)]">{fmtDate(p.publishedAt)}</span>
                <span className="min-w-0">
                  <span className="block text-[19px] font-bold leading-snug group-hover:text-[var(--accent)] group-hover:underline group-hover:underline-offset-4">{p.title}</span>
                  {p.excerpt && <span className="mt-1 block max-w-[62ch] text-[15px] leading-relaxed text-[var(--ink-2)]">{p.excerpt}</span>}
                </span>
                <span className="text-[15px] text-[var(--ink-2)]">{showAuthor ? nameOf(p.author) : p.tags.map((t) => t.name).join(", ")}</span>
                <span className="num text-[14px] text-[var(--ink-2)] md:text-right">{p.readTime}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="아직 발행한 글이 없습니다." body="다른 주제의 글을 둘러보세요." />
      )}
    </section>
  );
}

export const sortOf = (v: unknown) => (v === "popular" ? "popular" : "latest");
