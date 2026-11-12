import { NewPostsCarousel } from "@/widgets/new-posts-carousel/NewPostsCarousel";
import { RecentlyRead } from "@/widgets/recently-read/RecentlyRead";
import { PostGrid } from "@/widgets/post-grid";
import { PostExplorer } from "@/widgets/post-explorer/PostExplorer";
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
      <PostGrid title="Latest posts" limit={24} contentTree={contentTree} />
      <nav aria-label="분야별 글 목록" className="flex flex-wrap gap-2">
        {contentTree
          .filter((node) => node.type === "folder")
          .map((folder) => (
            <a
              key={folder.path}
              href={`/blog${folder.path}`}
              className="rounded-full border border-foreground/15 px-3 py-1.5 text-sm hover:border-foreground/40"
            >
              {folder.name}
            </a>
          ))}
      </nav>
      <PostExplorer contentTree={contentTree} />
    </>
  );
}
