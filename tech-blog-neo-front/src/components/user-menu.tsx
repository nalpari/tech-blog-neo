"use client";
import { Avatar } from "./ui";
import { nameOf, send, type Me } from "@/lib/api";

/** 아바타를 누르면 나오는 메뉴. 유일한 항목은 로그아웃. */
export function UserMenu({ me }: { me: Me }) {
  return (
    <details className="relative">
      <summary title={nameOf(me)} className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <Avatar author={me} size={32} />
      </summary>
      <div className="absolute right-0 top-full z-10 mt-2 min-w-32 border border-[var(--band-deep)] bg-[var(--band)] py-1">
        <button
          type="button"
          onClick={() => send("POST", "/auth/logout").then(() => window.location.reload())}
          className="block w-full px-4 py-2 text-left text-[14px] text-[var(--ink-2)] hover:bg-[var(--band-deep)] hover:text-[var(--ink)]"
        >
          로그아웃
        </button>
      </div>
    </details>
  );
}
