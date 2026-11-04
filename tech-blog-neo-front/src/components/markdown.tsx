// 글 상세와 에디터 미리보기가 같은 렌더러를 쓴다. raw HTML 은 렌더하지 않는다 (react-markdown 기본값).
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyButton } from "./client";

export type Section = { id: string; title: string };

const headingId = (line?: number) => `h-${line}`;

/** `## ` 제목을 목차로. id 는 렌더러의 h2 와 같은 줄 번호 기반. */
export function sectionsOf(md: string): Section[] {
  const out: Section[] = [];
  let fence = false;
  md.split("\n").forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    const m = !fence && /^##\s+(.+?)\s*#*$/.exec(l);
    if (m) out.push({ id: headingId(i + 1), title: m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[`*_]/g, "") });
  });
  return out;
}

type Hast = { type: string; value?: string; tagName?: string; properties?: { className?: string[] }; children?: Hast[] };
const textOf = (n: Hast): string => n.value ?? (n.children ?? []).map(textOf).join("");

const components: Components = {
  h1: ({ node, children }) => <h2 id={headingId(node?.position?.start.line)} className="mb-5 mt-16 text-[30px] font-extrabold leading-[1.3] tracking-[-0.02em]">{children}</h2>,
  h2: ({ node, children }) => <h2 id={headingId(node?.position?.start.line)} data-section className="mb-5 mt-16 scroll-mt-32 text-[27px] font-extrabold leading-[1.3] tracking-[-0.02em]">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-4 mt-10 text-[21px] font-bold leading-[1.4]">{children}</h3>,
  p: ({ children }) => <p className="mb-6">{children}</p>,
  a: ({ href, children }) => <a href={href} className="ff-link">{children}</a>,
  ul: ({ children }) => <ul className="mb-6 list-disc pl-6 [&_li]:mb-2">{children}</ul>,
  ol: ({ children }) => <ol className="mb-6 list-decimal pl-6 [&_li]:mb-2">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-8 bg-[var(--hover)] px-6 py-5 text-[18px] leading-[1.7] [&>p:last-child]:mb-0">{children}</blockquote>,
  hr: () => <hr className="ff-fold my-12" />,
  // eslint-disable-next-line @next/next/no-img-element -- 본문 이미지 URL
  img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} className="my-8 block w-full" />,
  table: ({ children }) => (
    <div className="mb-8 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[16px] [&_tbody_tr:nth-child(odd)]:bg-[var(--band)]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b-2 border-[var(--line)]">{children}</thead>,
  th: ({ children }) => <th scope="col" className="px-2 py-2 pr-4 font-bold">{children}</th>,
  td: ({ children }) => <td className="px-2 py-2 pr-4">{children}</td>,
  code: ({ children }) => <code className="bg-[var(--band)] px-1.5 py-0.5 text-[0.9em]" style={{ fontFamily: "var(--code)" }}>{children}</code>,
  pre: ({ node }) => {
    const code = (node?.children[0] ?? {}) as Hast;
    const lang = code.properties?.className?.find((c) => c.startsWith("language-"))?.slice(9) ?? "text";
    const text = textOf(code).replace(/\n$/, "");
    return (
      <figure className="ff-code" aria-label={`${lang} 코드`}>
        <div className="ff-code-head">
          <span>{lang}</span>
          <CopyButton text={text} label="코드 복사" done="복사했어요" className="font-medium text-[var(--accent)] hover:underline" />
        </div>
        <pre>
          <code>
            {text.split("\n").map((l, i) => (
              <span key={i} className="ln">
                <span>{i + 1}</span>
                <span>{l || " "}</span>
              </span>
            ))}
          </code>
        </pre>
      </figure>
    );
  },
};

export function Markdown({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{content}</ReactMarkdown>;
}
