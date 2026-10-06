import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { splitMdxFrontmatter } from "./ops-article-editor.utils";
import { MdxRichEditor } from "./MdxRichEditor";

describe("MdxRichEditor", () => {
  it("renders the fs post as prose and edits only the selected JSX heading content", () => {
    const source = readFileSync(
      join(process.cwd(), "content/SEOJing/devLog/insight/nodejs-basics.mdx"),
      "utf8",
    );
    const { body } = splitMdxFrontmatter(source);
    const onReplace = vi.fn();
    const onError = vi.fn();
    render(
      <MdxRichEditor
        markdown={body}
        disabled={false}
        onReplace={onReplace}
        onError={onError}
      />,
    );

    const heading = screen.getByText("fs 모듈").closest("h2");
    expect(heading).not.toBeNull();
    expect(screen.getByText("왜 Node.js?")).toBeVisible();
    expect(screen.getByText("Sync vs Async")).toBeVisible();
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(1);
    expect(screen.getByText("파일 시스템 (읽기/쓰기)")).toBeVisible();
    expect(onReplace).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    heading!.textContent = "fs 파일 모듈";
    fireEvent.input(heading!);
    fireEvent.blur(heading!);
    const [start, end, replacement] = onReplace.mock.calls[0] ?? [];
    expect(replacement).toBe("fs 파일 모듈");
    expect(body.slice(start, end)).toBe("fs 모듈");

    const paragraph = screen
      .getByText(/MDX 파일 구조를 JSON/)
      .closest("[data-rich-body]");
    expect(paragraph).not.toBeNull();
    paragraph!.textContent = "Node.js의 파일 API를 배웠다.";
    fireEvent.input(paragraph!);
    fireEvent.blur(paragraph!);
    const [paragraphStart, paragraphEnd, paragraphReplacement] =
      onReplace.mock.calls[1] ?? [];
    expect(paragraphReplacement).toBe("Node.js의 파일 API를 배웠다.");
    expect(body.slice(paragraphStart, paragraphEnd)).toContain(
      "Node.js의 `fs`",
    );

    const tableCell = document.querySelector(
      "table tr:nth-child(2) td:nth-child(2)",
    );
    expect(tableCell).not.toBeNull();
    tableCell!.textContent = "파일 읽기와 쓰기";
    fireEvent.input(tableCell!);
    fireEvent.blur(tableCell!);
    const [cellStart, cellEnd, cellReplacement] = onReplace.mock.calls[2] ?? [];
    expect(body.slice(cellStart, cellEnd)).toBe("파일 시스템 (읽기/쓰기)");
    expect(cellReplacement).toBe("파일 읽기와 쓰기");
  });

  it("keeps an image-containing paragraph in source mode so editing cannot drop it", () => {
    render(
      <MdxRichEditor
        markdown="![architecture](/diagram.png)"
        disabled={false}
        onReplace={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText("특수 구성요소 원문 편집")).toBeVisible();
    expect(document.querySelector("[data-rich-body]")).toBeNull();
  });

  it("keeps multi-paragraph blockquotes in source mode to preserve their structure", () => {
    const onReplace = vi.fn();
    render(
      <MdxRichEditor
        markdown={"> first\n>\n> second"}
        disabled={false}
        onReplace={onReplace}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText("인용문 원문 편집")).toBeVisible();
    expect(document.querySelector("blockquote[data-rich-body]")).toBeNull();
    expect(
      screen.getByRole("textbox", { name: "인용문 원문 편집" }),
    ).toHaveValue("> first\n>\n> second");
    expect(onReplace).not.toHaveBeenCalled();
  });

  it("edits Markdown headings, simple quotes, and list items without replacing surrounding blocks", () => {
    const markdown = "## A heading\n\n> A quote\n\n- First item\n- Second item";
    const onReplace = vi.fn();
    render(
      <MdxRichEditor
        markdown={markdown}
        disabled={false}
        onReplace={onReplace}
        onError={vi.fn()}
      />,
    );

    const heading = screen.getByText("A heading").closest("h2")!;
    heading.textContent = "New heading";
    fireEvent.input(heading);
    fireEvent.blur(heading);
    expect(onReplace.mock.calls[0]?.[2]).toBe("## New heading");

    const quote = screen.getByText("A quote").closest("blockquote")!;
    quote.textContent = "Updated quote";
    fireEvent.input(quote);
    fireEvent.blur(quote);
    expect(onReplace.mock.calls[1]?.[2]).toBe("> Updated quote");

    const item = screen.getByText("Second item").closest("[data-rich-body]")!;
    item.textContent = "Updated item";
    fireEvent.input(item);
    fireEvent.blur(item);
    const [start, end, replacement] = onReplace.mock.calls[2] ?? [];
    expect(markdown.slice(start, end)).toBe("Second item");
    expect(replacement).toBe("Updated item");
  });

  it("edits fenced code contents while keeping the fence and language", () => {
    const markdown = "```ts\nconst a = 1;\n```";
    const onReplace = vi.fn();
    render(
      <MdxRichEditor
        markdown={markdown}
        disabled={false}
        onReplace={onReplace}
        onError={vi.fn()}
      />,
    );
    const code = screen.getByRole("textbox");
    fireEvent.change(code, { target: { value: "const a = 2;" } });
    fireEvent.blur(code);
    const [start, end, replacement] = onReplace.mock.calls[0] ?? [];
    expect(markdown.slice(start, end)).toBe("const a = 1;");
    expect(replacement).toBe("const a = 2;");
  });

  it("keeps nested lists and unsafe links in source mode", () => {
    render(
      <MdxRichEditor
        markdown={"- Parent\n  - Child\n\n[unsafe](javascript:alert%281%29)"}
        disabled={false}
        onReplace={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText("목록 원문 편집")).toBeVisible();
    expect(
      screen.getAllByText("특수 구성요소 원문 편집").length,
    ).toBeGreaterThan(0);
  });

  it("makes saved-revision preview read-only and preserves opaque component boundaries", () => {
    render(
      <MdxRichEditor
        markdown={"# Saved\n\n<ArticleQuiz />"}
        disabled={false}
        readOnly
        onReplace={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText("Saved").closest("h1")).toHaveAttribute(
      "contenteditable",
      "false",
    );
    expect(
      screen.getByText(/특수 구성요소 원문 편집 · 실제 공개 글/),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "굵게" })).toBeNull();
  });

  it("keeps attributed JSX and titled links in source mode instead of dropping metadata", () => {
    render(
      <MdxRichEditor
        markdown={
          '<Paragraph><strong className="highlight">Important</strong></Paragraph>\n\n[link](https://example.com "a title")'
        }
        disabled={false}
        onReplace={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getAllByText("특수 구성요소 원문 편집")).toHaveLength(2);
    expect(document.querySelector("[data-rich-body]")).toBeNull();
  });

  it("pastes plain text into a paragraph without retaining rich clipboard markup", () => {
    const onReplace = vi.fn();
    render(
      <MdxRichEditor
        markdown="Safe paragraph"
        disabled={false}
        onReplace={onReplace}
        onError={vi.fn()}
      />,
    );
    const paragraph = screen
      .getByText("Safe paragraph")
      .closest("[data-rich-body]")!;
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.paste(paragraph, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? "Pasted text" : "<script>ignored</script>",
      },
    });
    fireEvent.blur(paragraph);
    expect(onReplace.mock.calls[0]?.[2]).toBe("Pasted text");
    expect(paragraph.querySelector("script")).toBeNull();
  });

  it("preserves safe link and inline-code markup when editing adjacent prose", () => {
    const onReplace = vi.fn();
    render(
      <MdxRichEditor
        markdown="See [guide](https://example.com/docs) and `fs`."
        disabled={false}
        onReplace={onReplace}
        onError={vi.fn()}
      />,
    );
    const paragraph = screen.getByText("See").closest("[data-rich-body]")!;
    paragraph.querySelector("span")!.textContent = "Read ";
    fireEvent.input(paragraph);
    fireEvent.blur(paragraph);
    expect(onReplace.mock.calls[0]?.[2]).toContain(
      "[guide](https://example.com/docs)",
    );
    expect(onReplace.mock.calls[0]?.[2]).toContain("`fs`");
  });

  it("keeps a table with embedded images in source mode", () => {
    render(
      <MdxRichEditor
        markdown={
          "| Asset | Note |\n| --- | --- |\n| ![diagram](/diagram.png) | Keep image |"
        }
        disabled={false}
        onReplace={vi.fn()}
        onError={vi.fn()}
      />,
    );
    expect(screen.getByText("표 원문 편집")).toBeVisible();
    expect(document.querySelector("table")).toBeNull();
  });

  it("renders the Cloudflare Workers fs post's JSX subsections without showing tag text", () => {
    const source = readFileSync(
      join(process.cwd(), "content/SEOJing/cloudflare-workers-fs-issue.mdx"),
      "utf8",
    );
    const onError = vi.fn();
    const onReplace = vi.fn();
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
      screen
        .getByText("이슈 1: Cloudflare Workers에는 파일시스템이 없다")
        .closest("h2"),
    ).not.toBeNull();
    expect(
      screen.getByText("그러면 /blog 인덱스는 왜 동작했나?").closest("h3"),
    ).not.toBeNull();
    expect(screen.getByText("404 Not Found").closest("strong")).not.toBeNull();
    expect(screen.queryByText(/<Subtitle level=/)).toBeNull();
    expect(onError).not.toHaveBeenCalled();

    const strong = screen.getByText("404 Not Found");
    const paragraph = strong.closest("[data-rich-body]");
    expect(paragraph).not.toBeNull();
    const firstText = paragraph!.querySelector("span");
    expect(firstText).not.toBeNull();
    firstText!.textContent = "요청 결과가 ";
    fireEvent.input(paragraph!);
    fireEvent.blur(paragraph!);
    expect(onReplace.mock.calls[0]?.[2]).toContain("**404 Not Found**");
  });
});
