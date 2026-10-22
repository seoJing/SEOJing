import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpsArticleEditor } from "./OpsArticleEditor";

vi.mock("@/shared/content/ArticlePreview", () => ({
  ArticlePreview: ({ article }: { article: { title?: string } }) => (
    <div data-testid="article-preview">{article.title ?? "preview"}</div>
  ),
}));

vi.mock("./NativeDocumentEditor", () => ({
  emptyArticleDocument: { type: "doc", content: [{ type: "paragraph" }] },
  NativeDocumentEditor: ({
    onChange,
    disabled,
  }: {
    onChange: (document: object) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() =>
        onChange({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "edited" }] },
          ],
        })
      }
    >
      문서 본문 수정
    </button>
  ),
}));

const documentArticle = {
  slug: "study/document",
  title: "Document title",
  description: "Document description",
  category: "Study",
  status: "PUBLISHED",
  sourceFormat: "DOCUMENT",
  document: { type: "doc", content: [{ type: "paragraph" }] },
  tags: ["cms", "json"],
  cover: { src: "/cover.png", alt: "cover" },
  summaryVideo: { src: "/summary.mp4", title: "Summary" },
  displayDate: "2026-10-20T00:00:00Z",
  displayUpdatedAt: "2026-10-21T00:00:00Z",
  editingRevisionId: "revision-2",
  editingRevisionNumber: 2,
  currentRevisionNumber: 2,
  hasUnpublishedChanges: false,
  preview: { title: "Published preview" },
  revisions: [
    {
      revisionNumber: 1,
      sourceFormat: "DOCUMENT",
      changeSummary: "initial",
      createdAt: "2026-10-20T00:00:00Z",
      isPublished: false,
    },
    {
      revisionNumber: 2,
      sourceFormat: "DOCUMENT",
      createdAt: "2026-10-21T00:00:00Z",
      isPublished: true,
    },
  ],
};

const response = (body: object, ok = true, status = ok ? 200 : 400) =>
  ({ ok, status, json: async () => body }) as Response;

function requestAction(init?: RequestInit) {
  return init?.body ? JSON.parse(String(init.body)).action : undefined;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OpsArticleEditor", () => {
  it("edits, previews, saves, publishes, and restores a native document revision", async () => {
    const mutations: Array<Record<string, unknown>> = [];
    let currentArticle = documentArticle;
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const action = requestAction(init);
      if (!action) return response({ ok: true, article: currentArticle });
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      mutations.push(payload);
      if (action === "preview") {
        return response({ ok: true, preview: { title: "Draft preview" } });
      }
      if (action === "saveDocument") {
        currentArticle = {
          ...documentArticle,
          title: String(payload.title),
          document: payload.document as typeof documentArticle.document,
          tags: payload.tags as string[],
          cover: payload.cover as typeof documentArticle.cover,
          hasUnpublishedChanges: true,
        };
      } else if (action === "publish") {
        currentArticle = { ...currentArticle, hasUnpublishedChanges: false };
      }
      return response({ ok: true, article: currentArticle });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<OpsArticleEditor selectedSlug="study/document" />);

    expect(await screen.findByDisplayValue("Document title")).toBeVisible();
    expect(screen.getByText("Published preview")).toBeVisible();
    expect(screen.getByRole("link", { name: "공개 글 보기" })).toHaveAttribute(
      "href",
      "/blog/study/document",
    );

    fireEvent.change(screen.getByDisplayValue("Document title"), {
      target: { value: "Edited title" },
    });
    fireEvent.change(screen.getByDisplayValue("cms, json"), {
      target: { value: "cms, tested, " },
    });
    fireEvent.change(screen.getByDisplayValue("/cover.png"), {
      target: { value: "/new-cover.png" },
    });
    fireEvent.change(screen.getByDisplayValue("cover"), {
      target: { value: "new cover" },
    });
    fireEvent.click(screen.getByRole("button", { name: "문서 본문 수정" }));

    expect(await screen.findByText("Draft preview")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(mutations.some(({ action }) => action === "saveDocument")).toBe(
        true,
      ),
    );
    expect(
      mutations.find(({ action }) => action === "saveDocument"),
    ).toMatchObject({
      slug: "study/document",
      title: "Edited title",
      tags: ["cms", "tested"],
      cover: { src: "/new-cover.png", alt: "new cover" },
      document: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "edited" }],
          },
        ],
      },
    });
    expect(await screen.findByText(/revision 저장 완료/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "비공개 → 공개" }));
    await waitFor(() =>
      expect(mutations.some(({ action }) => action === "publish")).toBe(true),
    );
    expect(await screen.findByText(/발행 완료/)).toBeVisible();

    const restoreButtons = screen.getAllByRole("button", {
      name: "수정본으로 복원",
    });
    fireEvent.click(restoreButtons[0]!);
    await waitFor(() =>
      expect(
        mutations.some(
          ({ action, revisionNumber }) =>
            action === "restoreRevision" && revisionNumber === 1,
        ),
      ).toBe(true),
    );
  });

  it("edits, reorders, and serializes a mixed structured block document", async () => {
    const article = {
      slug: "study/blocks",
      title: "Blocks",
      description: null,
      category: "Study",
      status: "DRAFT",
      sourceFormat: "BLOCKS",
      blocks: [
        { type: "PARAGRAPH", content: { text: "paragraph" } },
        { type: "HEADING", content: { level: 2, text: "heading" } },
        { type: "CODE", content: { language: "ts", code: "const x = 1" } },
        {
          type: "IMAGE",
          content: { url: "/image.png", alt: "image", caption: "caption" },
        },
        { type: "CALLOUT", content: { title: "note", text: "callout" } },
        {
          type: "QUIZ",
          content: { question: "question", choices: ["one", 2], answer: "one" },
        },
      ],
      preview: { title: "Blocks preview" },
      revisions: [],
    };
    const mutations: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        const action = requestAction(init);
        if (!action) return response({ ok: true, article });
        mutations.push(JSON.parse(String(init?.body)));
        if (action === "preview")
          return response({ ok: true, preview: { title: "Changed blocks" } });
        return response({ ok: true, article });
      }),
    );

    render(<OpsArticleEditor selectedSlug="study/blocks" />);
    expect(await screen.findByText("Blocks preview")).toBeVisible();
    expect(screen.getByDisplayValue("paragraph")).toBeVisible();
    expect(screen.getByDisplayValue("heading")).toBeVisible();
    expect(screen.getByDisplayValue("const x = 1")).toBeVisible();
    expect(screen.getByDisplayValue("/image.png")).toBeVisible();
    expect(screen.getByDisplayValue("callout")).toBeVisible();
    expect(screen.getByDisplayValue("question")).toBeVisible();
    expect(screen.getAllByDisplayValue("one")).toHaveLength(2);

    fireEvent.change(screen.getByDisplayValue("paragraph"), {
      target: { value: "updated paragraph" },
    });
    fireEvent.change(screen.getAllByDisplayValue("one")[0]!, {
      target: { value: "first\nsecond\n " },
    });
    fireEvent.click(screen.getByRole("button", { name: "+ 본문" }));
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects.at(-1)!, { target: { value: "HEADING" } });
    const moveDown = screen.getAllByRole("button", { name: "아래로" });
    fireEvent.click(moveDown[0]!);
    const moveUp = screen.getAllByRole("button", { name: "위로" });
    fireEvent.click(moveUp.at(-1)!);
    fireEvent.click(screen.getAllByRole("button", { name: "삭제" })[0]!);

    expect(await screen.findByText("Changed blocks")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(mutations.some(({ action }) => action === "saveBlocks")).toBe(
        true,
      ),
    );
    const savedBlocks = mutations.find(({ action }) => action === "saveBlocks")!
      .blocks as Array<{ type: string; content: Record<string, unknown> }>;
    expect(savedBlocks).toEqual([
      { type: "PARAGRAPH", content: { text: "updated paragraph" } },
      { type: "CODE", content: { language: "ts", code: "const x = 1" } },
      {
        type: "IMAGE",
        content: { url: "/image.png", alt: "image", caption: "caption" },
      },
      { type: "CALLOUT", content: { title: "note", text: "callout" } },
      { type: "HEADING", content: { level: 2, text: "" } },
      {
        type: "QUIZ",
        content: {
          question: "question",
          choices: ["first", "second"],
          answer: "one",
        },
      },
    ]);
  });

  it("shows load failures and renders legacy articles read-only", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ ok: false, error: "missing" }, false, 404),
      );
    vi.stubGlobal("fetch", fetchMock);
    const first = render(<OpsArticleEditor selectedSlug="missing/post" />);
    expect(await screen.findByText("불러오기 실패: missing")).toBeVisible();
    first.unmount();

    const legacy = {
      slug: "legacy/post",
      title: "Legacy",
      sourceFormat: "MDX",
      status: "PUBLISHED",
      sourceText: "# old source",
      hasUnpublishedChanges: false,
      revisions: [],
    };
    fetchMock.mockResolvedValueOnce(response({ ok: true, article: legacy }));
    render(<OpsArticleEditor selectedSlug="legacy/post" />);
    expect(await screen.findByText(/이 글은 이전 형식입니다/)).toBeVisible();
    expect(screen.getByDisplayValue("# old source")).toBeDisabled();
  });

  it("validates a new CMS draft and reports a creation failure", async () => {
    const requests: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        requests.push(JSON.parse(String(init?.body)));
        return response(
          { ok: false, error: "slug already exists" },
          false,
          409,
        );
      }),
    );
    render(<OpsArticleEditor selectedSlug="" />);

    const create = screen.getByRole("button", { name: "CMS 초안 만들기" });
    expect(create).toBeDisabled();
    fireEvent.change(
      screen.getByPlaceholderText("okayjing/cms-native-first-post"),
      {
        target: { value: "study/new-post" },
      },
    );
    fireEvent.change(screen.getByLabelText("title"), {
      target: { value: "New post" },
    });
    fireEvent.change(screen.getByLabelText("태그 (쉼표로 구분)"), {
      target: { value: "one, two, " },
    });
    fireEvent.change(screen.getByLabelText("대표 이미지 URL"), {
      target: { value: "/cover.png" },
    });
    fireEvent.change(screen.getByLabelText("요약 영상 URL"), {
      target: { value: "/summary.mp4" },
    });
    fireEvent.click(create);

    expect(
      await screen.findByText("CMS 초안 생성 실패: slug already exists"),
    ).toBeVisible();
    expect(requests).toContainEqual(
      expect.objectContaining({
        action: "createDocument",
        slug: "study/new-post",
        title: "New post",
        tags: ["one", "two"],
        cover: { src: "/cover.png", alt: "" },
        summaryVideo: { src: "/summary.mp4", title: "" },
      }),
    );
    expect(create).toBeEnabled();
  });
});
