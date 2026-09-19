import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MDXComponents } from "mdx/types";
import { mdxComponents } from "@/widgets/mdx-renderer/MdxRenderer";
import { notFound } from "next/navigation";
import { loadContent } from "@/generated/content-loader";
import BlogPostPage, { generateMetadata } from "@/app/blog/[...slug]/page";

// Keep the real loader, article components, MDX, metadata and route. Omit only
// surrounding client widgets, which need browser providers unrelated to loading.
vi.mock("@/widgets/new-posts-carousel/NewPostsCarousel", () => ({
  NewPostsCarousel: () => null,
}));
vi.mock("@/widgets/recently-read/RecentlyRead", () => ({
  RecentlyRead: () => null,
}));
vi.mock("@/widgets/post-explorer/PostExplorer", () => ({
  PostExplorer: () => null,
}));
vi.mock("@/widgets/post-grid", () => ({ PostGrid: () => null }));
vi.mock("@/widgets/article-toolbar/ArticleToolbar", () => ({
  ArticleToolbar: () => null,
}));
vi.mock("@/widgets/article-analytics", () => ({
  ArticleAnalytics: () => null,
}));
vi.mock("@/widgets/post-qa", () => ({
  PostQaPanel: () => null,
  SectionQaPrompts: () => null,
}));
vi.mock("@/widgets/summary-video", () => ({ SummaryVideo: () => null }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  notFound: vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));

const slug = "study/effective-typescript/day5";
const title =
  "이펙티브 타입스크립트 2판 Day 5: 좁혀진 타입은 언제 다시 넓어지는가";
const props = { params: Promise.resolve({ slug: slug.split("/") }) };
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("SEOJING_BACKEND_ARTICLE_API_ORIGIN", "http://127.0.0.1:4000");
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

async function expectBundledRoute() {
  const content = await loadContent(slug.split("/"));
  expect(content?.frontmatter.title).toBe(title);
  expect(content?.source).toContain("## 먼저 보는 코드");
  const MDXContent = content!.compiled.default;
  expect(
    renderToStaticMarkup(
      <MDXContent components={mdxComponents as MDXComponents} />,
    ),
  ).toContain("먼저 보는 코드");
  const metadata = await generateMetadata(props);
  expect(metadata.title).toBe(title);
  expect(metadata.description).toContain("Item 22–27");
  expect(metadata.alternates?.canonical).toBe(
    `https://seojing.com/blog/${slug}`,
  );
  expect(metadata.robots).toBeUndefined();
  const html = renderToStaticMarkup(await BlogPostPage(props));
  expect(html).toContain(title);
  expect(html).toContain("data-article-content");
  expect(html).toContain("data-code-block");
  expect(html).toContain("data-article-quiz");
  expect(html).toContain("inference-api-design.svg");
  expect(html).toContain("먼저 보는 코드");
  expect(html).not.toContain("data-backend-article-");
  expect(notFound).not.toHaveBeenCalled();
}

describe("generated Day 5 backend-first loader with bundled fallback", () => {
  it("renders the bundled article and canonical metadata on network failure", async () => {
    fetchMock.mockRejectedValue(
      new TypeError("fetch failed: connection refused"),
    );
    await expectBundledRoute();
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(
        "http://127.0.0.1:4000/articles/study%2Feffective-typescript%2Fday5",
      ),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it.each([500, 503, 530])(
    "renders the bundled article and metadata on HTTP %s",
    async (status) => {
      fetchMock.mockImplementation(
        async () =>
          new Response("<html>Error 1033: Cloudflare Tunnel error</html>", {
            status,
          }),
      );
      await expectBundledRoute();
    },
  );

  it.each([404, 401, 403, 429])(
    "preserves not-found behavior for Day 5 on backend HTTP %s",
    async (status) => {
      fetchMock.mockImplementation(async () => new Response(null, { status }));
      expect(await loadContent(slug.split("/"))).toBeNull();
      expect((await generateMetadata(props)).robots).toEqual({
        index: false,
        follow: false,
      });
      await expect(BlogPostPage(props)).rejects.toThrow(
        "NEXT_HTTP_ERROR_FALLBACK;404",
      );
      expect(notFound).toHaveBeenCalledOnce();
    },
  );

  it("falls back when a successful HTTP response contains invalid JSON", async () => {
    fetchMock.mockImplementation(async () => new Response("not JSON"));
    await expectBundledRoute();
  });

  it("renders from the bundle without an API origin", async () => {
    vi.stubEnv("SEOJING_BACKEND_ARTICLE_API_ORIGIN", "");
    await expectBundledRoute();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds an unresponsive backend read before returning bundled content", async () => {
    const controller = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(options.signal?.reason),
            { once: true },
          );
        }),
    );
    const pending = loadContent(slug.split("/"));
    expect(timeout).toHaveBeenCalledWith(3000);
    controller.abort(new DOMException("API timed out", "TimeoutError"));
    expect((await pending)?.frontmatter.title).toBe(title);
  });

  it("resumes backend rendering and metadata after an outage", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect((await loadContent(slug.split("/")))?.frontmatter.title).toBe(title);
    fetchMock.mockImplementation(async () =>
      Response.json({
        slug,
        title: "Updated backend Day 5",
        description: "Backend description",
        publishedAt: "2026-06-27T00:00:00.000Z",
        updatedAt: "2026-09-15T00:00:00.000Z",
        body: { html: "<p>Current published backend body</p>" },
      }),
    );
    const metadata = await generateMetadata(props);
    expect(metadata.title).toBe("Updated backend Day 5");
    const html = renderToStaticMarkup(await BlogPostPage(props));
    expect(html).toContain("data-backend-article-html");
    expect(html).toContain("Current published backend body");
    expect(html).not.toContain("먼저 보는 코드");
  });

  it.each([404, 530, "network"] as const)(
    "keeps genuinely absent slugs not-found during %s",
    async (failure) => {
      fetchMock.mockImplementation(async () => {
        if (failure === "network") throw new TypeError("fetch failed");
        return new Response(null, { status: failure });
      });
      const missing = ["study", "effective-typescript", "ticket-249-missing"];
      const missingProps = { params: Promise.resolve({ slug: missing }) };
      expect(await loadContent(missing)).toBeNull();
      expect((await generateMetadata(missingProps)).robots).toEqual({
        index: false,
        follow: false,
      });
      await expect(BlogPostPage(missingProps)).rejects.toThrow(
        "NEXT_HTTP_ERROR_FALLBACK;404",
      );
      expect(notFound).toHaveBeenCalledOnce();
    },
  );
});
