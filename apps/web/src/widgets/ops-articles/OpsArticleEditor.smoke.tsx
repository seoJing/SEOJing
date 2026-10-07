import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpsArticleEditor } from "./OpsArticleEditor";

afterEach(() => vi.unstubAllGlobals());

describe("OpsArticleEditor", () => {
  it("saves a JSON document revision without publishing it", async () => {
    let article = {
      slug: "study/native-post",
      title: "Native post",
      description: "Original",
      category: "Study",
      status: "DRAFT",
      sourceFormat: "DOCUMENT",
      document: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Paragraph" }] },
        ],
      },
      editingRevisionId: "revision-1",
      editingRevisionNumber: 1,
      hasUnpublishedChanges: false,
      revisions: [],
    };
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          const request = JSON.parse(String(init.body));
          article = {
            ...article,
            description: request.description,
            editingRevisionId: "revision-2",
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
    expect(await screen.findByText("Paragraph")).toBeVisible();
    const visibility = screen.getByRole("button", { name: "비공개 → 공개" });
    fireEvent.change(screen.getByRole("textbox", { name: "description" }), {
      target: { value: "Edited" },
    });
    expect(visibility).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(
      JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)),
    ).toMatchObject({
      action: "saveDocument",
      description: "Edited",
      expectedRevisionId: "revision-1",
      document: article.document,
    });
    expect(visibility).toBeEnabled();
  });

  it("keeps unmigrated MDX read-only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          article: {
            slug: "old-post",
            title: "Old post",
            status: "DRAFT",
            sourceFormat: "MDX",
            sourceText: "# Old post",
          },
          publicReadback: { status: 404 },
        }),
      ),
    );
    render(<OpsArticleEditor selectedSlug="old-post" />);
    expect(await screen.findByText(/이 글은 이전 형식입니다/)).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "이전 원문 (읽기 전용)" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "비공개 → 공개" }),
    ).toBeDisabled();
  });
});
