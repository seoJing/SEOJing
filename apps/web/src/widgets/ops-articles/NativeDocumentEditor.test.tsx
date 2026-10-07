import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  NativeDocumentEditor,
  canonicalizeArticleDocument,
  emptyArticleDocument,
} from "./NativeDocumentEditor";

afterEach(() => vi.unstubAllGlobals());

describe("JSON editor persistence boundary", () => {
  it("keeps supported rich formatting while dropping pasted unsafe marks and filling image alt text", () => {
    const document = canonicalizeArticleDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "underlined",
              marks: [{ type: "underline" }],
            },
            {
              type: "text",
              text: "styled",
              marks: [
                {
                  type: "textStyle",
                  attrs: {
                    color: "#123456",
                    fontSize: "18px",
                    fontFamily: "Arial",
                    lineHeight: "2",
                    backgroundColor: "red",
                  },
                },
              ],
            },
            {
              type: "text",
              text: "unsafe",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
            {
              type: "text",
              text: "mail",
              marks: [
                {
                  type: "link",
                  attrs: { href: "mailto:hello@example.com", target: "_blank" },
                },
              ],
            },
          ],
        },
        {
          type: "image",
          attrs: { src: "/image.png", alt: null, title: "paste title" },
        },
      ],
    });

    expect(document.content[0]?.content).toEqual([
      { type: "text", text: "underlined", marks: [{ type: "underline" }] },
      {
        type: "text",
        text: "styled",
        marks: [
          { type: "textStyle", attrs: { color: "#123456", fontSize: "18px" } },
        ],
      },
      { type: "text", text: "unsafe" },
      {
        type: "text",
        text: "mail",
        marks: [{ type: "link", attrs: { href: "mailto:hello@example.com" } }],
      },
    ]);
    expect(document.content[1]).toEqual({
      type: "image",
      attrs: { src: "/image.png", alt: "" },
    });
  });

  it("normalizes pasted table attributes and accepts only supported style and link values", () => {
    const document = canonicalizeArticleDocument({
      type: "doc",
      content: [
        {
          type: "tableCell",
          attrs: { colwidth: [80], align: "right", empty: null },
          content: [
            {
              type: "text",
              text: "safe",
              marks: [
                { type: "bold", attrs: { pasted: true } },
                { type: "unknown" },
                { type: "textStyle", attrs: { color: "rgb(12, 34, 56)" } },
                { type: "textStyle", attrs: { fontFamily: "serif" } },
                { type: "textStyle", attrs: { color: "url(bad)" } },
                { type: "link", attrs: { href: "/safe/path" } },
              ],
            },
          ],
        },
      ],
    });
    expect(document.content[0]?.attrs).toEqual({ align: "right" });
    expect(document.content[0]?.content?.[0]?.marks).toEqual([
      { type: "bold" },
      { type: "textStyle", attrs: { color: "rgb(12, 34, 56)" } },
      { type: "textStyle", attrs: { fontFamily: "serif" } },
      { type: "link", attrs: { href: "/safe/path" } },
    ]);
  });

  it("inserts and edits a quiz as structured document data", async () => {
    const onChange = vi.fn();
    render(
      <NativeDocumentEditor value={emptyArticleDocument} onChange={onChange} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "퀴즈" }));
    expect(await screen.findByLabelText("퀴즈 제목")).toHaveValue("확인 문제");
    fireEvent.change(screen.getByLabelText("문항 1 질문"), {
      target: { value: "첫 질문" },
    });
    await waitFor(() =>
      expect(
        onChange.mock.lastCall?.[0].content[0]?.attrs?.items[0]?.question,
      ).toBe("첫 질문"),
    );
    fireEvent.change(screen.getByLabelText("문항 1 유형"), {
      target: { value: "multiple" },
    });
    await waitFor(() =>
      expect(
        onChange.mock.lastCall?.[0].content[0]?.attrs?.items[0]?.mode,
      ).toBe("multiple"),
    );
    fireEvent.change(await screen.findByLabelText("문항 1 선택지"), {
      target: { value: "첫째\n둘째" },
    });
    await waitFor(() =>
      expect(
        onChange.mock.lastCall?.[0].content[0]?.attrs?.items[0]?.choices,
      ).toEqual(["첫째", "둘째"]),
    );
    fireEvent.change(await screen.findByLabelText("문항 1 정답"), {
      target: { value: "1" },
    });
    await waitFor(() =>
      expect(
        onChange.mock.lastCall?.[0].content[0]?.attrs?.items[0]?.answer,
      ).toBe(1),
    );
    fireEvent.click(screen.getByRole("button", { name: "문항 추가" }));
    expect(await screen.findByLabelText("문항 2 질문")).toBeVisible();
    fireEvent.click(
      screen.getAllByRole("button", { name: "문항 삭제" }).at(-1)!,
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("문항 2 질문")).not.toBeInTheDocument(),
    );
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall?.[0].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "quiz",
          attrs: expect.objectContaining({
            items: [
              expect.objectContaining({ question: "첫 질문", answer: 1 }),
            ],
          }),
        }),
      ]),
    );
  });

  it("keeps rich controls disabled in read-only mode", async () => {
    render(
      <NativeDocumentEditor
        value={emptyArticleDocument}
        onChange={vi.fn()}
        disabled
      />,
    );
    for (const name of [
      "굵게",
      "밑줄",
      "링크",
      "이미지",
      "표",
      "메모",
      "퀴즈",
    ]) {
      expect(await screen.findByRole("button", { name })).toBeDisabled();
    }
  });

  it("inserts images with alternative text and ignores unsafe image URLs", async () => {
    const onChange = vi.fn();
    const prompt = vi
      .fn()
      .mockReturnValueOnce("javascript:alert(1)")
      .mockReturnValueOnce("/images/article.png")
      .mockReturnValueOnce("Article diagram");
    vi.stubGlobal("prompt", prompt);
    render(
      <NativeDocumentEditor value={emptyArticleDocument} onChange={onChange} />,
    );
    const imageButton = await screen.findByRole("button", { name: "이미지" });

    const initialChanges = onChange.mock.calls.length;
    fireEvent.click(imageButton);
    expect(onChange).toHaveBeenCalledTimes(initialChanges);
    fireEvent.click(imageButton);
    await waitFor(() =>
      expect(onChange.mock.lastCall?.[0].content).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "image",
            attrs: expect.objectContaining({
              src: "/images/article.png",
              alt: "Article diagram",
            }),
          }),
        ]),
      ),
    );
  });

  it("adds a table and leaves row and column controls unavailable outside a selected cell", async () => {
    const onChange = vi.fn();
    render(
      <NativeDocumentEditor value={emptyArticleDocument} onChange={onChange} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "표" }));
    expect(await screen.findByRole("table")).toBeVisible();
    const rowButton = screen.getByRole("button", { name: "행 추가" });
    const columnButton = screen.getByRole("button", { name: "열 추가" });
    expect(rowButton).toBeDisabled();
    expect(columnButton).toBeDisabled();
    await waitFor(() =>
      expect(onChange.mock.lastCall?.[0].content[0]?.type).toBe("table"),
    );
  });
});
