import { redirect } from "next/navigation";
import { Suspense } from "react";
import { get, type TagInfo } from "@/lib/api";
import { Empty, Loading, Sheet } from "@/components/ui";
import { TopNav } from "@/components/top-nav";

// 태그 색인 페이지는 디자인에 없다. 글이 가장 많은 태그 페이지로 보낸다 (그 페이지에 "다른 태그" 목록이 있다).
async function ToFirstTag() {
  const tags = (await get<TagInfo[]>("/tags")) ?? [];
  const top = [...tags].sort((a, b) => b.postCount - a.postCount)[0];
  if (top) redirect(`/tags/${top.slug}`);
  return <Empty title="아직 태그가 없습니다." body="글을 쓰면서 태그를 만들어 보세요." />;
}

export default function Tags() {
  return (
    <Sheet>
      <TopNav current="태그" />
      <Suspense fallback={<Loading />}>
        <ToFirstTag />
      </Suspense>
    </Sheet>
  );
}
