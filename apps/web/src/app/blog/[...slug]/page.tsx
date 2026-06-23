import { notFound } from "next/navigation";
import { ArticleHeader, Paper } from "@app/ui";
import { calculateReadingTime } from "@app/utils";
import { isSlugFolder, loadContent } from "@/shared/config";
import { mdxComponents } from "@/widgets/mdx-renderer/MdxRenderer";
import type { MDXComponents } from "mdx/types";
import { NewPostsCarousel } from "@/widgets/new-posts-carousel/NewPostsCarousel";
import { RecentlyRead } from "@/widgets/recently-read/RecentlyRead";
import { PostExplorer } from "@/widgets/post-explorer/PostExplorer";
import { PostGrid } from "@/widgets/post-grid";
import { ArticleToolbar } from "@/widgets/article-toolbar/ArticleToolbar";
import { ArticleAnalytics } from "@/widgets/article-analytics";
import { PostQaPanel, SectionQaPrompts } from "@/widgets/post-qa";
import { BlogAudioPlayer } from "@/widgets/blog-audio-player/BlogAudioPlayer";
import { SummaryVideo } from "@/widgets/summary-video";
import type { Metadata } from "vinext/shims/metadata";
import {
  buildArticleMetadata,
  buildFolderMetadata,
} from "@/shared/seo/metadata";
import { getArticleDescription } from "@/shared/seo/content";
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
        <PostGrid rootPath={rootPath} title="이 섹션의 대표 이미지" />
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
  const description = getArticleDescription(
    content.frontmatter,
    content.source,
  );

  return (
    <div className="relative min-h-[calc(100vh-25rem)]">
      <JsonLd
        data={[
          articleJsonLd(slug, content.frontmatter, description),
          breadcrumbJsonLd(slug),
        ]}
      />
      <Paper>
        <ArticleAnalytics
          slug={slug.join("/")}
          title={content.frontmatter.title}
        />
        <div className="relative">
          <ArticleHeader
            title={content.frontmatter.title}
            date={content.frontmatter.date}
            tags={content.frontmatter.tags}
            readingTime={calculateReadingTime(content.source)}
          />
          <SummaryVideo
            video={content.frontmatter.summaryVideo}
            title={content.frontmatter.title}
          />
          <BlogAudioPlayer slug={slug.join("/")} />
          <div data-article-content>
            <MDXContent components={mdxComponents as MDXComponents} />
          </div>
          <SectionQaPrompts slug={slug.join("/")} />
        </div>
        <PostQaPanel slug={slug.join("/")} title={content.frontmatter.title} />
        <ArticleToolbar
          slug={slug.join("/")}
          title={content.frontmatter.title}
        />
        <PostExplorer rootPath={rootPath} wayFindingPath={wayFindingPath} />
        <PostGrid rootPath={rootPath} title="같은 섹션의 대표 이미지" />
      </Paper>
    </div>
  );
}
