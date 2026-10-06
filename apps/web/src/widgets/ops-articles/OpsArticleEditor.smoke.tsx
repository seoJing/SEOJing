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
    let saved = article;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          const data = JSON.parse(String(init.body));
          saved = {
            ...saved,
            sourceText: data.sourceText,
            editingRevisionNumber: 3,
          };
          return Response.json({ ok: true, article: saved });
        }
        return Response.json({
          ok: true,
          article: saved,
          publicReadback: { status: 200, html: "<h1>Published revision</h1>" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<OpsArticleEditor selectedSlug={article.slug} />);
    await screen.findByText("기존 웹 글 비교 · 저장본과 별개");
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "CMS 저장본 미리보기" }),
      ).toHaveTextContent("Saved revision"),
    );
    fireEvent.click(screen.getByRole("button", { name: "MDX 원문 보기" }));
    const source = screen.getByRole("textbox", { name: "MDX 원문" });
    expect(source).toHaveValue("# Draft heading\n\nSaved revision");
    const preview = screen.getByTitle("기존 웹 글 비교 · 저장본과 별개");
    expect(preview).toHaveAttribute(
      "src",
      "/blog/study/effective-typescript/day5",
    );
    expect(preview).toHaveAttribute("sandbox", "allow-same-origin");
    expect(
      screen.getByTitle("CMS 공개 API 본문 비교").getAttribute("srcdoc"),
    ).toContain("Published revision");
    expect(
      screen.getByTitle("CMS 서버 HTML 변환 결과").getAttribute("srcdoc"),
    ).toContain("Saved revision");
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
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "CMS 저장본 미리보기" }),
      ).toHaveTextContent("Unsaved change"),
    );
    expect(
      screen.getByRole("region", { name: "CMS 저장본 미리보기" }),
    ).toHaveTextContent("revision 3");
  });

  it("does not show a broken public iframe for a CMS-only draft", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          article: {
            slug: "cms-only-draft",
            sourceFormat: "MDX",
            sourceText: "# Saved draft",
            status: "DRAFT",
          },
          publicReadback: { status: 404 },
        }),
      ),
    );
    render(<OpsArticleEditor selectedSlug="cms-only-draft" />);
    expect(await screen.findByText("CMS 저장본 시각 점검")).toBeVisible();
    expect(screen.queryByTitle("기존 웹 글 비교 · 저장본과 별개")).toBeNull();
  });

  it("shows backend published HTML without linking to a nonexistent static route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          article: {
            slug: "cms-only-published",
            sourceFormat: "MDX",
            sourceText: "# Saved",
            status: "PUBLISHED",
          },
          publicReadback: { status: 200, html: "<h1>Public backend body</h1>" },
        }),
      ),
    );
    render(<OpsArticleEditor selectedSlug="cms-only-published" />);
    expect(await screen.findByTitle("CMS 공개 API 본문 비교")).toHaveAttribute(
      "srcdoc",
      expect.stringContaining("Public backend body"),
    );
    expect(screen.queryByTitle("기존 웹 글 비교 · 저장본과 별개")).toBeNull();
  });
});
