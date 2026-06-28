import * as React from "react";

import type { ContentFrontmatter } from "@app/utils";
import type { MDXModule } from "mdx/types";

export interface BackendArticleApiResponse {
  slug: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  updatedAt: string;
  toc?: Array<{ id: string; depth: number; text: string }>;
  assets?: Array<{
    kind: string;
    url: string;
    altText: string | null;
    mimeType: string | null;
    width: number | null;
    height: number | null;
  }>;
  body: {
    html: string;
    blocks?: Array<{
      id: string;
      type: string;
      sortOrder: number;
      content: unknown;
      plainText: string | null;
    }>;
  };
}

export interface BackendArticleContentData {
  frontmatter: ContentFrontmatter;
  source: string;
  compiled: MDXModule;
}

export async function loadBackendArticleContent(
  slug: string,
): Promise<BackendArticleContentData | null> {
  const origin = readBackendArticleApiOrigin();
  if (!origin) {
    return null;
  }

  const response = await fetchBackendArticle(origin, slug);
  if (!response) {
    return null;
  }

  return toBackendArticleContentData(response);
}

export async function fetchBackendArticle(
  origin: string,
  slug: string,
): Promise<BackendArticleApiResponse | null> {
  const articleUrl = new URL(
    `/articles/${encodeURIComponent(slug)}`,
    normalizeOrigin(origin),
  );

  try {
    const response = await fetch(articleUrl, {
      headers: { Accept: "application/json" },
      cache: "force-cache",
    });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(
        `Backend article API returned ${response.status} for ${slug}`,
      );
    }

    return (await response.json()) as BackendArticleApiResponse;
  } catch (error) {
    console.error("Failed to load backend article", { slug, error });
    return null;
  }
}

export function toBackendArticleContentData(
  article: BackendArticleApiResponse,
): BackendArticleContentData {
  const html = article.body.html;
  const frontmatter: ContentFrontmatter = {
    title: article.title,
    date: article.publishedAt ?? article.updatedAt,
    description:
      article.description ?? firstPlainText(article) ?? article.title,
    tags: [],
  };

  const compiled = {
    default: function BackendArticleHtmlContent() {
      return React.createElement("div", {
        "data-backend-article-html": article.slug,
        dangerouslySetInnerHTML: { __html: html },
      });
    },
  } as unknown as MDXModule;

  return {
    frontmatter,
    source: htmlToPlainText(html) || firstPlainText(article) || article.title,
    compiled,
  };
}

function readBackendArticleApiOrigin(): string | null {
  const origin =
    process.env.SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    process.env.SEOJING_BACKEND_API_ORIGIN;
  return origin?.trim() || null;
}

function normalizeOrigin(origin: string): string {
  return origin.endsWith("/") ? origin : `${origin}/`;
}

function firstPlainText(article: BackendArticleApiResponse): string | null {
  return (
    article.body.blocks
      ?.map((block) => block.plainText?.trim())
      .find((text): text is string => Boolean(text)) ?? null
  );
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
