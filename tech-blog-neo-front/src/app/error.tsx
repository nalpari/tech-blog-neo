"use client";
import { Sheet, TopNavLinks } from "@/components/ui";

export default function Error({ retry }: { error: Error; retry: () => void }) {
  return (
    <Sheet>
      <TopNavLinks />
      <div role="alert" className="mx-6 mt-16 bg-[var(--err-bg)] px-6 py-12 text-[var(--err-ink)] md:mx-12">
        <p className="text-[19px] font-bold">글을 불러오지 못했습니다.</p>
        <p className="mt-2 text-[15px]">API 서버가 응답하지 않습니다. 잠시 뒤 다시 시도하세요.</p>
        <button type="button" onClick={retry} className="ff-btn primary mt-6">다시 시도</button>
      </div>
    </Sheet>
  );
}
