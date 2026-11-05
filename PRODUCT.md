# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- 외부 개발자: 검색이나 공유 링크로 들어와 기술 글을 읽는다. interplug의 기술 역량을 접하는 첫 지점이다.
- interplug 팀원: 사내 지식을 공유하고 찾아 읽는다.
- 둘 다 주 독자다. 사내 공유와 외부 공개를 한 블로그에서 함께 한다.

## Product Purpose
interplug 팀의 테크블로그. 팀원 여러 명이 글을 쓰고, 사내와 외부 독자가 함께 읽는다. 다루는 주제는 미래 기술, AI, 코딩이다.

## Operating Context
- 저자: Google 로그인을 한 팀원 여러 명. 글마다 저자 프로필(username, displayName, avatar)이 노출된다.
- 역할: admin, author, user. 글쓰기는 admin과 author만 할 수 있고, 프로필 역할은 admin이 바꾼다.
- 독자 행동: 글 목록과 태그 탐색, 글 읽기, 좋아요. 조회수가 집계된다.

## Capabilities and Constraints
- API: NestJS/PostgreSQL (`tech-blog-neo-api`). 글, 태그, 프로필, S3 커버 이미지 목록, Google OAuth 세션.
- 글 필드: slug, title, excerpt, markdown content, coverImage 또는 coverGradient, status(draft/published), featured, readTime, publishedAt, viewCount, likeCount, author, tags.
- 프론트엔드: Next.js (`tech-blog-neo-front`). 글 목록·글·태그·저자 페이지와 글쓰기 에디터가 API와 연동되어 있다.
- 본문은 markdown이다.

## Brand Commitments
- 이름: interplug 테크블로그 (정식 블로그명은 미정).
- 사용자가 제시한 분위기: 미래 기술, AI, 코딩.

## Evidence on Hand
- 실제 글 콘텐츠, 로고, 브랜드 자산은 저장소에 없다. 시안에 가짜 실적, 수치, 추천사를 만들어 넣지 않는다.

## Product Principles
- 읽기가 우선이다. 긴 기술 글과 코드 블록이 편하게 읽혀야 한다.
- 여러 저자의 글이 한 목소리로 보이되, 저자는 드러난다.
- 외부 독자에게는 팀의 기술 수준을 보여주는 첫인상이 된다.
