import { redirect } from "next/navigation";
import { Suspense } from "react";
import { get, type PostList } from "@/lib/api";
import { Empty, Loading, Sheet } from "@/components/ui";
import { TopNav } from "@/components/top-nav";

// 저자 색인 페이지는 디자인에 없다. 최근 글의 저자 페이지로 보낸다 (그 페이지에 "다른 저자" 목록이 있다).
async function ToFirstAuthor() {
  const latest = (await get<PostList>("/posts?limit=1"))?.items[0];
  if (latest) redirect(`/authors/${latest.author.username}`);
  return <Empty title="아직 발행한 글이 없습니다." body="첫 글을 써 보세요." href="/write" cta="글쓰기" />;
}

export default function Authors() {
  return (
    <Sheet>
      <TopNav current="저자" />
      <Suspense fallback={<Loading />}>
        <ToFirstAuthor />
      </Suspense>
    </Sheet>
  );
}
