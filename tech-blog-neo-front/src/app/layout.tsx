import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "interplug tech",
  description: "interplug 팀이 AI, 미래 기술, 코드를 직접 다루며 배운 것을 씁니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/joungkyun/font-d2coding/d2coding.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
