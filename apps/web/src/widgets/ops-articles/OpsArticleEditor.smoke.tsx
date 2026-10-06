import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpsArticleEditor } from "./OpsArticleEditor";

afterEach(() => vi.unstubAllGlobals());

describe("OpsArticleEditor", () => {
  it("opens the selected MDX revision and prevents publishing unsaved edits", async () => {
    const article = {
      slug: "study/effective-typescript/day5",
      title: "Effective TypeScript Day 5",
      description: "Published description",
      category: "Study",
      status: "PUBLISHED",
      sourceFormat: "MDX",
      sourceText: "# Draft heading\n\nSaved revision",
      renderedHtml: "<h1>Draft heading</h1><p>Saved revision</p>",
      currentRevisionNumber: 1,
      editingRevisionNumber: 2,
      hasUnpublishedChanges: true,
      revisions: [
        {
          revisionNumber: 2,
          createdAt: "2026-10-03T00:00:00Z",
          isPublished: false,
        },
        {
          revisionNumber: 1,
          createdAt: "2026-10-02T00:00:00Z",
          isPublished: true,
        },
      ],
    };
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        Response.json(
          init?.method === "POST"
            ? { ok: true, article }
            : { ok: true, article, publicReadback: { status: 200 } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<OpsArticleEditor selectedSlug={article.slug} />);
    const source = await screen.findByRole("textbox", {
      name: "섹션 1 · Draft heading",
    });
    expect(source).toHaveValue("# Draft heading\n\nSaved revision");
    expect(screen.getByText("저장된 수정본 미리보기")).toBeInTheDocument();
    const preview = screen.getByTitle("저장된 MDX 수정본 미리보기");
    expect(preview).toHaveAttribute("sandbox", "");
    expect(preview.getAttribute("srcdoc")).toContain('name="viewport"');
    expect(preview.getAttribute("srcdoc")).toContain("font-family: A2z");
    expect(screen.getByText("발행 대기")).toBeInTheDocument();
    const publish = screen.getByRole("button", {
      name: "latest revision 발행",
    });
    expect(publish).toBeEnabled();

    fireEvent.change(source, {
      target: { value: "# Draft heading\n\nUnsaved change" },
    });
    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "revision 저장" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(
      JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)),
    ).toMatchObject({
      action: "saveRevision",
      slug: article.slug,
      sourceText: "# Draft heading\n\nUnsaved change",
    });
  });
});
