"use client";

import { useEffect, useMemo } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";

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

function serializeInline(element: Element): string {
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
        return href ? `[${content}](${href})` : content;
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

function Editable({
  tag,
  children,
  onCommit,
  readOnly,
}: {
  tag: "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "blockquote";
  children: React.ReactNode;
  onCommit: (markdown: string) => void;
  readOnly: boolean;
}) {
  const Tag = tag;
  return (
    <Tag
      contentEditable={!readOnly}
      suppressContentEditableWarning
      data-rich-body
      onInput={(event) => {
        event.currentTarget.dataset.changed = "true";
      }}
      onPaste={pastePlainText}
      onBlur={(event) => {
        if (event.currentTarget.dataset.changed !== "true") return;
        event.currentTarget.dataset.changed = "false";
        onCommit(serializeInline(event.currentTarget));
      }}
      className={`min-w-0 rounded-md px-2 py-1 leading-8 outline-none hover:bg-zinc-50 focus:bg-zinc-50 focus:ring-1 focus:ring-zinc-300 dark:hover:bg-zinc-900 dark:focus:bg-zinc-900 ${tag === "h1" ? "text-3xl font-bold" : tag === "h2" ? "text-2xl font-semibold" : tag === "h3" ? "text-xl font-semibold" : tag === "h4" || tag === "h5" || tag === "h6" ? "text-lg font-semibold" : tag === "blockquote" ? "border-l-4 border-zinc-300 pl-4 italic dark:border-zinc-700" : "text-base"}`}
    >
      {children}
    </Tag>
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
        readOnly={readOnly}
        tag={`h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"}
        onCommit={(markdown) => onReplace(range.start, range.end, markdown)}
      >
        <Inline nodes={component.children ?? []} />
      </Editable>
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
        readOnly={readOnly}
        tag="div"
        onCommit={(markdown) => onReplace(range.start, range.end, markdown)}
      >
        <Inline nodes={component.children ?? []} />
      </Editable>
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
        readOnly={readOnly}
        tag={tag}
        onCommit={(markdown) =>
          onReplace(start, end, `${"#".repeat(node.depth ?? 2)} ${markdown}`)
        }
      >
        <Inline nodes={node.children ?? []} />
      </Editable>
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
        readOnly={readOnly}
        tag={node.type === "blockquote" ? "blockquote" : "div"}
        onCommit={(markdown) =>
          onReplace(
            start,
            end,
            node.type === "blockquote" ? `> ${markdown}` : markdown,
          )
        }
      >
        <Inline
          nodes={
            node.type === "blockquote"
              ? (node.children?.[0]?.children ?? [])
              : (node.children ?? [])
          }
        />
      </Editable>
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
              readOnly={readOnly}
              tag="div"
              onCommit={(markdown) => {
                const range = itemRanges[index];
                if (range) onReplace(range.start, range.end, markdown);
              }}
            >
              <Inline nodes={item.children ?? []} />
            </Editable>
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
      {!readOnly ? (
        <div className="flex gap-2 border-b border-zinc-200 pb-3 text-xs dark:border-zinc-800">
          {(["bold", "italic"] as const).map((format) => (
            <button
              key={format}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                document.execCommand(format);
                const active =
                  document.activeElement?.closest<HTMLElement>(
                    "[data-rich-body]",
                  );
                if (active) active.dataset.changed = "true";
              }}
              className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700"
              aria-label={format === "bold" ? "굵게" : "기울임"}
            >
              {format === "bold" ? "굵게" : "기울임"}
            </button>
          ))}
          <span className="self-center text-zinc-500">
            문단을 클릭해 편집 · 영역 밖을 클릭하면 반영
          </span>
        </div>
      ) : null}
      {parsed.nodes.map((node, index) => (
        <VisualNode
          key={`${index}:${node.position?.start.offset ?? 0}`}
          node={node}
          body={markdown}
          onReplace={onReplace}
          readOnly={readOnly || disabled}
        />
      ))}
    </fieldset>
  );
}
