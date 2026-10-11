"use client";

import { useEffect } from "react";
import {
  Extension,
  Node,
  mergeAttributes,
  type JSONContent,
} from "@tiptap/core";
import { Image } from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { TextStyleKit } from "@tiptap/extension-text-style";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export type ArticleDocument = JSONContent & {
  type: "doc";
  content: JSONContent[];
};

export const emptyArticleDocument: ArticleDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const toolbarButton =
  "rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800";

type QuizItem = {
  question: string;
  mode: "multiple" | "description" | "essay";
  answer: string | number;
  choices?: string[];
  explanation?: string;
};

function QuizView({ node, updateAttributes, selected }: NodeViewProps) {
  const items = (node.attrs.items ?? []) as QuizItem[];
  const changeItem = (index: number, patch: Partial<QuizItem>) =>
    updateAttributes({
      items: items.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    });
  return (
    <NodeViewWrapper
      className={`my-5 rounded-2xl border p-4 ${selected ? "border-blue-500" : "border-zinc-300 dark:border-zinc-700"}`}
    >
      <label className="block text-sm font-semibold">
        퀴즈 제목
        <input
          className="mt-1 w-full rounded-lg border p-2 dark:bg-zinc-900"
          value={String(node.attrs.title ?? "")}
          onChange={(event) => updateAttributes({ title: event.target.value })}
        />
      </label>
      {items.map((item, index) => (
        <div
          key={index}
          className="mt-3 space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between gap-2">
            <strong className="text-xs">문항 {index + 1}</strong>
            <button
              type="button"
              className={toolbarButton}
              disabled={items.length === 1}
              onClick={() =>
                updateAttributes({
                  items: items.filter((_, position) => position !== index),
                })
              }
            >
              문항 삭제
            </button>
          </div>
          <input
            aria-label={`문항 ${index + 1} 질문`}
            className="w-full rounded-lg border p-2 dark:bg-zinc-900"
            value={item.question}
            onChange={(event) =>
              changeItem(index, { question: event.target.value })
            }
            placeholder="질문"
          />
          <select
            aria-label={`문항 ${index + 1} 유형`}
            className="rounded-lg border p-2 dark:bg-zinc-900"
            value={item.mode}
            onChange={(event) =>
              changeItem(index, {
                mode: event.target.value as QuizItem["mode"],
                choices:
                  event.target.value === "multiple"
                    ? item.choices?.length
                      ? item.choices
                      : ["선택지 1", "선택지 2"]
                    : undefined,
              })
            }
          >
            <option value="description">단답형</option>
            <option value="multiple">객관식</option>
            <option value="essay">서술형</option>
          </select>
          {item.mode === "multiple" ? (
            <textarea
              aria-label={`문항 ${index + 1} 선택지`}
              className="w-full rounded-lg border p-2 dark:bg-zinc-900"
              value={(item.choices ?? []).join("\n")}
              onChange={(event) =>
                changeItem(index, { choices: event.target.value.split("\n") })
              }
              rows={3}
              placeholder="선택지 한 줄에 하나씩"
            />
          ) : null}
          {item.mode === "multiple" ? (
            <select
              aria-label={`문항 ${index + 1} 정답`}
              className="w-full rounded-lg border p-2 dark:bg-zinc-900"
              value={String(
                typeof item.answer === "number"
                  ? item.answer
                  : Math.max(0, (item.choices ?? []).indexOf(item.answer)),
              )}
              onChange={(event) =>
                changeItem(index, { answer: Number(event.target.value) })
              }
            >
              {(item.choices ?? []).map((choice, position) => (
                <option key={position} value={position}>
                  {position + 1}. {choice}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label={`문항 ${index + 1} 정답`}
              className="w-full rounded-lg border p-2 dark:bg-zinc-900"
              value={String(item.answer)}
              onChange={(event) =>
                changeItem(index, { answer: event.target.value })
              }
              placeholder="정답"
            />
          )}
          <input
            aria-label={`문항 ${index + 1} 해설`}
            className="w-full rounded-lg border p-2 dark:bg-zinc-900"
            value={item.explanation ?? ""}
            onChange={(event) =>
              changeItem(index, { explanation: event.target.value })
            }
            placeholder="해설 (선택)"
          />
        </div>
      ))}
      <button
        type="button"
        className={`${toolbarButton} mt-3`}
        onClick={() =>
          updateAttributes({
            items: [
              ...items,
              { question: "새 질문", mode: "description", answer: "" },
            ],
          })
        }
      >
        문항 추가
      </button>
    </NodeViewWrapper>
  );
}

const Quiz = Node.create({
  name: "quiz",
  group: "block",
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      title: { default: "확인 문제" },
      items: {
        default: [{ question: "질문", mode: "description", answer: "정답" }],
      },
    };
  },
  parseHTML() {
    return [{ tag: "section[data-article-quiz]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, { "data-article-quiz": "" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(QuizView);
  },
});

const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { tone: { default: "note" }, title: { default: "메모" } };
  },
  parseHTML() {
    return [{ tag: "aside[data-article-callout]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "aside",
      mergeAttributes(HTMLAttributes, { "data-article-callout": "" }),
      0,
    ];
  },
});

const ArticleImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: { default: "" },
      size: { default: "md" },
    };
  },
});

const TableAlignment = Extension.create({
  name: "articleTableAlignment",
  addGlobalAttributes() {
    return [
      {
        types: ["tableCell", "tableHeader"],
        attributes: {
          align: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.textAlign || null,
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.align ? { style: `text-align:${attrs.align}` } : {},
          },
        },
      },
    ];
  },
});

export function canonicalizeArticleDocument(
  value: JSONContent,
): ArticleDocument {
  const safeUrl = (url: unknown) =>
    typeof url === "string" &&
    /^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*|#[^\s]+|mailto:[^\s@]+@[^\s@]+\.[^\s@]+)$/i.test(
      url,
    );
  const visit = (node: JSONContent): JSONContent => {
    const attrs = { ...(node.attrs ?? {}) };
    for (const [key, entry] of Object.entries(attrs)) {
      if (entry === null || entry === undefined) delete attrs[key];
    }
    if (node.type === "image") {
      delete attrs.title;
      attrs.alt = typeof attrs.alt === "string" ? attrs.alt : "";
    }
    if (node.type === "tableCell" || node.type === "tableHeader")
      delete attrs.colwidth;
    const marks = node.marks?.flatMap((mark) => {
      if (mark.type === "textStyle") {
        const allowed = Object.fromEntries(
          Object.entries(mark.attrs ?? {}).filter(
            ([key, entry]) =>
              typeof entry === "string" &&
              (key === "color"
                ? /^#[\da-f]{3,8}$|^rgb\([\d,\s]+\)$/i.test(entry)
                : key === "fontSize"
                  ? /^\d{1,2}px$/.test(entry)
                  : key === "fontFamily"
                    ? ["sans-serif", "serif", "monospace"].includes(entry)
                    : false),
          ),
        );
        return Object.keys(allowed).length
          ? [
              {
                type: "textStyle",
                attrs: allowed,
              },
            ]
          : [];
      }
      if (mark.type === "link")
        return safeUrl(mark.attrs?.href)
          ? [{ type: "link", attrs: { href: mark.attrs?.href } }]
          : [];
      return ["bold", "italic", "underline", "strike", "code"].includes(
        mark.type,
      )
        ? [{ type: mark.type }]
        : [];
    });
    return {
      type: node.type,
      ...(Object.keys(attrs).length ? { attrs } : {}),
      ...(node.text !== undefined ? { text: node.text } : {}),
      ...(marks?.length ? { marks } : {}),
      ...(node.content ? { content: node.content.map(visit) } : {}),
    };
  };
  return visit(value) as ArticleDocument;
}

export function NativeDocumentEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: ArticleDocument;
  onChange: (document: ArticleDocument) => void;
  disabled?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextStyleKit,
      TableKit,
      TableAlignment,
      ArticleImage,
      Quiz,
      Callout,
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor: current }) =>
      onChange(canonicalizeArticleDocument(current.getJSON())),
  });
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  if (!editor)
    return <p className="text-sm text-zinc-500">편집기 불러오는 중…</p>;

  const insertImage = () => {
    const src = window.prompt("이미지 URL (https:// 또는 /로 시작)");
    if (!src || !/^(https?:\/\/|\/(?!\/))/.test(src)) return;
    const alt = window.prompt("이미지 설명 (대체 텍스트)") ?? "";
    editor.chain().focus().setImage({ src, alt }).run();
  };
  const insertLink = () => {
    const href = window.prompt("링크 URL (https:// 또는 /로 시작)");
    if (!href || !/^(https?:\/\/|\/(?!\/))/.test(href)) return;
    editor.chain().focus().setLink({ href }).run();
  };

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap gap-1.5" aria-label="본문 서식 도구">
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          굵게
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          기울임
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          밑줄
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          제목
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          목록
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          번호 목록
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          인용
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          코드
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={insertLink}
        >
          링크
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={insertImage}
        >
          이미지
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          표
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled || !editor.isActive("table")}
          onClick={() => editor.chain().focus().addRowAfter().run()}
        >
          행 추가
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled || !editor.isActive("table")}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
        >
          열 추가
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: "callout",
                attrs: { tone: "note", title: "메모" },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "내용을 입력하세요" }],
                  },
                ],
              })
              .run()
          }
        >
          메모
        </button>
        <button
          type="button"
          className={toolbarButton}
          disabled={disabled}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent({
                type: "quiz",
                attrs: {
                  title: "확인 문제",
                  items: [
                    { question: "질문", mode: "description", answer: "정답" },
                  ],
                },
              })
              .run()
          }
        >
          퀴즈
        </button>
      </div>
      <EditorContent
        editor={editor}
        className="article-prose min-h-80 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 [&_.tiptap]:min-h-72 [&_.tiptap]:outline-none [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2"
      />
    </div>
  );
}
