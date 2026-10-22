import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import BlogPostPage from "@/app/blog/[...slug]/page";
import { OpsArticleEditor } from "@/widgets/ops-articles/OpsArticleEditor";
import { loadContent } from "@/shared/config";

vi.mock("@/shared/config", () => ({
  getContentTree: async () => [],
  isSlugFolder: () => false,
  loadContent: vi.fn(),
}));
vi.mock("@/widgets/article-analytics", () => ({
  ArticleAnalytics: () => null,
}));
vi.mock("@/widgets/article-toolbar/ArticleToolbar", () => ({
  ArticleToolbar: () => null,
}));
vi.mock("@/widgets/post-explorer/PostExplorer", () => ({
  PostExplorer: () => null,
}));
vi.mock("@/widgets/post-grid", () => ({ PostGrid: () => null }));
vi.mock("@/widgets/ops-articles/NativeDocumentEditor", () => ({
  NativeDocumentEditor: () => null,
  emptyArticleDocument: { type: "doc", content: [] },
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
import {
  toBackendArticleContentData,
  type BackendArticleApiResponse,
} from "./backend-article";
const article: BackendArticleApiResponse = {
  slug: "study/preview",
  title: "Preview",
  description: null,
  updatedAt: "2026-10-22",
  publishedAt: "2026-10-22",
  body: {
    html: `<p>${"읽기".repeat(700)}</p>`,
    document: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Heading" }],
        },
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [
            { type: "text", text: "const answer = 42;\nconsole.log(answer);" },
          ],
        },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Column" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "quiz",
          attrs: {
            items: [
              { mode: "description", question: "Question?", answer: "42" },
            ],
          },
        },
      ],
    },
  },
};
function editorFetch(
  preview: BackendArticleApiResponse | undefined,
  rawBlocks: unknown[] = [],
) {
  return vi.fn(async (_url?: string, _options?: RequestInit) =>
    Response.json({
      ok: true,
      article: {
        ...article,
        sourceFormat: rawBlocks.length ? "BLOCKS" : "DOCUMENT",
        document: article.body.document,
        blocks: rawBlocks,
        preview,
      },
    }),
  );
}

it("renders actual public and editor adapter inputs with identical metadata, reading time, code, table, headings and quiz", async () => {
  vi.mocked(loadContent).mockResolvedValue(
    toBackendArticleContentData(article),
  );
  const view = render(
    await BlogPostPage({
      params: Promise.resolve({ slug: article.slug.split("/") }),
    }),
  );
  const publicMarkup = view.container.querySelector(
    "[data-article-surface]",
  )!.outerHTML;
  expect(screen.getByText("3분 읽기")).toBeVisible();
  view.unmount();
  vi.stubGlobal("fetch", editorFetch(article));
  const preview = render(<OpsArticleEditor selectedSlug={article.slug} />);
  const region = await screen.findByRole("region", {
    name: "공개 화면 미리보기",
  });
  expect(region.querySelector("[data-article-surface]")!.outerHTML).toBe(
    publicMarkup,
  );
  expect(within(region).getByText("3분 읽기")).toBeVisible();
  expect(within(region).getByRole("table")).toBeVisible();
  expect(region.querySelector("pre")).toHaveTextContent("const answer = 42;");
  expect(
    within(region).getByRole("heading", { name: "Heading" }),
  ).toHaveAttribute("id", "heading-0");
  preview.unmount();
});

const hostileBlocks = [
  {
    id: "raw",
    type: "PARAGRAPH",
    content: {
      text: "Safe text",
      html: '<img src=x onerror="alert(1)"><script>alert(2)</script><strong onclick="alert(3)">Safe text</strong>',
    },
  },
];
const sanitized: BackendArticleApiResponse = {
  ...article,
  body: {
    html: "<p>Safe text</p>",
    blocks: [
      {
        ...hostileBlocks[0]!,
        sortOrder: 0,
        plainText: "Safe text",
        content: { html: "<strong>Safe text</strong>" },
      },
    ],
  },
};

it("uses only the explicit sanitized projection and never the raw saved or locally edited block HTML", async () => {
  const fetchMock = editorFetch(sanitized, hostileBlocks);
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<OpsArticleEditor selectedSlug={article.slug} />);
  const region = await screen.findByRole("region", {
    name: "공개 화면 미리보기",
  });
  expect(region.querySelector("strong")).toHaveTextContent("Safe text");
  expect(
    view.container.querySelector("script, [onerror], [onclick]"),
  ).toBeNull();

  let resolvePreview!: (value: Response) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
  );
  fireEvent.change(screen.getByLabelText("title"), {
    target: { value: "Changed title" },
  });
  expect(region.querySelector("[data-article-surface]")).toBeNull();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const request = JSON.parse(
    (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1]
      .body as string,
  );
  expect(request).toMatchObject({
    action: "preview",
    title: "Changed title",
    slug: article.slug,
  });
  resolvePreview(
    Response.json({
      ok: true,
      preview: { ...sanitized, title: "Changed title" },
    }),
  );
  await within(region).findByRole("heading", { name: "Changed title" });
  expect(
    view.container.querySelector("script, [onerror], [onclick]"),
  ).toBeNull();
  view.unmount();
});

it("fails closed when no sanitized preview is available or projection fails", async () => {
  const fetchMock = editorFetch(undefined, hostileBlocks);
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<OpsArticleEditor selectedSlug={article.slug} />);
  const region = await screen.findByRole("region", {
    name: "공개 화면 미리보기",
  });
  expect(region.querySelector("[data-article-surface]")).toBeNull();
  fetchMock.mockResolvedValueOnce(
    Response.json(
      { ok: false, error: "backend_preview_failed" },
      { status: 400 },
    ),
  );
  fireEvent.change(screen.getByLabelText("title"), {
    target: { value: "Changed title" },
  });
  expect(await within(region).findByRole("alert")).toHaveTextContent(
    "backend_preview_failed",
  );
  expect(
    view.container.querySelector("script, [onerror], [onclick]"),
  ).toBeNull();
  expect(region.querySelector("[data-article-surface]")).toBeNull();
});

it("discards a stale response when the author edits again while projection is pending", async () => {
  const fetchMock = editorFetch(sanitized, hostileBlocks);
  vi.stubGlobal("fetch", fetchMock);
  render(<OpsArticleEditor selectedSlug={article.slug} />);
  const region = await screen.findByRole("region", {
    name: "공개 화면 미리보기",
  });
  let resolveOld!: (value: Response) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  fireEvent.change(screen.getByLabelText("title"), {
    target: { value: "Old pending" },
  });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  let resolveNew!: (value: Response) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveNew = resolve;
      }),
  );
  fireEvent.change(screen.getByLabelText("title"), {
    target: { value: "Current pending" },
  });
  await act(async () =>
    resolveOld(
      Response.json({
        ok: true,
        preview: { ...sanitized, title: "Old pending" },
      }),
    ),
  );
  expect(region.querySelector("[data-article-surface]")).toBeNull();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  await act(async () =>
    resolveNew(
      Response.json({
        ok: true,
        preview: { ...sanitized, title: "Current pending" },
      }),
    ),
  );
  expect(
    within(region).getByRole("heading", { name: "Current pending" }),
  ).toBeVisible();
  expect(
    within(region).queryByRole("heading", { name: "Old pending" }),
  ).toBeNull();
});
