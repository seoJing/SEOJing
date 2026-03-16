import { notFound } from "next/navigation";
import { ArticleHeader, Paper } from "@app/ui";
import { calculateReadingTime } from "@app/utils";
import { isSlugFolder, loadContent } from "@/shared/config";
import { mdxComponents } from "@/widgets/mdx-renderer/MdxRenderer";
import type { MDXComponents } from "mdx/types";
import { NewPostsCarousel } from "@/widgets/new-posts-carousel/NewPostsCarousel";
import { RecentlyRead } from "@/widgets/recently-read/RecentlyRead";
import { PostExplorer } from "@/widgets/post-explorer/PostExplorer";
import { ArticleToolbar } from "@/widgets/article-toolbar/ArticleToolbar";

interface BlogPostPageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  if (isSlugFolder(slug)) {
    const rootPath = `/${slug.join("/")}`;
    return (
      <>
        <NewPostsCarousel rootPath={rootPath} />
        <RecentlyRead rootPath={rootPath} />
        <PostExplorer rootPath={rootPath} />
      </>
    );
  }

  const content = await loadContent(slug);

  if (!content) {
    notFound();
  }

  const MDXContent = content.compiled.default;

  return (
    <div className="relative min-h-[calc(100vh-25rem)]">
      <Paper>
        <ArticleHeader
          title={content.frontmatter.title}
          date={content.frontmatter.date}
          tags={content.frontmatter.tags}
          readingTime={calculateReadingTime(content.source)}
        />
        <MDXContent components={mdxComponents as MDXComponents} />
        <ArticleToolbar
          slug={slug.join("/")}
          title={content.frontmatter.title}
        />
      </Paper>
    </div>
  );
}
