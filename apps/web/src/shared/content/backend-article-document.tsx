import * as React from "react";

import {
  ArticleImage,
  ArticleQuiz,
  ArticleQuizItem,
  ArticleTable,
  CodeBlock,
  Subtitle,
} from "@app/ui";

interface DocumentNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocumentNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

interface QuizItem {
  mode: "multiple" | "description" | "essay";
  question: string;
  answer: string | number;
  choices?: string[];
  explanation?: string;
  code?: string;
  language?: string;
}

export function BackendArticleDocument({ document }: { document: unknown }) {
  if (
    !isRecord(document) ||
    document.type !== "doc" ||
    !Array.isArray(document.content)
  )
    return null;
  return (
    <div className="article-prose" data-backend-article-document>
      {(document.content as DocumentNode[]).map((node, index) =>
        renderNode(node, `block-${index}`, index),
      )}
    </div>
  );
}

function renderNode(
  node: DocumentNode,
  key: string,
  topIndex?: number,
): React.ReactNode {
  const attrs = node.attrs ?? {};
  const children = (node.content ?? []).map((child, index) =>
    renderNode(child, `${key}-${index}`),
  );
  switch (node.type) {
    case "text":
      return (
        <React.Fragment key={key}>
          {applyMarks(node.text ?? "", node.marks ?? [], key)}
        </React.Fragment>
      );
    case "hardBreak":
      return <br key={key} />;
    case "paragraph":
      return <p key={key}>{children}</p>;
    case "heading": {
      const level = Number(attrs.level);
      const id = topIndex === undefined ? undefined : headingId(node, topIndex);
      if (level === 2 || level === 3)
        return (
          <Subtitle key={key} level={level} id={id}>
            {children}
          </Subtitle>
        );
      if (level === 4)
        return (
          <h4 key={key} id={id}>
            {children}
          </h4>
        );
      if (level === 1)
        return (
          <h1 key={key} id={id}>
            {children}
          </h1>
        );
      if (level === 5)
        return (
          <h5 key={key} id={id}>
            {children}
          </h5>
        );
      return (
        <h6 key={key} id={id}>
          {children}
        </h6>
      );
    }
    case "codeBlock": {
      const code = textOf(node);
      return (
        <CodeBlock
          key={key}
          language={String(attrs.language ?? "text")}
          plainText={code}
        >
          {code}
        </CodeBlock>
      );
    }
    case "bulletList":
      return <ul key={key}>{children}</ul>;
    case "orderedList":
      return (
        <ol
          key={key}
          start={typeof attrs.start === "number" ? attrs.start : undefined}
        >
          {children}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children}</li>;
    case "blockquote":
      return <blockquote key={key}>{children}</blockquote>;
    case "horizontalRule":
      return <hr key={key} />;
    case "table":
      return (
        <ArticleTable key={key}>
          <tbody>{children}</tbody>
        </ArticleTable>
      );
    case "tableRow":
      return <tr key={key}>{children}</tr>;
    case "tableCell":
      return (
        <td
          key={key}
          colSpan={numberOrUndefined(attrs.colspan)}
          rowSpan={numberOrUndefined(attrs.rowspan)}
          style={cellStyle(attrs)}
        >
          {children}
        </td>
      );
    case "tableHeader":
      return (
        <th
          key={key}
          colSpan={numberOrUndefined(attrs.colspan)}
          rowSpan={numberOrUndefined(attrs.rowspan)}
          style={cellStyle(attrs)}
        >
          {children}
        </th>
      );
    case "image":
      return (
        <ArticleImage
          key={key}
          src={String(attrs.src ?? "")}
          alt={String(attrs.alt ?? "")}
          caption={
            typeof attrs.caption === "string" ? attrs.caption : undefined
          }
          size={imageSize(attrs.size)}
        />
      );
    case "callout":
      return (
        <aside
          key={key}
          data-callout-tone={String(attrs.tone ?? "note")}
          className="my-6 rounded-xl border-l-4 border-blue-400 bg-blue-50 p-4 dark:bg-blue-950/30"
        >
          {attrs.title ? <strong>{String(attrs.title)}</strong> : null}
          {children}
        </aside>
      );
    case "quiz": {
      const items = Array.isArray(attrs.items)
        ? (attrs.items as QuizItem[])
        : [];
      return (
        <section key={key} className="my-6" data-block-type="quiz">
          {attrs.title ? (
            <h3 className="mb-3 font-semibold">{String(attrs.title)}</h3>
          ) : null}
          <ArticleQuiz>
            {items.map((item, index) => (
              <ArticleQuizItem
                key={index}
                mode={item.mode}
                question={item.question}
                answer={item.answer}
                choices={item.choices}
                explanation={item.explanation}
                code={item.code}
                language={item.language}
              />
            ))}
          </ArticleQuiz>
        </section>
      );
    }
    default:
      return null;
  }
}

function applyMarks(
  content: React.ReactNode,
  marks: NonNullable<DocumentNode["marks"]>,
  key: string,
): React.ReactNode {
  return marks.reduce<React.ReactNode>((current, mark, index) => {
    const markKey = `${key}-mark-${index}`;
    switch (mark.type) {
      case "bold":
        return <strong key={markKey}>{current}</strong>;
      case "italic":
        return <em key={markKey}>{current}</em>;
      case "underline":
        return <u key={markKey}>{current}</u>;
      case "strike":
        return <del key={markKey}>{current}</del>;
      case "code":
        return <code key={markKey}>{current}</code>;
      case "link": {
        const href = mark.attrs?.href;
        return typeof href === "string" &&
          /^(https?:\/\/|\/(?!\/)|#|mailto:[^\s@]+@[^\s@]+\.[^\s@]+)/i.test(
            href,
          ) ? (
          <a key={markKey} href={href}>
            {current}
          </a>
        ) : (
          current
        );
      }
      case "textStyle":
        return (
          <span key={markKey} style={textStyle(mark.attrs)}>
            {current}
          </span>
        );
      default:
        return current;
    }
  }, content);
}

function textStyle(attrs?: Record<string, unknown>): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (
    typeof attrs?.color === "string" &&
    /^#[\da-f]{3,8}$|^rgb\([\d,\s]+\)$/i.test(attrs.color)
  )
    style.color = attrs.color;
  if (typeof attrs?.fontSize === "string" && /^\d{1,2}px$/.test(attrs.fontSize))
    style.fontSize = attrs.fontSize;
  if (
    typeof attrs?.fontFamily === "string" &&
    ["sans-serif", "serif", "monospace"].includes(attrs.fontFamily)
  )
    style.fontFamily = attrs.fontFamily;
  return style;
}

function textOf(node: DocumentNode): string {
  return node.type === "text"
    ? (node.text ?? "")
    : (node.content ?? [])
        .map(textOf)
        .join(node.type === "paragraph" || node.type === "heading" ? "" : "\n");
}

function headingId(node: DocumentNode, index: number): string {
  const slug =
    textOf(node)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣_-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "") || "section";
  return `${slug}-${index}`;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}
function cellStyle(
  attrs: Record<string, unknown>,
): React.CSSProperties | undefined {
  return ["left", "center", "right"].includes(String(attrs.align))
    ? { textAlign: attrs.align as React.CSSProperties["textAlign"] }
    : undefined;
}
function imageSize(value: unknown): "sm" | "md" | "lg" | "full" | undefined {
  return value === "sm" || value === "md" || value === "lg" || value === "full"
    ? value
    : undefined;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
