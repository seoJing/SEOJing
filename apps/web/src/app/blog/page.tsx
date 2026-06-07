import { NewPostsCarousel } from "@/widgets/new-posts-carousel/NewPostsCarousel";
import { RecentlyRead } from "@/widgets/recently-read/RecentlyRead";
import { PostExplorer } from "@/widgets/post-explorer/PostExplorer";
import type { Metadata } from "vinext/shims/metadata";
import { buildBlogIndexMetadata } from "@/shared/seo/metadata";

export const metadata: Metadata = buildBlogIndexMetadata();

export default function BlogPage() {
  return (
    <>
      <NewPostsCarousel />
      <RecentlyRead />
      <PostExplorer />
    </>
  );
}
