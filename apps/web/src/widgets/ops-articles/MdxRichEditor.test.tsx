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
