import { NewPostsCarousel } from "@/widgets/new-posts-carousel/NewPostsCarousel";
import { RecentlyRead } from "@/widgets/recently-read/RecentlyRead";
import { PostExplorer } from "@/widgets/post-explorer/PostExplorer";

export default function BlogPage() {
  return (
    <>
      <NewPostsCarousel />
      <RecentlyRead />
      <PostExplorer />
    </>
  );
}
