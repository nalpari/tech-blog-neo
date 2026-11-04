// 브라우저와 서버 양쪽에서 쓰는 API 타입과 헬퍼. 인증 쿠키 전달은 server-api.ts.
export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const LOGIN_URL = `${API}/auth/google`;

export type Role = "admin" | "author" | "user";
export type Author = { username: string; displayName: string | null; avatarUrl: string | null };
export type Tag = { slug: string; name: string };
export type TagInfo = Tag & { description: string | null; postCount: number };
export type PostSummary = {
  slug: string;
  title: string;
  excerpt: string | null;
  status: "draft" | "published";
  coverImage: string | null;
  coverGradient: string | null;
  featured: boolean;
  readTime: string | null;
  viewCount: number;
  likeCount: number;
  publishedAt: string | null;
  author: Author;
  tags: Tag[];
};
export type PostDetail = PostSummary & { content: string | null; updatedAt: string; liked: boolean };
export type PostList = { total: number; items: PostSummary[]; page: number; limit: number };
export type Profile = Author & { bio: string | null; role: Role; createdAt: string; postCount: number };
export type Me = Author & { id: string; email: string; bio: string | null; role: Role };

export const nameOf = (a: Author) => a.displayName || a.username;

const KST = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" });
/** ISO → 2026.10.28 (KST) */
export const fmtDate = (iso: string | null) => (iso ? KST.format(new Date(iso)).replace(/-/g, ".") : "");

/** 404·401 은 null, 그 밖의 실패는 throw (error.tsx 가 받는다). */
export async function get<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(API + path, init);
  if (res.status === 404 || res.status === 401) return null;
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

/** query 조건의 published 글을 count 개까지 (API limit 상한 50 이라 여러 페이지를 모은다). */
export async function getPosts(query: string, count = Infinity) {
  const page = (n: number) => get<PostList>(`/posts?${query}&limit=50&page=${n}`) as Promise<PostList>;
  const first = await page(1);
  const pages = Math.ceil(Math.min(count, first.total) / 50);
  const rest = await Promise.all(Array.from({ length: Math.max(pages - 1, 0) }, (_, i) => page(i + 2)));
  return { total: first.total, items: [first, ...rest].flatMap((r) => r.items).slice(0, count) };
}

/** 브라우저에서 세션 쿠키를 붙여 쓰기 요청. 401 이면 로그인으로 보낸다. */
export async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- API 서버(외부 origin)의 OAuth 시작점
    window.location.href = LOGIN_URL;
    throw new Error("로그인이 필요합니다.");
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message;
    throw new Error(Array.isArray(msg) ? msg.join(", ") : msg || `요청에 실패했습니다 (${res.status})`);
  }
  return data as T;
}
