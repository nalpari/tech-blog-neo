import { Suspense } from "react";
import { TopNavLinks } from "./ui";
import { getAuthed } from "@/lib/server-api";
import type { Me } from "@/lib/api";

async function TopNavUser({ current }: { current?: "글" | "태그" | "저자" }) {
  let user: Me | null = null;
  try {
    user = await getAuthed<Me>("/auth/me");
  } catch {
    // API 가 내려가 있어도 네비는 떠야 한다 (error 화면에서도 쓰인다)
  }
  return <TopNavLinks current={current} user={user} />;
}

/** 로그인 유저의 아바타를 네비에 붙인다 (error.tsx 같은 클라이언트 페이지는 TopNavLinks 사용). */
export function TopNav({ current }: { current?: "글" | "태그" | "저자" }) {
  // 셸 정적 prerender 를 위해 동적 조회는 Suspense 안에 둔다 (fallback: 아바타 없는 네비)
  return (
    <Suspense fallback={<TopNavLinks current={current} />}>
      <TopNavUser current={current} />
    </Suspense>
  );
}
