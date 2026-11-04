import { Empty, Sheet, SmallFooter } from "@/components/ui";
import { TopNav } from "@/components/top-nav";

export default function NotFound() {
  return (
    <Sheet>
      <TopNav />
      <div className="py-16">
        <Empty title="찾는 페이지가 없습니다." body="주소가 바뀌었거나 아직 발행하지 않은 글일 수 있어요." />
      </div>
      <SmallFooter />
    </Sheet>
  );
}
