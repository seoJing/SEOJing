import * as React from "react";
import { ArticleImage, ArticleQuiz, ArticleQuizItem, CodeBlock } from "@app/ui";
import { BackendArticleDocument } from "./backend-article-document";
import type { BackendArticleApiResponse } from "./article-adapter";
const backendArticleHtmlClassName = "article-prose backend-article-html";
type BackendArticleBlock = NonNullable<
  BackendArticleApiResponse["body"]["blocks"]
>[number];

type BackendArticleBlockContent = Record<string, unknown>;

export function BackendArticleBlocksContent({
  article,
}: {
  article: BackendArticleApiResponse;
}) {
  const blocks = article.body.blocks?.slice().sort(sortBackendBlocks) ?? [];

  if (article.body.document) {
    return React.createElement(BackendArticleDocument, {
      document: article.body.document,
    });
  }

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
          size={readImageSize(content.size)}
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
  const html = readStringField(content.html);
  return React.createElement(
    tag,
    {
      key,
      id: readStringField(content.id),
      ...(html ? { dangerouslySetInnerHTML: { __html: html } } : {}),
    },
    html ? undefined : text,
  );
}

function renderParagraphBlock(
  content: BackendArticleBlockContent,
  plainText: string | null,
  key: string,
) {
  const table = readMarkdownTable(content.table);
  if (table) {
    return <MarkdownTable key={key} table={table} />;
  }

  const listItems = readStringArray(content.items);
  if (listItems?.length) {
    return (
      <MarkdownList
        key={key}
        items={listItems}
        itemsHtml={readHtmlArray(content.itemsHtml)}
        ordered={readStringField(content.listType) === "ordered"}
        start={readPositiveInteger(content.start)}
      />
    );
  }

  const html = readStringField(content.html);
  if (html) {
    return <p key={key} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const text = readStringField(content.text) ?? plainText ?? "";
  if (text === "---") {
    return <hr key={key} />;
  }

  return (
    <p key={key}>
      <InlineMarkdownText text={text} />
    </p>
  );
}

function renderQuoteBlock(
  content: BackendArticleBlockContent,
  plainText: string | null,
  key: string,
) {
  const html = readStringField(content.html);
  return (
    <blockquote key={key}>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <InlineMarkdownText
          text={readStringField(content.text) ?? plainText ?? ""}
        />
      )}
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
  const rawMdx = readStringField(content.rawMdx);
  const props = readBlockContent(content.props);

  if (componentName === "Subtitle") {
    const level = clampHeadingLevel(readStringField(props.level) ?? 2);
    const tag = `h${level}`;
    return React.createElement(
      tag,
      { key },
      <InlineMarkdownText text={extractMdxComponentText(rawMdx) ?? ""} />,
    );
  }

  if (componentName === "Paragraph") {
    return (
      <p key={key}>
        <InlineMarkdownText text={extractMdxComponentText(rawMdx) ?? ""} />
      </p>
    );
  }

  if (componentName === "Anchor") {
    const href =
      readStringField(props.href) ?? readStringField(props.external) ?? "#";
    return (
      <p key={key}>
        <a href={normalizeInlineHref(href)}>
          <InlineMarkdownText text={extractMdxComponentText(rawMdx) ?? href} />
        </a>
      </p>
    );
  }

  const fallback =
    block.plainText ??
    rawMdx ??
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

interface MarkdownTableData {
  headers: string[];
  headersHtml?: string[];
  rows: string[][];
  rowsHtml?: string[][];
  align?: Array<"left" | "center" | "right" | null>;
}

function MarkdownTable({ table }: { table: MarkdownTableData }) {
  return (
    <div className="article-table-scroll my-8 overflow-x-auto">
      <table>
        <thead>
          <tr>
            {table.headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                style={{ textAlign: table.align?.[index] ?? undefined }}
              >
                {table.headersHtml?.[index] ? (
                  <span
                    dangerouslySetInnerHTML={{
                      __html: table.headersHtml[index],
                    }}
                  />
                ) : (
                  <InlineMarkdownText text={header} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${row.join("|")}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td
                  key={`${cell}-${cellIndex}`}
                  style={{ textAlign: table.align?.[cellIndex] ?? undefined }}
                >
                  {table.rowsHtml?.[rowIndex]?.[cellIndex] ? (
                    <span
                      dangerouslySetInnerHTML={{
                        __html: table.rowsHtml[rowIndex]![cellIndex]!,
                      }}
                    />
                  ) : (
                    <InlineMarkdownText text={cell} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownList({
  items,
  itemsHtml,
  ordered,
  start,
}: {
  items: string[];
  itemsHtml?: string[];
  ordered: boolean;
  start?: number;
}) {
  const tag = ordered ? "ol" : "ul";
  return React.createElement(
    tag,
    ordered && start && start > 1 ? { start } : null,
    items.map((item, index) =>
      itemsHtml?.[index] ? (
        React.createElement("li", {
          key: `${item}-${index}`,
          dangerouslySetInnerHTML: { __html: itemsHtml[index] },
        })
      ) : (
        <li key={`${item}-${index}`}>
          <InlineMarkdownText text={item} />
        </li>
      ),
    ),
  );
}

function readMarkdownTable(value: unknown): MarkdownTableData | null {
  const table = readBlockContent(value);
  const headers = readStringArray(table.headers);
  if (!headers?.length || !Array.isArray(table.rows)) {
    return null;
  }

  const rows = table.rows
    .map((row) => {
      if (!Array.isArray(row)) {
        return null;
      }
      const cells = row.map((cell) => readStringField(cell) ?? "");
      return cells.length ? cells : null;
    })
    .filter((row): row is string[] => row != null);

  const headersHtml = readHtmlArray(table.headersHtml);
  const rowsHtml = Array.isArray(table.rowsHtml)
    ? table.rowsHtml.map((row) => readHtmlArray(row) ?? [])
    : undefined;
  const align = Array.isArray(table.align)
    ? table.align.map((value) =>
        value === "left" || value === "center" || value === "right"
          ? value
          : null,
      )
    : undefined;
  return rows.length ? { headers, headersHtml, rows, rowsHtml, align } : null;
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function readImageSize(
  value: unknown,
): "sm" | "md" | "lg" | "full" | undefined {
  return value === "sm" || value === "md" || value === "lg" || value === "full"
    ? value
    : undefined;
}

function readHtmlArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.map((item) => readStringField(item) ?? "")
    : undefined;
}

function InlineMarkdownText({ text }: { text: string }) {
  return <>{parseInlineMarkdown(text)}</>;
}

function extractMdxComponentText(
  rawMdx: string | undefined,
): string | undefined {
  if (!rawMdx) {
    return undefined;
  }
  const blockMatch = rawMdx.match(
    /^\s*<([A-Z][\w.]*)\b[^>]*>([\s\S]*)<\/\1>\s*$/,
  );
  const inner = blockMatch?.[2] ?? rawMdx;
  return normalizeMdxInlineText(inner);
}

function normalizeMdxInlineText(text: string): string {
  return text
    .replace(/\{\s*["']\s+["']\s*\}/g, " ")
    .replace(/\{\s*`\s+`\s*\}/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern =
    /(<strong>([\s\S]*?)<\/strong>|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<br\s*\/?>(?:\s*)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) != null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      nodes.push(
        <strong key={`strong-html-${match.index}`}>
          <InlineMarkdownText text={match[2]} />
        </strong>,
      );
    } else if (match[3] && match[4]) {
      nodes.push(
        <a key={`link-${match.index}`} href={normalizeInlineHref(match[4])}>
          <InlineMarkdownText text={match[3]} />
        </a>,
      );
    } else if (match[0].startsWith("<br")) {
      nodes.push(<br key={`br-${match.index}`} />);
    } else if (match[5]) {
      nodes.push(<code key={`code-${match.index}`}>{match[5]}</code>);
    } else if (match[6]) {
      nodes.push(<strong key={`strong-${match.index}`}>{match[6]}</strong>);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function normalizeInlineHref(href: string): string {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|\/|#)/.test(trimmed)) {
    return trimmed;
  }
  return "#";
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
