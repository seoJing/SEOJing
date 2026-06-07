import type { Metadata } from "vinext/shims/metadata";
import type { ContentFrontmatter } from "@app/utils";
import { absoluteUrl, blogUrl, siteConfig } from "@/shared/config/site";
import { folderTitle, getArticleDescription } from "./content";

const defaultOgImage = {
  url: siteConfig.logoPath,
  width: 800,
  height: 800,
  alt: "SEOJing 로고",
};

export function buildSiteMetadata(): Metadata {
  return {
    title: {
      default: siteConfig.title,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    metadataBase: new URL(siteConfig.origin),
    authors: [siteConfig.author],
    creator: siteConfig.author.name,
    publisher: siteConfig.author.name,
    alternates: {
      canonical: absoluteUrl("/"),
      types: {
        "application/rss+xml": absoluteUrl(siteConfig.rssPath),
      },
    },
    openGraph: {
      title: siteConfig.title,
      description: siteConfig.description,
      url: absoluteUrl("/"),
      siteName: siteConfig.name,
      images: [defaultOgImage],
      locale: siteConfig.locale,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: siteConfig.title,
      description: siteConfig.description,
      images: [siteConfig.logoPath],
    },
  };
}

export function buildBlogIndexMetadata(): Metadata {
  const title = "블로그";
  const description =
    "SEOJing의 프론트엔드, 백엔드 스터디, 오케이징 운영 기록을 모아 보는 블로그입니다.";
  const url = absoluteUrl("/blog");

  return {
    title,
    description,
    alternates: {
      canonical: url,
      types: {
        "application/rss+xml": absoluteUrl(siteConfig.rssPath),
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      images: [defaultOgImage],
      locale: siteConfig.locale,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [siteConfig.logoPath],
    },
  };
}

export function buildFolderMetadata(slug: string[]): Metadata {
  const title = `${folderTitle(slug)} 글 목록`;
  const description = `SEOJing 블로그의 ${folderTitle(slug)} 카테고리 글 목록입니다.`;
  const url = blogUrl(slug);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      images: [defaultOgImage],
      locale: siteConfig.locale,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [siteConfig.logoPath],
    },
  };
}

export function buildArticleMetadata(
  slug: string[],
  frontmatter: ContentFrontmatter,
  source: string,
): Metadata {
  const description = getArticleDescription(frontmatter, source);
  const url = blogUrl(slug);
  const tags = frontmatter.tags ?? [];

  return {
    title: frontmatter.title,
    description,
    keywords: tags,
    alternates: { canonical: url },
    openGraph: {
      title: frontmatter.title,
      description,
      url,
      siteName: siteConfig.name,
      images: [defaultOgImage],
      locale: siteConfig.locale,
      type: "article",
      publishedTime: frontmatter.date,
      authors: [siteConfig.author.name],
    },
    twitter: {
      card: "summary",
      title: frontmatter.title,
      description,
      images: [siteConfig.logoPath],
    },
  };
}
