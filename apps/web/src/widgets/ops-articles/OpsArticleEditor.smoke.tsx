import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpsArticleEditor } from "./OpsArticleEditor";

afterEach(() => vi.unstubAllGlobals());

describe("OpsArticleEditor", () => {
  it("keeps the rendered editor visible and separates revision save from visibility", async () => {
    let article = {
      slug: "study/effective-typescript/day5",
      title: "Day 5",
      description: "Original",
      category: "Study",
      status: "DRAFT",
      sourceFormat: "MDX",
      sourceText: "# Heading\n\nParagraph",
      renderedHtml: "<h1>Heading</h1><p>Paragraph</p>",
      previewRenderedHtml: "<h1>Heading</h1><p>Paragraph</p>",
      editingRevisionNumber: 1,
      hasUnpublishedChanges: false,
    };
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          const request = JSON.parse(String(init.body));
          article = {
            ...article,
            description: request.description,
            editingRevisionNumber: 2,
            hasUnpublishedChanges: true,
          };
        }
        return Response.json({
          ok: true,
          article,
          publicReadback: { status: 404 },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<OpsArticleEditor selectedSlug={article.slug} />);
    expect(await screen.findByText("Heading")).toBeVisible();
    expect(screen.getByText("Paragraph")).toBeVisible();
    expect(screen.queryByTitle("CMS 서버 변환 미리보기")).toBeNull();
    expect(
      screen.getByRole("combobox", { name: "구성요소 추가 1" }),
    ).toBeVisible();
    const visibility = screen.getByRole("button", { name: "비공개 → 공개" });
    fireEvent.change(screen.getByRole("textbox", { name: "description" }), {
      target: { value: "Edited" },
    });
    expect(visibility).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(
      JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)),
    ).toMatchObject({ action: "saveRevision", description: "Edited" });
    expect(visibility).toBeEnabled();
  });

  it("blocks public conversion when backend omitted a component", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          article: {
            slug: "cms-quiz",
            status: "DRAFT",
            sourceFormat: "MDX",
            sourceText:
              '<ArticleQuiz><ArticleQuizItem mode="description" question="Q" answer="A" /></ArticleQuiz>',
            renderedHtml:
              "<aside>ArticleQuiz component omitted by backend MDX ingest MVP</aside>",
            previewRenderedHtml:
              "<aside>ArticleQuiz component omitted by backend MDX ingest MVP</aside>",
          },
          publicReadback: { status: 404 },
        }),
      ),
    );
    render(<OpsArticleEditor selectedSlug="cms-quiz" />);
    expect(
      await screen.findByText(
        "서버 변환에서 구성요소 또는 글자 서식이 보존되지 않아 공개 전환을 막았습니다. 편집본은 저장할 수 있습니다.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "비공개 → 공개" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });
});
