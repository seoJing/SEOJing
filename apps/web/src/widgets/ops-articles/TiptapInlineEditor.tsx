"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { FiBold, FiItalic, FiLink2, FiRotateCcw } from "react-icons/fi";

const control =
  "rounded-md border border-zinc-200 p-1.5 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800";
const select =
  "rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900";

export function TiptapInlineEditor({
  html,
  onCommit,
  readOnly,
  tag = "p",
  className = "",
}: {
  html: string;
  onCommit: (html: string) => void;
  readOnly: boolean;
  tag?: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  className?: string;
}) {
  const changed = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextStyleKit,
    ],
    content: `<${tag}>${html}</${tag}>`,
    editable: !readOnly,
    onUpdate: () => {
      changed.current = true;
    },
  });
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  if (!editor)
    return (
      <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
    );
  return (
    <div
      ref={root}
      className={`group min-w-0 ${className}`}
      onBlur={(event) => {
        if (
          !changed.current ||
          (event.relatedTarget &&
            root.current?.contains(event.relatedTarget as globalThis.Node))
        )
          return;
        changed.current = false;
        onCommit(editor.getHTML());
      }}
    >
      {!readOnly ? (
        <div className="mb-2 hidden flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1.5 group-focus-within:flex dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            title="굵게"
            aria-label="굵게"
            className={control}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <FiBold />
          </button>
          <button
            type="button"
            title="기울임"
            aria-label="기울임"
            className={control}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <FiItalic />
          </button>
          <button
            type="button"
            title="링크"
            aria-label="링크"
            className={control}
            onClick={() => {
              const href = window.prompt(
                "링크 URL",
                editor.getAttributes("link").href ?? "https://",
              );
              if (
                href?.startsWith("https://") ||
                href?.startsWith("http://") ||
                href?.startsWith("/")
              )
                editor.chain().focus().setLink({ href }).run();
            }}
          >
            <FiLink2 />
          </button>
          <button
            type="button"
            title="글자 스타일 초기화"
            aria-label="글자 스타일 초기화"
            className={control}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().unsetAllMarks().run()}
          >
            <FiRotateCcw />
          </button>
          <select
            aria-label="글꼴"
            className={select}
            defaultValue=""
            onChange={(event) => {
              if (event.target.value)
                editor.chain().focus().setFontFamily(event.target.value).run();
              else editor.chain().focus().unsetFontFamily().run();
            }}
          >
            <option value="">글꼴</option>
            <option value="sans-serif">고딕</option>
            <option value="serif">명조</option>
            <option value="monospace">고정폭</option>
          </select>
          <select
            aria-label="글자 크기"
            className={select}
            defaultValue=""
            onChange={(event) => {
              if (event.target.value)
                editor.chain().focus().setFontSize(event.target.value).run();
              else editor.chain().focus().unsetFontSize().run();
            }}
          >
            <option value="">크기</option>
            <option value="12px">12</option>
            <option value="14px">14</option>
            <option value="16px">16</option>
            <option value="18px">18</option>
            <option value="24px">24</option>
            <option value="32px">32</option>
          </select>
          <label className="flex items-center gap-1 text-xs">
            색상{" "}
            <input
              aria-label="글자 색상"
              type="color"
              defaultValue="#202124"
              onChange={(event) =>
                editor.chain().focus().setColor(event.target.value).run()
              }
            />
          </label>
        </div>
      ) : null}
      <EditorContent
        editor={editor}
        className="article-prose min-h-8 rounded-md px-2 py-1 leading-8 outline-none focus-within:ring-1 focus-within:ring-zinc-300 [&_.tiptap]:outline-none [&_.tiptap_p]:m-0"
      />
    </div>
  );
}
