import { NewPostsCarousel } from "@/widgets/new-posts-carousel/NewPostsCarousel";
import { RecentlyRead } from "@/widgets/recently-read/RecentlyRead";
import { PostGrid } from "@/widgets/post-grid";
import type { Metadata } from "vinext/shims/metadata";
import { buildBlogIndexMetadata } from "@/shared/seo/metadata";

export const metadata: Metadata = buildBlogIndexMetadata();

export default function BlogPage() {
  return (
    <>
      <NewPostsCarousel />
      <RecentlyRead />
      <PostGrid title="All posts" />
    </>
  );
}
