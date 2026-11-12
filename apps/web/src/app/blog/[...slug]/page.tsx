import { notFound } from "next/navigation";
import { ArticleContentView } from "@/shared/content/ArticleContentView";
import { getContentTree, isSlugFolder, loadContent } from "@/shared/config";
import { NewPostsCarousel } from "@/widgets/new-posts-carousel/NewPostsCarousel";
import { RecentlyRead } from "@/widgets/recently-read/RecentlyRead";
import { PostExplorer } from "@/widgets/post-explorer/PostExplorer";
import { PostGrid } from "@/widgets/post-grid";
import { ArticleToolbar } from "@/widgets/article-toolbar/ArticleToolbar";
import { ArticleAnalytics } from "@/widgets/article-analytics";
import {
  getAllPosts,
  getSubTree,
} from "@/widgets/new-posts-carousel/new-posts-carousel.utils";
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
  const contentTree = await getContentTree();

  if (isSlugFolder(slug, contentTree)) {
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
  const contentTree = await getContentTree();

  if (isSlugFolder(slug, contentTree)) {
    const rootPath = `/${slug.join("/")}`;
    const folderNodes = getSubTree(contentTree, rootPath);
    const hasMorePosts = getAllPosts(folderNodes).length > 24;

    return (
      <>
        <JsonLd data={breadcrumbJsonLd(slug)} />
        <NewPostsCarousel rootPath={rootPath} contentTree={contentTree} />
        <RecentlyRead rootPath={rootPath} contentTree={contentTree} />
        <PostExplorer rootPath={rootPath} contentTree={contentTree} />
        <PostGrid
          rootPath={rootPath}
          contentTree={contentTree}
          title="이 섹션의 대표 이미지"
          limit={24}
        />
        {hasMorePosts ? (
          <details className="rounded-lg border border-foreground/10 p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              이 분야의 전체 글 바로가기
            </summary>
            <nav
              aria-label="이 분야의 글과 하위 분류"
              className="mt-3 flex flex-wrap gap-2"
            >
              {folderNodes.map((node) => (
                <a
                  key={node.path}
                  href={`/blog${node.path}`}
                  className="rounded-full border border-foreground/15 px-3 py-1.5 text-sm hover:border-foreground/40"
                >
                  {node.frontmatter?.title ?? node.name}
                </a>
              ))}
            </nav>
          </details>
        ) : null}
      </>
    );
  }

  const content = await loadContent(slug);

  if (!content) {
    notFound();
  }

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
      <ArticleContentView
        content={content}
        before={
          <ArticleAnalytics
            slug={slug.join("/")}
            title={content.frontmatter.title}
          />
        }
        after={
          <>
            <ArticleToolbar
              slug={slug.join("/")}
              title={content.frontmatter.title}
            />
            <PostExplorer
              rootPath={rootPath}
              wayFindingPath={wayFindingPath}
              contentTree={contentTree}
            />
            <PostGrid
              rootPath={rootPath}
              title="같은 섹션의 대표 이미지"
              contentTree={contentTree}
            />
            <div className="mt-16 border-t border-foreground/10 pt-5 text-right">
              <a
                href={`/ops/articles/edit?slug=${encodeURIComponent(slug.join("/"))}`}
                className="text-xs text-foreground/35 transition-colors hover:text-foreground/65"
                title="관리자 전용 · Cloudflare Access 로그인 필요"
              >
                관리자용 글 수정
              </a>
            </div>
          </>
        }
      />
    </div>
  );
}
