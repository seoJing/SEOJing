"use client";

import { useEffect, useMemo } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import { ArticleImage, ArticleQuiz, ArticleQuizItem } from "@app/ui";
import { TiptapInlineEditor } from "./TiptapInlineEditor";

type Node = {
  type: string;
  name?: string | null;
  value?: string;
  url?: string;
  title?: string | null;
  alt?: string;
  depth?: number;
  ordered?: boolean;
  start?: number | null;
  lang?: string | null;
  attributes?: Array<{
    type: string;
    name?: string;
    value?: string | { value?: string } | null;
  }>;
  children?: Node[];
  position?: { start: { offset?: number }; end: { offset?: number } };
};

function hasOpaqueInline(nodes: Node[]): boolean {
  return nodes.some((node) => {
    if (node.type === "text") return false;
    if (node.type === "inlineCode") return Boolean(node.value?.includes("`"));
    if (
      node.type === "link" &&
      (node.title ||
        /^(?:javascript|data|vbscript):/i.test(node.url ?? "") ||
        /[\s)]/.test(node.url ?? ""))
    )
      return true;
    if (node.type.startsWith("mdxJsx")) {
      if (
        node.name === "span" &&
        node.attributes?.every((attribute) => attribute.name === "style")
      )
        return hasOpaqueInline(node.children ?? []);
      if (
        (node.name !== "strong" && node.name !== "em") ||
        node.attributes?.length
      )
        return true;
      return hasOpaqueInline(node.children ?? []);
    }
    if (
      node.type !== "strong" &&
      node.type !== "emphasis" &&
      node.type !== "link" &&
      node.type !== "paragraph" &&
      node.type !== "listItem"
    )
      return true;
    return hasOpaqueInline(node.children ?? []);
  });
}

function innerRange(body: string, node: Node, tag: string) {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return null;
  const fragment = body.slice(start, end);
  const opening =
    tag === "Subtitle"
      ? /^<Subtitle(?:\s+level=\{[1-6]\})?>/.exec(fragment)?.[0]
      : /^<Paragraph>/.exec(fragment)?.[0];
  const closing = fragment.lastIndexOf(`</${tag}>`);
  if (!opening || closing < opening.length) return null;
  return { start: start + opening.length, end: start + closing };
}

export function serializeInline(element: Element): string {
  const walk = (node: globalThis.Node): string => {
    if (node.nodeType === 3)
      return (node.textContent ?? "").replace(/[\\`*_{}[\]<>#~!+-]/g, "\\$&");
    if (node.nodeType !== 1) return "";
    const child = node as Element;
    const content = Array.from(child.childNodes).map(walk).join("");
    switch (child.tagName.toLowerCase()) {
      case "strong":
      case "b":
        return `**${content}**`;
      case "em":
      case "i":
        return `*${content}*`;
      case "code":
        return `\`${child.textContent ?? ""}\``;
      case "a": {
        const href = child.getAttribute("href") ?? "";
        return /^(https?:\/\/|\/)[^\s)]*$/.test(href)
          ? `[${content}](${href})`
          : content;
      }
      case "span": {
        const style = (child as HTMLElement).style;
        const styles = [
          /^#[0-9a-f]{3,8}$|^rgb\([\d,\s]+\)$/i.test(style.color)
            ? `color: ${JSON.stringify(style.color)}`
            : "",
          /^\d{1,2}px$/.test(style.fontSize)
            ? `fontSize: ${JSON.stringify(style.fontSize)}`
            : "",
          ["sans-serif", "serif", "monospace"].includes(style.fontFamily)
            ? `fontFamily: ${JSON.stringify(style.fontFamily)}`
            : "",
        ].filter(Boolean);
        return styles.length
          ? `<span style={{ ${styles.join(", ")} }}>${content}</span>`
          : content;
      }
      case "br":
        return "\n";
      case "div":
      case "p":
        return `${content}\n`;
      default:
        return content;
    }
  };
  return Array.from(element.childNodes).map(walk).join("").trim();
}

function pastePlainText(event: React.ClipboardEvent<HTMLElement>) {
  event.preventDefault();
  const value = event.clipboardData.getData("text/plain");
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(value);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  event.currentTarget.dataset.changed = "true";
}

function Inline({ nodes }: { nodes: Node[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        const children = node.children ?? [];
        const key = `${node.type}:${index}`;
        if (node.type === "text") return <span key={key}>{node.value}</span>;
        if (node.type === "inlineCode")
          return <code key={key}>{node.value}</code>;
        if (node.type === "strong" || node.name === "strong")
          return (
            <strong key={key}>
              <Inline nodes={children} />
            </strong>
          );
        if (node.type === "emphasis" || node.name === "em")
          return (
            <em key={key}>
              <Inline nodes={children} />
            </em>
          );
        if (node.type === "link")
          return (
            <a key={key} href={node.url}>
              <Inline nodes={children} />
            </a>
          );
        if (children.length) return <Inline key={key} nodes={children} />;
        return node.value ? <span key={key}>{node.value}</span> : null;
      })}
    </>
  );
}

function inlineHtml(nodes: Node[]): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return nodes
    .map((node) => {
      const content = inlineHtml(node.children ?? []);
      if (node.type === "text") return escape(node.value ?? "");
      if (node.type === "inlineCode")
        return `<code>${escape(node.value ?? "")}</code>`;
      if (node.type === "strong" || node.name === "strong")
        return `<strong>${content}</strong>`;
      if (node.type === "emphasis" || node.name === "em")
        return `<em>${content}</em>`;
      if (node.name === "span") {
        const raw = node.attributes?.find(
          (attribute) => attribute.name === "style",
        )?.value;
        const expression =
          raw && typeof raw === "object" ? (raw.value ?? "") : "";
        const styles = ["color", "fontSize", "fontFamily"].flatMap((name) => {
          const match = new RegExp(`${name}\\s*:\\s*["']([^"']+)["']`).exec(
            expression,
          );
          if (!match) return [];
          const value = match[1] ?? "";
          if (
            name === "color" &&
            !/^#[0-9a-f]{3,8}$|^rgb\([\d,\s]+\)$/i.test(value)
          )
            return [];
          if (name === "fontSize" && !/^\d{1,2}px$/.test(value)) return [];
          if (
            name === "fontFamily" &&
            !["sans-serif", "serif", "monospace"].includes(value)
          )
            return [];
          return [
            `${name === "fontSize" ? "font-size" : name === "fontFamily" ? "font-family" : name}:${value}`,
          ];
        });
        return `<span style="${escape(styles.join(";"))}">${content}</span>`;
      }
      if (node.type === "link")
        return `<a href="${escape(node.url ?? "")}">${content}</a>`;
      return content;
    })
    .join("");
}

function jsxString(node: Node, name: string): string {
  const raw = node.attributes?.find(
    (attribute) => attribute.name === name,
  )?.value;
  return typeof raw === "string"
    ? raw
    : typeof raw === "object" && raw
      ? (raw.value ?? "")
      : "";
}

function jsxChoices(node: Node): string[] {
  const raw = jsxString(node, "choices");
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function Editable({
  tag,
  nodes,
  onCommit,
  readOnly,
}: {
  tag: "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote";
  nodes: Node[];
  onCommit: (markdown: string) => void;
  readOnly: boolean;
}) {
  const className =
    tag === "h1"
      ? "text-3xl font-bold"
      : tag === "h2"
        ? "text-2xl font-semibold"
        : tag === "h3"
          ? "text-xl font-semibold"
          : tag === "h4" || tag === "h5" || tag === "h6"
            ? "text-lg font-semibold"
            : tag === "blockquote"
              ? "border-l-4 border-zinc-300 pl-4 italic dark:border-zinc-700"
              : "text-base";
  return (
    <TiptapInlineEditor
      html={inlineHtml(nodes)}
      tag={
        tag.startsWith("h")
          ? (tag as "h1" | "h2" | "h3" | "h4" | "h5" | "h6")
          : "p"
      }
      readOnly={readOnly}
      className={className}
      onCommit={(html) => {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        onCommit(serializeInline(parsed.body));
      }}
    />
  );
}

function EditableCell({
  cell,
  header,
  onReplace,
  readOnly,
}: {
  cell: Node;
  header: boolean;
  onReplace: (start: number, end: number, replacement: string) => void;
  readOnly: boolean;
}) {
  const children = cell.children ?? [];
  const start = children[0]?.position?.start.offset;
  const end = children.at(-1)?.position?.end.offset;
  const Tag = header ? "th" : "td";
  return (
    <Tag
      contentEditable={!readOnly && start !== undefined && end !== undefined}
      suppressContentEditableWarning
      onInput={(event) => {
        event.currentTarget.dataset.changed = "true";
      }}
      onPaste={pastePlainText}
      onBlur={(event) => {
        if (
          event.currentTarget.dataset.changed === "true" &&
          start !== undefined &&
          end !== undefined
        ) {
          onReplace(start, end, serializeInline(event.currentTarget));
        }
      }}
      className="min-w-24 border border-zinc-300 px-3 py-2 text-left outline-none focus:bg-zinc-50 dark:border-zinc-700 dark:focus:bg-zinc-900"
    >
      <Inline nodes={children} />
    </Tag>
  );
}

function VisualNode({
  node,
  body,
  onReplace,
  readOnly,
}: {
  node: Node;
  body: string;
  onReplace: (start: number, end: number, replacement: string) => void;
  readOnly: boolean;
}) {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined) return null;
  const original = body.slice(start, end);
  const soleChild = node.children?.length === 1 ? node.children[0] : null;
  const component =
    node.type === "mdxJsxFlowElement"
      ? node
      : soleChild?.type === "mdxJsxTextElement"
        ? soleChild
        : null;

  if (component?.name === "ArticleQuiz") {
    const items = (component.children ?? []).filter(
      (child) => child.name === "ArticleQuizItem",
    );
    return (
      <div>
        {items.length ? (
          <ArticleQuiz>
            {items.map((item, index) => (
              <ArticleQuizItem
                key={index}
                mode={
                  jsxString(item, "mode") === "multiple"
                    ? "multiple"
                    : "description"
                }
                question={jsxString(item, "question") || "질문"}
                choices={jsxChoices(item)}
                answer={jsxString(item, "answer")}
                explanation={jsxString(item, "explanation")}
              />
            ))}
          </ArticleQuiz>
        ) : (
          <p className="text-sm text-zinc-500">퀴즈 구성요소</p>
        )}
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
          label="퀴즈 내용 수정"
        />
      </div>
    );
  }
  if (component?.name === "ArticleImage") {
    const src = jsxString(component, "src");
    return (
      <div>
        {src ? (
          <ArticleImage
            src={src}
            alt={jsxString(component, "alt")}
            caption={jsxString(component, "caption") || undefined}
          />
        ) : null}
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
          label="이미지 정보 수정"
        />
      </div>
    );
  }

  if (component?.name === "Subtitle") {
    const range = innerRange(body, component, "Subtitle");
    if (!range)
      return (
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
        />
      );
    if (hasOpaqueInline(component.children ?? []))
      return (
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
        />
      );
    const levelValue = component.attributes?.find(
      (attribute) => attribute.name === "level",
    )?.value;
    const parsedLevel = Number(
      typeof levelValue === "object" ? levelValue?.value : levelValue,
    );
    const level =
      Number.isInteger(parsedLevel) && parsedLevel >= 1 && parsedLevel <= 6
        ? parsedLevel
        : 2;
    return (
      <Editable
        key={original}
        readOnly={readOnly}
        tag={`h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"}
        nodes={component.children ?? []}
        onCommit={(markdown) => onReplace(range.start, range.end, markdown)}
      />
    );
  }
  if (component?.name === "Paragraph") {
    const range = innerRange(body, component, "Paragraph");
    if (!range)
      return (
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
        />
      );
    if (hasOpaqueInline(component.children ?? []))
      return (
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
        />
      );
    return (
      <Editable
        key={original}
        readOnly={readOnly}
        tag="div"
        nodes={component.children ?? []}
        onCommit={(markdown) => onReplace(range.start, range.end, markdown)}
      />
    );
  }
  if (node.type === "heading") {
    if (hasOpaqueInline(node.children ?? []))
      return (
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
        />
      );
    const depth = Math.min(6, Math.max(1, node.depth ?? 2));
    const tag = `h${depth}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    return (
      <Editable
        key={original}
        readOnly={readOnly}
        tag={tag}
        nodes={node.children ?? []}
        onCommit={(markdown) =>
          onReplace(start, end, `${"#".repeat(node.depth ?? 2)} ${markdown}`)
        }
      />
    );
  }
  if (node.type === "paragraph" || node.type === "blockquote") {
    if (
      hasOpaqueInline(node.children ?? []) ||
      (node.type === "blockquote" &&
        (node.children?.length !== 1 || node.children[0]?.type !== "paragraph"))
    )
      return (
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
          label={node.type === "blockquote" ? "인용문 원문 편집" : undefined}
        />
      );
    return (
      <Editable
        key={original}
        readOnly={readOnly}
        tag={node.type === "blockquote" ? "blockquote" : "div"}
        nodes={
          node.type === "blockquote"
            ? (node.children?.[0]?.children ?? [])
            : (node.children ?? [])
        }
        onCommit={(markdown) =>
          onReplace(
            start,
            end,
            node.type === "blockquote" ? `> ${markdown}` : markdown,
          )
        }
      />
    );
  }
  if (node.type === "code") {
    const opening = /^(?:`{3,}|~{3,})[^\r\n]*(?:\r\n|\n|\r)/.exec(original);
    const closing = /(?:\r\n|\n|\r)(?:`{3,}|~{3,})\s*$/.exec(original);
    if (!opening || !closing)
      return (
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
        />
      );
    const contentStart = start + opening[0].length;
    const contentEnd = end - closing[0].length;
    return (
      <label className="block overflow-hidden rounded-lg bg-zinc-950 text-zinc-100">
        <span className="block px-4 pt-3 text-xs text-zinc-400">
          {node.lang || "코드"}
        </span>
        <textarea
          key={`${start}:${end}`}
          defaultValue={node.value ?? ""}
          spellCheck={false}
          onBlur={(event) => {
            const next = event.currentTarget.value;
            if (next !== body.slice(contentStart, contentEnd))
              onReplace(contentStart, contentEnd, next);
          }}
          className="min-h-32 w-full resize-y bg-transparent px-4 py-3 font-mono text-sm leading-6 outline-none"
          rows={Math.min(
            20,
            Math.max(4, (node.value ?? "").split("\n").length),
          )}
        />
      </label>
    );
  }
  if (node.type === "thematicBreak")
    return <hr className="my-6 border-zinc-300 dark:border-zinc-700" />;
  if (node.type === "list") {
    const items = node.children ?? [];
    if (hasOpaqueInline(items))
      return (
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
          label="목록 원문 편집"
        />
      );
    const Tag = node.ordered ? "ol" : "ul";
    const itemRanges = items.map((item) => {
      const itemStart = item.position?.start.offset;
      const itemEnd = item.position?.end.offset;
      if (itemStart === undefined || itemEnd === undefined) return null;
      const itemSource = body.slice(itemStart, itemEnd);
      const marker = /^\s*(?:[-+*]|\d+[.)])\s+/.exec(itemSource);
      if (!marker || /\r|\n/.test(itemSource)) return null;
      return { start: itemStart + marker[0].length, end: itemEnd };
    });
    if (itemRanges.some((range) => !range))
      return (
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
          label="목록 원문 편집"
        />
      );
    return (
      <Tag
        className={`ml-7 list-outside space-y-1 ${node.ordered ? "list-decimal" : "list-disc"}`}
      >
        {items.map((item, index) => (
          <li key={index}>
            <Editable
              key={body.slice(
                itemRanges[index]?.start ?? 0,
                itemRanges[index]?.end ?? 0,
              )}
              readOnly={readOnly}
              tag="div"
              nodes={item.children ?? []}
              onCommit={(markdown) => {
                const range = itemRanges[index];
                if (range) onReplace(range.start, range.end, markdown);
              }}
            />
          </li>
        ))}
      </Tag>
    );
  }
  if (node.type === "table") {
    if (
      (node.children ?? []).some((row) =>
        (row.children ?? []).some((cell) =>
          hasOpaqueInline(cell.children ?? []),
        ),
      )
    )
      return (
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
          label="표 원문 편집"
        />
      );
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {(node.children ?? []).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {(row.children ?? []).map((cell, cellIndex) => (
                  <EditableCell
                    readOnly={readOnly}
                    key={cellIndex}
                    cell={cell}
                    header={rowIndex === 0}
                    onReplace={onReplace}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <RawNode
          original={original}
          start={start}
          end={end}
          onReplace={onReplace}
          readOnly={readOnly}
          label="표 원문 편집"
        />
      </div>
    );
  }
  return (
    <RawNode
      original={original}
      start={start}
      end={end}
      onReplace={onReplace}
      readOnly={readOnly}
    />
  );
}

function RawNode({
  original,
  start,
  end,
  onReplace,
  readOnly = false,
  label = "특수 구성요소 원문 편집",
}: {
  original: string;
  start: number;
  end: number;
  onReplace: (start: number, end: number, replacement: string) => void;
  readOnly?: boolean;
  label?: string;
}) {
  if (readOnly) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700">
        {label} · 실제 공개 글에서 결과를 확인하세요.
      </div>
    );
  }
  return (
    <details className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-300">
        {label}
      </summary>
      <textarea
        aria-label={label}
        key={`${start}:${end}`}
        defaultValue={original}
        onBlur={(event) => {
          if (event.currentTarget.value !== original)
            onReplace(start, end, event.currentTarget.value);
        }}
        className="mt-3 min-h-28 w-full font-mono text-xs"
      />
    </details>
  );
}

export function MdxRichEditor({
  markdown,
  disabled,
  readOnly = false,
  onReplace,
  onError,
}: {
  markdown: string;
  disabled: boolean;
  readOnly?: boolean;
  onReplace: (start: number, end: number, replacement: string) => void;
  onError: (message: string) => void;
}) {
  const parsed = useMemo(() => {
    try {
      const root = unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkMdx)
        .parse(markdown);
      return { nodes: root.children as Node[], error: "" };
    } catch (error) {
      return { nodes: [] as Node[], error: String(error) };
    }
  }, [markdown]);
  useEffect(() => {
    if (parsed.error) onError(parsed.error);
  }, [onError, parsed.error]);
  if (parsed.error) {
    return (
      <p className="text-sm text-rose-700">
        MDX를 시각적으로 표시할 수 없습니다. 원문 보기로 편집하세요.
      </p>
    );
  }
  return (
    <fieldset
      disabled={disabled || readOnly}
      className={`min-w-0 space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6 ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      {parsed.nodes.map((node, index) => (
        <div
          key={`${index}:${node.position?.start.offset ?? 0}`}
          className="group relative min-w-0 border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-900"
        >
          <VisualNode
            node={node}
            body={markdown}
            onReplace={onReplace}
            readOnly={readOnly || disabled}
          />
          {!readOnly && !disabled && node.position?.end.offset !== undefined ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <select
                aria-label={`구성요소 추가 ${index + 1}`}
                defaultValue=""
                className="rounded border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                onChange={(event) => {
                  const snippet = componentSnippets[event.target.value];
                  if (snippet)
                    onReplace(
                      node.position!.end.offset!,
                      node.position!.end.offset!,
                      `\n\n${snippet}\n\n`,
                    );
                  event.target.value = "";
                }}
              >
                <option value="">+ 아래에 구성요소 추가</option>
                {Object.keys(componentSnippets).map((name) => (
                  <option value={name} key={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded border border-zinc-200 px-2 py-1 text-rose-600 dark:border-zinc-700"
                onClick={() => {
                  if (window.confirm("이 구성요소를 편집본에서 제거할까요?"))
                    onReplace(
                      node.position!.start.offset!,
                      node.position!.end.offset!,
                      "",
                    );
                }}
              >
                이 구성요소 제거
              </button>
            </div>
          ) : null}
        </div>
      ))}
      {!readOnly && !disabled && parsed.nodes.length === 0 ? (
        <select
          aria-label="첫 구성요소 추가"
          defaultValue=""
          onChange={(event) => {
            const snippet = componentSnippets[event.target.value];
            if (snippet) onReplace(0, 0, snippet);
            event.target.value = "";
          }}
        >
          <option value="">+ 구성요소 추가</option>
          {Object.keys(componentSnippets).map((name) => (
            <option value={name} key={name}>
              {name}
            </option>
          ))}
        </select>
      ) : null}
    </fieldset>
  );
}

const componentSnippets: Record<string, string> = {
  문단: "<Paragraph>새 문단</Paragraph>",
  제목: "<Subtitle level={2}>새 제목</Subtitle>",
  표: "| 제목 1 | 제목 2 |\n| --- | --- |\n| 내용 1 | 내용 2 |",
  코드블록: "```ts\n// 코드를 입력하세요\n```",
  퀴즈: '<ArticleQuiz>\n  <ArticleQuizItem mode="description" question="질문" answer="정답" />\n</ArticleQuiz>',
  이미지: "![이미지 설명](https://example.com/image.png)",
  콜아웃: "> 중요한 내용을 입력하세요.",
};
