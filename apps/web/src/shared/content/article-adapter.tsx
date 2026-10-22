import * as React from "react";
import type { ContentFrontmatter } from "@app/utils";
import { BackendArticleBlocksContent } from "./article-body";

export interface BackendArticleApiResponse {
  slug: string;
  title: string;
  description: string | null;
  category?: string;
  tags?: string[];
  cover?: { src: string; alt: string; caption?: string; kind?: string } | null;
  displayDate?: string | null;
  displayUpdatedAt?: string | null;
  summaryVideo?: ContentFrontmatter["summaryVideo"] | null;
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
    document?: unknown | null;
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
  compiled: { default: React.ComponentType };
}

export function toBackendArticleContentData(
  article: BackendArticleApiResponse,
): BackendArticleContentData {
  const html = article.body.html;
  const frontmatter: ContentFrontmatter = {
    title: article.title,
    date: article.displayDate ?? article.publishedAt ?? article.updatedAt,
    description:
      article.description ?? firstPlainText(article) ?? article.title,
    tags: article.tags ?? [],
    ...(article.cover ? { cover: article.cover } : {}),
    ...(article.displayUpdatedAt ? { updated: article.displayUpdatedAt } : {}),
    ...(article.summaryVideo ? { summaryVideo: article.summaryVideo } : {}),
  };

  const compiled = {
    default: function BackendArticleContent() {
      return React.createElement(BackendArticleBlocksContent, { article });
    },
  };

  return {
    frontmatter,
    source:
      htmlToPlainText(html) ||
      documentPlainText(article.body.document) ||
      firstPlainText(article) ||
      article.title,
    compiled,
  };
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

export function documentPlainText(document: unknown): string {
  const fragments: string[] = [];
  function visit(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const value = node as {
      text?: unknown;
      content?: unknown;
      attrs?: { question?: unknown; alt?: unknown };
    };
    if (typeof value.text === "string") fragments.push(value.text);
    if (typeof value.attrs?.question === "string")
      fragments.push(value.attrs.question);
    if (typeof value.attrs?.alt === "string") fragments.push(value.attrs.alt);
    if (Array.isArray(value.content)) value.content.forEach(visit);
  }
  visit(document);
  return fragments.join(" ").replace(/\s+/g, " ").trim();
}
