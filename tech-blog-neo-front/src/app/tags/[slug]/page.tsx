import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { get, getPosts, type TagInfo } from "@/lib/api";
import { OthersNav, PostListing, Stats, chip, sortOf } from "@/components/listing";
import { Loading, Sheet, SmallFooter } from "@/components/ui";
import { TopNav } from "@/components/top-nav";

async function TagContent({ params, searchParams }: PageProps<"/tags/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const sort = sortOf(sp.sort);
  const [tags, posts] = await Promise.all([get<TagInfo[]>("/tags"), getPosts(new URLSearchParams({ tag: slug, sort }).toString())]);
  const tag = tags?.find((t) => t.slug === slug);
  if (!tag) notFound();
  return (
    <>
      <header className="grid gap-8 px-6 pb-12 pt-12 md:px-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
        <div className="min-w-0">
          <h1 className="break-words font-extrabold leading-[0.92] tracking-[-0.045em]" style={{ fontSize: "clamp(4rem, 11vw, 9rem)" }}>{tag.name}</h1>
          {tag.description && <p className="mt-6 max-w-[44ch] text-[20px] leading-[1.55]">{tag.description}</p>}
        </div>
        <Stats items={[["글", `${posts.total}편`], ["쓴 사람", `${new Set(posts.items.map((p) => p.author.username)).size}명`]]} />
      </header>
      <OthersNav label="다른 태그">
        {tags!.map((t) => (
          <Link key={t.slug} href={`/tags/${t.slug}`} aria-current={t.slug === slug ? "page" : undefined} className={chip(t.slug === slug)}>{t.name}</Link>
        ))}
      </OthersNav>
      <hr className="ff-fold" />
      <PostListing title={`${tag.name} 글`} posts={posts.items} sort={sort} showAuthor />
    </>
  );
}

export default function TagPage(props: PageProps<"/tags/[slug]">) {
  return (
    <Sheet>
      <TopNav current="태그" />
      <Suspense fallback={<Loading />}>
        <TagContent {...props} />
      </Suspense>
      <SmallFooter />
    </Sheet>
  );
}
