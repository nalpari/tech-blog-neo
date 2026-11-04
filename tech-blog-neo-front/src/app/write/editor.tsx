"use client";
import Link from "next/link";
import { useState } from "react";
import { send, type Me, type PostDetail, type TagInfo } from "@/lib/api";
import { Markdown } from "@/components/markdown";
import { Sheet, Wordmark } from "@/components/ui";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// MagicPath 시안에 들어 있던 커버 이미지. 고를 수 있는 기본값으로 둔다.
const ASSETS = "https://storage.googleapis.com/storage.magicpath.ai/component-assets/468569851552747520/468569851552747521";
const COVERS = [
  `${ASSETS}/1adc6bce2de631b88bb4862e332876ef5c105aec20ea6e0ee839209c72034ca4.jpg`,
  `${ASSETS}/0b427a0971f14b54e99af878f1bb6161669d2baf3539d9b786e5be2c62c5a150.jpg`,
  `${ASSETS}/0288bb7d8b0222143f7f93bb178bbab59072b572d117d36ab78d6c3b07457eb9.jpg`,
];

export function Editor({ me, tags: allTags, post }: { me: Me; tags: TagInfo[]; post: PostDetail | null }) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [body, setBody] = useState(post?.content ?? "");
  const [tags, setTags] = useState<string[]>(post?.tags.map((t) => t.slug) ?? []);
  const [cover, setCover] = useState<string | null>(post?.coverImage ?? null);
  const [featured, setFeatured] = useState(post?.featured ?? false);
  const [mode, setMode] = useState<"split" | "write" | "preview">("split");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(post ? "saved" : "idle");
  const [saved, setSaved] = useState<{ slug: string; status: "draft" | "published" } | null>(post && { slug: post.slug, status: post.status });
  const [justPublished, setJustPublished] = useState(false);
  const [tried, setTried] = useState(false);
  const [apiError, setApiError] = useState("");

  // 기존 글과 같은 "N min read" 형식. 500자 ≈ 1분.
  const readTime = `${Math.max(1, Math.round(body.replace(/\s/g, "").length / 500))} min read`;
  const lineCount = body.split("\n").length;
  const errors = {
    title: title.trim() ? "" : "제목을 입력하세요.",
    slug: SLUG_RE.test(slug) ? "" : "영문 소문자, 숫자, 하이픈만 쓸 수 있어요.",
    tags: tags.length ? "" : "태그를 하나 이상 고르세요.",
  };
  const published = saved?.status === "published";

  const touch = () => {
    setSaveState("idle");
    setJustPublished(false);
  };

  const submit = async (status: "draft" | "published") => {
    setTried(true);
    setApiError("");
    if (errors.title || errors.slug || (status === "published" && errors.tags)) return;
    setSaveState("saving");
    try {
      const data = {
        title,
        slug,
        excerpt: excerpt.trim() || null,
        content: body,
        tags,
        coverImage: cover,
        readTime,
        status,
        ...(me.role === "admin" && { featured }),
      };
      const res = saved
        ? await send<PostDetail>("PATCH", `/posts/${encodeURIComponent(saved.slug)}`, data)
        : await send<PostDetail>("POST", "/posts", data);
      setSaved({ slug: res.slug, status: res.status });
      setSaveState("saved");
      setJustPublished(status === "published");
      setTried(false);
      window.history.replaceState(null, "", `/write?slug=${res.slug}`);
    } catch (e) {
      setApiError((e as Error).message);
      setSaveState("idle");
    }
  };

  const toggleTag = (s: string) => {
    touch();
    setTags((t) => (t.includes(s) ? t.filter((x) => x !== s) : [...t, s]));
  };
  const pickCover = (c: string | null) => {
    setCover(c);
    touch();
  };
  const fieldErr = (msg: string, id: string) =>
    tried && msg ? <p id={id} role="alert" className="mt-2 text-[14px] font-medium text-[var(--err)]">{msg}</p> : null;
  const showInvalid = tried && (errors.title || errors.slug || errors.tags);

  return (
    <Sheet className="flex min-w-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-[var(--raised)] px-6 py-3 text-[var(--ink)] md:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[var(--ink-2)]"><Wordmark /></Link>
          <span className="text-[14px] text-[var(--ink-2)]" aria-live="polite">
            {published ? "발행됨" : "초안"}, {saveState === "saving" ? "저장 중…" : saveState === "saved" ? "모두 저장됨" : "저장하지 않은 변경 있음"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!published && (
            <button type="button" onClick={() => submit("draft")} disabled={saveState !== "idle"} className="ff-btn h-10 bg-transparent px-4 text-[14px] text-[var(--ink-2)] hover:bg-[var(--band-deep)]">
              초안 저장
            </button>
          )}
          <button type="button" onClick={() => submit("published")} disabled={saveState === "saving"} className="ff-btn h-10 bg-[var(--accent)] px-5 text-[14px] text-[var(--on-accent)] hover:bg-[var(--accent-hi)]">
            {published ? "수정 발행" : "발행"}
          </button>
        </div>
      </header>

      {justPublished && saved && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 bg-[var(--band)] px-6 py-3 text-[15px] md:px-8">
          <span><b>발행했어요.</b> 홈의 최근 글에 올라갔습니다.</span>
          <Link href={`/posts/${saved.slug}`} className="ff-link">발행한 글 보기</Link>
        </div>
      )}
      {(showInvalid || apiError) && (
        <div role="alert" className="bg-[var(--err-bg)] px-6 py-3 text-[15px] text-[var(--err-ink)] md:px-8">
          {apiError || "저장하려면 표시된 칸을 고쳐주세요."}
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 px-6 pb-12 pt-8 md:px-10">
          <label htmlFor="title" className="sr-only">제목</label>
          <input id="title" value={title} onChange={(e) => { setTitle(e.target.value); touch(); }} placeholder="제목" aria-invalid={tried && !!errors.title} aria-describedby="title-err" className="w-full border-0 bg-transparent text-[34px] font-extrabold leading-tight tracking-[-0.03em] placeholder:text-[var(--muted)] focus:outline-none md:text-[40px]" />
          {fieldErr(errors.title, "title-err")}
          <label htmlFor="excerpt" className="sr-only">요약</label>
          <textarea id="excerpt" rows={2} value={excerpt} onChange={(e) => { setExcerpt(e.target.value); touch(); }} placeholder="목록과 검색 결과에 보일 한두 문장 요약" className="mt-3 w-full resize-none border-0 bg-transparent text-[18px] leading-relaxed text-[var(--ink-2)] placeholder:text-[var(--muted)] focus:outline-none" />

          <div className="mt-6 flex items-center justify-between gap-3 border-t-2 border-dotted border-[var(--line)] pt-4">
            <div role="tablist" aria-label="편집 보기" className="flex gap-1">
              {([["split", "나란히"], ["write", "쓰기"], ["preview", "미리보기"]] as const).map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`h-9 px-3 text-[14px] font-medium ${k === "split" ? "hidden lg:block" : ""} ${mode === k ? "bg-[var(--strong)] text-[var(--on-strong)]" : "hover:bg-[var(--band)]"}`}>
                  {label}
                </button>
              ))}
            </div>
            <span className="num text-[14px] text-[var(--ink-2)]">{lineCount}줄, {readTime}</span>
          </div>

          <div className={`mt-4 grid gap-8 ${mode === "split" ? "lg:grid-cols-2" : ""}`}>
            {mode !== "preview" && (
              <div className="ff-code m-0 flex min-h-[520px]">
                <div aria-hidden="true" className="w-12 shrink-0 select-none pt-3 text-right text-[14px] leading-6 text-[var(--muted)]" style={{ fontFamily: "var(--code)" }}>
                  {Array.from({ length: lineCount }, (_, n) => <div key={n} className="pr-3">{n + 1}</div>)}
                </div>
                <label htmlFor="body" className="sr-only">본문 (마크다운)</label>
                <textarea id="body" value={body} onChange={(e) => { setBody(e.target.value); touch(); }} placeholder="## 첫 제목부터 마크다운으로 쓰세요" spellCheck={false} wrap="off" className="min-h-[520px] w-full resize-none overflow-x-auto whitespace-pre border-0 bg-[repeating-linear-gradient(to_bottom,var(--band)_0,var(--band)_72px,transparent_72px,transparent_144px)] bg-[length:100%_144px] bg-local px-3 pt-3 text-[14px] leading-6 focus:outline-none" style={{ fontFamily: "var(--code)", backgroundPositionY: "12px" }} />
              </div>
            )}
            {mode !== "write" && (
              <section aria-label="미리보기" className="min-w-0">
                <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em]">{title || "제목 없음"}</h1>
                <p className="mb-2 mt-3 text-[17px] text-[var(--ink-2)]">{excerpt}</p>
                <div className="text-[17px] leading-[1.8]"><Markdown content={body} /></div>
              </section>
            )}
          </div>
        </main>

        <aside aria-label="글 설정" className="bg-[var(--hover)] px-6 py-8">
          <h2 className="text-[17px] font-bold">글 설정</h2>

          <div className="mt-6">
            <label htmlFor="slug" className="text-[14px] font-semibold">주소</label>
            <div className="mt-2 flex items-center bg-[var(--raised)] text-[15px]">
              <span className="pl-3 text-[var(--muted)]">/posts/</span>
              <input id="slug" value={slug} onChange={(e) => { setSlug(e.target.value); touch(); }} placeholder="my-first-post" aria-invalid={tried && !!errors.slug} aria-describedby="slug-err" className="h-10 min-w-0 flex-1 border-0 bg-transparent pr-3 focus:outline-none" />
            </div>
            {fieldErr(errors.slug, "slug-err")}
          </div>

          <fieldset className="mt-6">
            <legend className="text-[14px] font-semibold">태그</legend>
            <div className="mt-2 flex flex-wrap gap-1">
              {allTags.map((t) => (
                <button key={t.slug} type="button" aria-pressed={tags.includes(t.slug)} onClick={() => toggleTag(t.slug)} className={`h-9 px-3 text-[14px] font-medium ${tags.includes(t.slug) ? "bg-[var(--strong)] text-[var(--on-strong)]" : "bg-[var(--raised)] hover:bg-[var(--band)]"}`}>
                  {t.name}
                </button>
              ))}
            </div>
            {fieldErr(errors.tags, "tags-err")}
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-[14px] font-semibold">커버</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {COVERS.map((c, n) => (
                <button key={c} type="button" aria-pressed={cover === c} aria-label={`커버 이미지 ${n + 1}`} onClick={() => pickCover(c)} className={`block outline-offset-2 ${cover === c ? "outline outline-2 outline-[var(--accent)]" : "opacity-80 hover:opacity-100"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 외부 커버 URL */}
                  <img src={c} alt="" className="block aspect-[4/3] w-full object-cover" />
                </button>
              ))}
              <button type="button" aria-pressed={cover === null} aria-label="기본 커버 이미지" onClick={() => pickCover(null)} className={`block outline-offset-2 ${cover === null ? "outline outline-2 outline-[var(--accent)]" : "opacity-80 hover:opacity-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- 정적 기본 커버 */}
                <img src="/default-cover.jpg" alt="" className="block aspect-[4/3] w-full object-cover" />
              </button>
            </div>
            <label htmlFor="cover-url" className="mt-3 block text-[13px] text-[var(--ink-2)]">또는 이미지 주소</label>
            <input id="cover-url" type="url" placeholder="https://" value={cover && !COVERS.includes(cover) ? cover : ""} onChange={(e) => pickCover(e.target.value || null)} className="mt-1 h-10 w-full border-0 bg-[var(--raised)] px-3 text-[15px]" />
          </fieldset>

          <div className="mt-6">
            <span className="text-[14px] font-semibold">피처드</span>
            {me.role === "admin" ? (
              <label className="mt-2 flex items-center gap-2 text-[14px]">
                <input type="checkbox" checked={featured} onChange={(e) => { setFeatured(e.target.checked); touch(); }} className="h-4 w-4 accent-[var(--accent)]" />
                홈 맨 위에 걸기
              </label>
            ) : (
              <p className="mt-1 text-[14px] leading-relaxed text-[var(--ink-2)]">홈 맨 위에 걸 글은 관리자만 고를 수 있어요.</p>
            )}
          </div>

          <dl className="num mt-6 grid grid-cols-2 gap-y-2 text-[14px]">
            <dt className="text-[var(--ink-2)]">읽는 시간</dt><dd className="text-right">{readTime}</dd>
            <dt className="text-[var(--ink-2)]">상태</dt><dd className="text-right">{published ? "발행됨" : "초안"}</dd>
          </dl>
        </aside>
      </div>
    </Sheet>
  );
}
