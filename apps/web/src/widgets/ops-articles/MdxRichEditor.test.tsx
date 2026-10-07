import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { splitMdxFrontmatter } from "./ops-article-editor.utils";
import { MdxRichEditor, serializeInline } from "./MdxRichEditor";

describe("MdxRichEditor", () => {
  it("shows the real Fs article as rendered prose without changing source on load", () => {
    const source = readFileSync(
      join(process.cwd(), "content/SEOJing/cloudflare-workers-fs-issue.mdx"),
      "utf8",
    );
    const onReplace = vi.fn();
    const onError = vi.fn();
    render(
      <MdxRichEditor
        markdown={splitMdxFrontmatter(source).body}
        disabled={false}
        onReplace={onReplace}
        onError={onError}
      />,
    );
    expect(screen.getByText("문제 상황").closest("h2")).not.toBeNull();
    expect(
      screen.getByText("그러면 /blog 인덱스는 왜 동작했나?").closest("h3"),
    ).not.toBeNull();
    expect(screen.getByText("404 Not Found").closest("strong")).not.toBeNull();
    expect(screen.queryByText(/<Subtitle level=/)).toBeNull();
    expect(onReplace).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("inserts and removes a quiz at an exact MDX boundary", () => {
    const markdown = "# Heading\n\nParagraph";
    const onReplace = vi.fn();
    render(
      <MdxRichEditor
        markdown={markdown}
        disabled={false}
        onReplace={onReplace}
        onError={vi.fn()}
      />,
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "구성요소 추가 1" }),
      { target: { value: "퀴즈" } },
    );
    expect(onReplace).toHaveBeenCalledWith(
      9,
      9,
      expect.stringContaining("<ArticleQuiz>"),
    );
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "이 구성요소 제거" })[1]!,
    );
    expect(onReplace).toHaveBeenCalledWith(11, markdown.length, "");
    vi.unstubAllGlobals();
  });

  it("keeps opaque content editable without dropping source", () => {
    const markdown = "![architecture](/diagram.png)\n\n> first\n>\n> second";
    const onReplace = vi.fn();
    render(
      <MdxRichEditor
        markdown={markdown}
        disabled={false}
        onReplace={onReplace}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText("특수 구성요소 원문 편집")).toBeVisible();
    expect(screen.getByText("인용문 원문 편집")).toBeVisible();
    expect(onReplace).not.toHaveBeenCalled();
  });

  it("renders supported quiz content and keeps its source accessible for edits", () => {
    render(
      <MdxRichEditor
        markdown={
          '<ArticleQuiz>\n<ArticleQuizItem mode="multiple" question="Q" choices={["A", "B"]} answer={0} />\n</ArticleQuiz>'
        }
        disabled={false}
        onReplace={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText("Q")).toBeVisible();
    expect(screen.getByText("퀴즈 내용 수정")).toBeVisible();
  });

  it("does not expose mutation controls in read-only mode", () => {
    render(
      <MdxRichEditor
        markdown="# Saved"
        disabled={false}
        readOnly
        onReplace={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Saved").closest("[contenteditable]"),
    ).toHaveAttribute("contenteditable", "false");
    expect(
      screen.queryByRole("combobox", { name: /구성요소 추가/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "굵게" })).toBeNull();
  });

  it("serializes supported rich marks and rejects unsafe links", () => {
    const html = new DOMParser().parseFromString(
      '<p><strong>Bold</strong> <em>Italic</em> <span style="color:#ff0000;font-size:18px;font-family:serif">Color</span> <a href="javascript:alert(1)">bad</a> <a href="https://example.com">good</a></p>',
      "text/html",
    );
    expect(serializeInline(html.body)).toContain("**Bold**");
    expect(serializeInline(html.body)).toContain("*Italic*");
    expect(serializeInline(html.body)).toContain(
      '<span style={{ color: "rgb(255, 0, 0)", fontSize: "18px", fontFamily: "serif" }}>Color</span>',
    );
    expect(serializeInline(html.body)).not.toContain("javascript:");
    expect(serializeInline(html.body)).toContain("[good](https://example.com)");
  });
});
