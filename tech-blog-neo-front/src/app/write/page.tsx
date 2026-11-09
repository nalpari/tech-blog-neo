import { notFound } from "next/navigation";
import { Suspense } from "react";
import { get, loginUrl, type Me, type PostDetail, type TagInfo } from "@/lib/api";
import { getAuthed } from "@/lib/server-api";
import { Loading, Sheet, Wordmark } from "@/components/ui";
import { TopNav } from "@/components/top-nav";
import { Editor } from "./editor";

/** Google 브랜드 버튼. 공식 G 로고 + 흰 배경 (brand guidelines: 흰 배경, #1f1f1f 텍스트, G 로고 20px). */
function GoogleButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="mt-8 flex h-12 w-full items-center justify-center gap-3 bg-white text-[15px] font-medium text-[#1f1f1f] shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-colors hover:bg-[#f1f3f4] active:bg-[#e8eaed]"
    >
      <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      Google로 로그인
    </a>
  );
}

function Gate({ title, body, href, cta, google = false }: { title: string; body: string; href: string; cta: string; google?: boolean }) {
  return (
    <Sheet>
      <TopNav />
      <div className="mx-6 mt-16 max-w-[520px] bg-[var(--band)] px-6 py-12 md:mx-auto md:mt-24 md:px-12">
        <Wordmark />
        <h1 className="mt-6 text-[24px] font-extrabold tracking-[-0.02em]">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-2)]">{body}</p>
        {google ? <GoogleButton href={href} /> : <a href={href} className="ff-btn primary mt-6">{cta}</a>}
      </div>
    </Sheet>
  );
}

async function WriteContent({ searchParams }: Pick<PageProps<"/write">, "searchParams">) {
  const { slug } = await searchParams;
  const here = typeof slug === "string" ? `/write?slug=${encodeURIComponent(slug)}` : "/write";
  // S3 조회가 실패해도 에디터는 열고, 커버는 기본 이미지와 직접 입력으로 고른다.
  const [me, tags, covers] = await Promise.all([getAuthed<Me>("/auth/me"), get<TagInfo[]>("/tags"), getAuthed<string[]>("/covers").catch(() => null)]);
  if (!me) return <Gate google title="로그인이 필요해요" body="팀원 Google 계정으로 로그인하면 글을 쓸 수 있습니다." href={loginUrl(here)} cta="Google로 로그인" />;
  if (me.role === "user") return <Gate title="글쓰기 권한이 없어요" body="저자 권한은 관리자가 줍니다. 관리자에게 요청하세요." href="/" cta="글 목록으로" />;
  const post = typeof slug === "string" ? await getAuthed<PostDetail>(`/posts/${encodeURIComponent(slug)}`) : null;
  if (typeof slug === "string" && !post) notFound();
  return <Editor key={post?.slug ?? "new"} me={me} tags={tags ?? []} covers={covers ?? []} post={post} />;
}

export default function WritePage(props: PageProps<"/write">) {
  return (
    <Suspense fallback={<Sheet><Loading label="에디터를 여는 중…" /></Sheet>}>
      <WriteContent searchParams={props.searchParams} />
    </Suspense>
  );
}
