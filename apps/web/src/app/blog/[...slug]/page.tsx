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
import type { Metadata } from "vinext/shims/metadata";
import {
  buildArticleMetadata,
  buildFolderMetadata,
} from "@/shared/seo/metadata";
import { firstParagraphDescription } from "@/shared/seo/content";
import { articleJsonLd, breadcrumbJsonLd, JsonLd } from "@/shared/seo/json-ld";

interface BlogPostPageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (isSlugFolder(slug)) {
    return buildFolderMetadata(slug);
  }

  const content = await loadContent(slug);

  if (!content) {
    return {
      title: "글을 찾을 수 없습니다",
      robots: { index: false, follow: false },
    };
  }

  return buildArticleMetadata(slug, content.frontmatter, content.source);
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;

  if (isSlugFolder(slug)) {
    const rootPath = `/${slug.join("/")}`;

    return (
      <>
        <JsonLd data={breadcrumbJsonLd(slug)} />
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
  const wayFindingPath = `/blog/${slug.join("/")}`;
  const rootPath = `/${slug.slice(0, -1).join("/")}`;
  const description =
    content.frontmatter.description ||
    firstParagraphDescription(content.source) ||
    "SEOJing 블로그 글";

  return (
    <div className="relative min-h-[calc(100vh-25rem)]">
      <JsonLd
        data={[
          articleJsonLd(slug, content.frontmatter, description),
          breadcrumbJsonLd(slug),
        ]}
      />
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
        <PostExplorer rootPath={rootPath} wayFindingPath={wayFindingPath} />
      </Paper>
    </div>
  );
}
