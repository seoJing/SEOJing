import { Subtitle } from "@app/ui";
import type { ContentNode } from "@app/utils";
import contentTree from "@/generated/content-tree.json";
import {
  getAllPosts,
  getSubTree,
} from "@/widgets/new-posts-carousel/new-posts-carousel.utils";
import { PostCoverCard } from "./PostCoverCard";

interface PostGridProps {
  rootPath?: string;
  title?: string;
  limit?: number;
}

export function PostGrid({
  rootPath = "/",
  title = "대표 이미지로 보기",
  limit,
}: PostGridProps) {
  const subTree = getSubTree(contentTree as ContentNode[], rootPath);
  const posts = getAllPosts(subTree);
  const visiblePosts =
    typeof limit === "number" ? posts.slice(0, limit) : posts;

  if (visiblePosts.length === 0) return null;

  return (
    <section className="flex flex-col gap-4" data-presentation-skip>
      <div className="flex items-end justify-between gap-4">
        <Subtitle>{title}</Subtitle>
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          {visiblePosts.length} posts · latest first
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-1.5 lg:gap-2">
        {visiblePosts.map((post, index) => (
          <PostCoverCard key={post.href} post={post} priority={index < 6} />
        ))}
      </div>
    </section>
  );
}
