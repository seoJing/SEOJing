import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { ArticleHeader, Paper } from "@app/ui";
import {
  getContentBySlug,
  isContentFolder,
  calculateReadingTime,
} from "@app/utils";
import { CONTENT_DIR } from "@/shared/config";
import { mdxComponents } from "@/widgets/mdx-renderer/MdxRenderer";
import { NewPostsCarousel } from "@/widgets/new-posts-carousel/NewPostsCarousel";
import { RecentlyRead } from "@/widgets/recently-read/RecentlyRead";
import { PostExplorer } from "@/widgets/post-explorer/PostExplorer";
import { ArticleToolbar } from "@/widgets/article-toolbar/ArticleToolbar";

interface BlogPostPageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  if (isContentFolder(CONTENT_DIR, slug)) {
    const rootPath = `/${slug.join("/")}`;
    return (
      <>
        <NewPostsCarousel rootPath={rootPath} />
        <RecentlyRead rootPath={rootPath} />
        <PostExplorer rootPath={rootPath} />
      </>
    );
  }

  const content = getContentBySlug(CONTENT_DIR, slug);

  if (!content) {
    notFound();
  }

  return (
    <div className="relative min-h-[calc(100vh-25rem)]">
      <Paper>
        <ArticleHeader
          title={content.frontmatter.title}
          date={content.frontmatter.date}
          tags={content.frontmatter.tags}
          readingTime={calculateReadingTime(content.source)}
        />
        <MDXRemote source={content.source} components={mdxComponents} />
        <ArticleToolbar
          slug={slug.join("/")}
          title={content.frontmatter.title}
        />
      </Paper>
    </div>
  );
}
