import { env as cloudflareEnv } from "cloudflare:workers";
import { cache } from "react";
import type { ContentNode, ContentTree } from "@app/utils";
import type { BackendArticleApiResponse } from "./backend-article";

export interface PublicArticleSummary {
  slug: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[];
  cover: BackendArticleApiResponse["cover"];
  displayDate: string | null;
  displayUpdatedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

type ArticleSummaryRow = {
  slug: string;
  title: string;
  description: string | null;
  category: string;
  tags_json: string;
  cover_json: string | null;
  display_date: string | null;
  display_updated_at: string | null;
  published_at: string | null;
  updated_at: string;
};
type ArticleRow = ArticleSummaryRow & { payload_json: string };

const summarySelect =
  "SELECT slug, title, description, category, tags_json, cover_json, display_date, display_updated_at, published_at, updated_at FROM public_articles";
const articleSelect =
  "SELECT slug, title, description, category, tags_json, cover_json, display_date, display_updated_at, published_at, updated_at, payload_json FROM public_articles";

export function articleDb(): D1Database {
  const db = (cloudflareEnv as Partial<Env>).ANALYTICS_DB;
  if (!db) throw new Error("Public article D1 binding is unavailable");
  return db;
}

export async function listPublicArticleSummaries(
  db = articleDb(),
): Promise<PublicArticleSummary[]> {
  const result = await db
    .prepare(
      `${summarySelect} ORDER BY COALESCE(display_date, published_at, updated_at) DESC, slug ASC`,
    )
    .all<ArticleSummaryRow>();
  return result.results.map(rowToSummary);
}

export async function readPublicArticle(
  slug: string,
  db = articleDb(),
): Promise<BackendArticleApiResponse | null> {
  const row = await db
    .prepare(`${articleSelect} WHERE slug = ?`)
    .bind(slug)
    .first<ArticleRow>();
  return row
    ? (JSON.parse(row.payload_json) as BackendArticleApiResponse)
    : null;
}

export async function putPublicArticle(
  article: BackendArticleApiResponse,
  db = articleDb(),
): Promise<void> {
  if (
    !article.slug ||
    !article.title ||
    !article.body ||
    !article.publishedAt
  ) {
    throw new Error("Cannot snapshot an incomplete or unpublished article");
  }
  const snapshot = compactPublicArticle(article);
  await db
    .prepare(
      `INSERT INTO public_articles
    (slug, title, description, category, tags_json, cover_json, display_date, display_updated_at, published_at, updated_at, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET title=excluded.title, description=excluded.description,
      category=excluded.category, tags_json=excluded.tags_json, cover_json=excluded.cover_json,
      display_date=excluded.display_date, display_updated_at=excluded.display_updated_at,
      published_at=excluded.published_at, updated_at=excluded.updated_at, payload_json=excluded.payload_json`,
    )
    .bind(
      article.slug,
      article.title,
      article.description ?? null,
      article.category ?? "SEOJing",
      JSON.stringify(article.tags ?? []),
      article.cover ? JSON.stringify(article.cover) : null,
      article.displayDate ?? null,
      article.displayUpdatedAt ?? null,
      article.publishedAt,
      article.updatedAt,
      JSON.stringify(snapshot),
    )
    .run();
}

export function compactPublicArticle(
  article: BackendArticleApiResponse,
): BackendArticleApiResponse {
  if (!article.body.document) return article;
  return {
    ...article,
    body: { document: article.body.document, html: "", blocks: [] },
  };
}

export async function deletePublicArticle(
  slug: string,
  db = articleDb(),
): Promise<void> {
  await db
    .prepare("DELETE FROM public_articles WHERE slug = ?")
    .bind(slug)
    .run();
}

const cachedPublicContentTree = cache(
  async (): Promise<ContentTree> =>
    buildPublicContentTree(await listPublicArticleSummaries()),
);

export async function getPublicContentTree(
  db?: D1Database,
): Promise<ContentTree> {
  return db
    ? buildPublicContentTree(await listPublicArticleSummaries(db))
    : cachedPublicContentTree();
}

export function buildPublicContentTree(
  articles: PublicArticleSummary[],
): ContentTree {
  const tree: ContentTree = [];
  for (const article of articles) {
    const parts = article.slug.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let level = tree;
    let folderPath = "";
    for (const part of parts.slice(0, -1)) {
      folderPath += `/${part}`;
      let folder = level.find(
        (node) => node.type === "folder" && node.name === part,
      );
      if (!folder) {
        folder = { name: part, type: "folder", path: folderPath, children: [] };
        level.push(folder);
      }
      level = folder.children!;
    }
    level.push({
      name: parts.at(-1)!,
      type: "file",
      path: `/${article.slug}`,
      extension: "post",
      frontmatter: {
        title: article.title,
        description: article.description ?? "",
        date: article.displayDate ?? article.publishedAt ?? article.updatedAt,
        ...(article.displayUpdatedAt
          ? { updated: article.displayUpdatedAt }
          : {}),
        tags: article.tags,
        ...(article.cover ? { cover: article.cover } : {}),
      },
    });
  }
  function sort(nodes: ContentNode[]): void {
    nodes.sort((a, b) =>
      a.type !== b.type
        ? a.type === "folder"
          ? -1
          : 1
        : a.name.localeCompare(b.name, "ko"),
    );
    for (const node of nodes) if (node.children) sort(node.children);
  }
  sort(tree);
  return tree;
}

function rowToSummary(row: ArticleSummaryRow): PublicArticleSummary {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    tags: JSON.parse(row.tags_json) as string[],
    cover: row.cover_json
      ? (JSON.parse(row.cover_json) as PublicArticleSummary["cover"])
      : null,
    displayDate: row.display_date,
    displayUpdatedAt: row.display_updated_at,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}
