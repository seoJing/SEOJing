import * as React from "react";
import { env as cloudflareEnv } from "cloudflare:workers";

import { ArticleImage, ArticleQuiz, ArticleQuizItem, CodeBlock } from "@app/ui";
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

const backendArticleHtmlClassName = "article-prose backend-article-html";

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
    default: function BackendArticleContent() {
      return React.createElement(BackendArticleBlocksContent, { article });
    },
  } as unknown as MDXModule;

  return {
    frontmatter,
    source: htmlToPlainText(html) || firstPlainText(article) || article.title,
    compiled,
  };
}

type BackendArticleBlock = NonNullable<
  BackendArticleApiResponse["body"]["blocks"]
>[number];

type BackendArticleBlockContent = Record<string, unknown>;

function BackendArticleBlocksContent({
  article,
}: {
  article: BackendArticleApiResponse;
}) {
  const blocks = article.body.blocks?.slice().sort(sortBackendBlocks) ?? [];

  if (blocks.length === 0) {
    return React.createElement("div", {
      className: backendArticleHtmlClassName,
      "data-backend-article-html": article.slug,
      dangerouslySetInnerHTML: { __html: article.body.html },
    });
  }

  return React.createElement(
    "div",
    {
      className: "article-prose",
      "data-backend-article-blocks": article.slug,
    },
    blocks.map((block, index) => renderBackendArticleBlock(block, index)),
  );
}

function sortBackendBlocks(a: BackendArticleBlock, b: BackendArticleBlock) {
  return a.sortOrder - b.sortOrder;
}

function renderBackendArticleBlock(
  block: BackendArticleBlock,
  index: number,
): React.ReactNode {
  const key = block.id || `${block.type}-${index}`;
  const content = readBlockContent(block.content);

  switch (block.type) {
    case "HEADING":
      return renderHeadingBlock(content, key);
    case "PARAGRAPH":
      return renderParagraphBlock(content, block.plainText, key);
    case "QUOTE":
      return renderQuoteBlock(content, block.plainText, key);
    case "CODE":
      return (
        <CodeBlock
          key={key}
          language={readStringField(content.language) ?? "text"}
          plainText={readStringField(content.code) ?? block.plainText ?? ""}
        >
          {readStringField(content.code) ?? block.plainText ?? ""}
        </CodeBlock>
      );
    case "IMAGE":
      return (
        <ArticleImage
          key={key}
          src={
            readStringField(content.url) ?? readStringField(content.src) ?? ""
          }
          alt={
            readStringField(content.alt) ??
            readStringField(content.altText) ??
            ""
          }
          caption={readStringField(content.caption)}
        />
      );
    case "QUIZ":
      return renderQuizBlock(content, block.plainText, key);
    case "CALLOUT":
      return renderCalloutBlock(content, block.plainText, key);
    default:
      return renderUnsupportedBlock(block, content, key);
  }
}

function renderHeadingBlock(content: BackendArticleBlockContent, key: string) {
  const level = clampHeadingLevel(content.level);
  const tag = `h${level}`;
  const text = readStringField(content.text) ?? "";
  return React.createElement(
    tag,
    { key, id: readStringField(content.id) },
    text,
  );
}

function renderParagraphBlock(
  content: BackendArticleBlockContent,
  plainText: string | null,
  key: string,
) {
  const html = readStringField(content.html);
  if (html) {
    return <p key={key} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <p key={key}>{readStringField(content.text) ?? plainText ?? ""}</p>;
}

function renderQuoteBlock(
  content: BackendArticleBlockContent,
  plainText: string | null,
  key: string,
) {
  return (
    <blockquote key={key}>
      {readStringField(content.text) ?? plainText ?? ""}
    </blockquote>
  );
}

function renderCalloutBlock(
  content: BackendArticleBlockContent,
  plainText: string | null,
  key: string,
) {
  const props = readBlockContent(content.props);
  const title =
    readStringField(content.title) ?? readStringField(props["title"]);
  const text =
    readStringField(content.text) ??
    readStringField(content.bodyText) ??
    plainText ??
    "";
  const tone = readStringField(content.tone) ?? readStringField(props["tone"]);

  return (
    <aside key={key} data-callout-tone={tone ?? "note"}>
      {title ? <strong>{title}</strong> : null}
      {text ? <p>{text}</p> : null}
    </aside>
  );
}

function renderQuizBlock(
  content: BackendArticleBlockContent,
  plainText: string | null,
  key: string,
) {
  const items = readQuizItems(content);

  if (items.length > 0) {
    return <ArticleQuiz key={key}>{items}</ArticleQuiz>;
  }

  const question = readStringField(content.question) ?? plainText;
  if (question) {
    return (
      <ArticleQuiz key={key}>
        <ArticleQuizItem
          mode={readQuizMode(content.mode, content.choices)}
          question={question}
          choices={readStringArray(content.choices)}
          answer={readAnswer(content.answer) ?? ""}
          explanation={readStringField(content.explanation)}
        />
      </ArticleQuiz>
    );
  }

  return renderUnsupportedBlock({ type: "QUIZ", plainText }, content, key);
}

function readQuizItems(content: BackendArticleBlockContent): React.ReactNode[] {
  if (!Array.isArray(content.items)) {
    return [];
  }

  return content.items
    .map((item, index) => {
      const itemContent = readBlockContent(item);
      const props = readBlockContent(itemContent.props);
      const question = readStringField(props.question);
      const answer = readAnswer(props.answer);
      if (!question || answer == null) {
        return null;
      }
      const choices = readStringArray(props.choices);
      return (
        <ArticleQuizItem
          key={`${question}-${index}`}
          mode={readQuizMode(props.mode, choices)}
          question={question}
          code={readStringField(props.code)}
          language={readStringField(props.language)}
          choices={choices}
          answer={answer}
          explanation={readStringField(props.explanation)}
        />
      );
    })
    .filter((item): item is React.ReactElement => item != null);
}

function renderUnsupportedBlock(
  block: Pick<BackendArticleBlock, "type" | "plainText">,
  content: BackendArticleBlockContent,
  key: string,
) {
  const componentName = readStringField(content.componentName) ?? block.type;
  const fallback =
    block.plainText ??
    readStringField(content.rawMdx) ??
    `${componentName} block is not supported by the frontend renderer yet.`;

  return (
    <aside
      key={key}
      data-backend-block-fallback={block.type}
      className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300"
    >
      <strong className="mb-2 block text-gray-800 dark:text-gray-100">
        {componentName} fallback
      </strong>
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs">
        {fallback}
      </pre>
    </aside>
  );
}

function readBlockContent(value: unknown): BackendArticleBlockContent {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as BackendArticleBlockContent;
  }
  return {};
}

function readStringField(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.map((item) => readStringField(item)).filter(Boolean);
    return items.length > 0 ? (items as string[]) : undefined;
  }

  const raw = readStringField(value);
  if (!raw) {
    return undefined;
  }

  const jsonish = raw.replace(/'/g, '"');
  try {
    const parsed = JSON.parse(jsonish) as unknown;
    if (Array.isArray(parsed)) {
      const items = parsed.map((item) => readStringField(item)).filter(Boolean);
      return items.length > 0 ? (items as string[]) : undefined;
    }
  } catch {
    // Fall through to comma splitting for simple MDX prop literals.
  }

  const items = raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function readAnswer(value: unknown): string | number | undefined {
  const text = readStringField(value);
  if (!text) {
    return undefined;
  }
  return /^\d+$/.test(text) ? Number(text) : text;
}

function readQuizMode(
  value: unknown,
  choices: unknown,
): "multiple" | "description" | "essay" {
  const mode = readStringField(value);
  if (mode === "multiple" || mode === "description" || mode === "essay") {
    return mode;
  }
  return readStringArray(choices)?.length ? "multiple" : "description";
}

function clampHeadingLevel(value: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  const parsed = typeof value === "number" ? value : Number(value ?? 2);
  if (!Number.isFinite(parsed)) {
    return 2;
  }
  return Math.min(Math.max(Math.trunc(parsed), 1), 6) as 1 | 2 | 3 | 4 | 5 | 6;
}

function readBackendArticleApiOrigin(): string | null {
  const runtimeEnv = cloudflareEnv as Partial<{
    SEOJING_BACKEND_ARTICLE_API_ORIGIN: string;
    SEOJING_BACKEND_API_ORIGIN: string;
  }>;
  const origin =
    process.env.SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    process.env.SEOJING_BACKEND_API_ORIGIN ??
    runtimeEnv.SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    runtimeEnv.SEOJING_BACKEND_API_ORIGIN;
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
