import { NewPostsCarousel } from "@/widgets/new-posts-carousel/NewPostsCarousel";
import { RecentlyRead } from "@/widgets/recently-read/RecentlyRead";
import { PostGrid } from "@/widgets/post-grid";
import type { Metadata } from "vinext/shims/metadata";
import { buildBlogIndexMetadata } from "@/shared/seo/metadata";
import { getContentTree } from "@/shared/config";

export const metadata: Metadata = buildBlogIndexMetadata();

export default async function BlogPage() {
  const contentTree = await getContentTree();
  return (
    <>
      <NewPostsCarousel contentTree={contentTree} />
      <RecentlyRead contentTree={contentTree} />
      <PostGrid title="All posts" contentTree={contentTree} />
    </>
  );
}
