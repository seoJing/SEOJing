import { renderToStaticMarkup } from "react-dom/server";
import { env as cloudflareEnv } from "cloudflare:workers";
import { describe, expect, it, vi } from "vitest";

import {
  fetchBackendArticle,
  loadBackendArticleContent,
  toBackendArticleContentData,
  type BackendArticleApiResponse,
} from "./backend-article";

const article: BackendArticleApiResponse = {
  slug: "study/backend/day1",
  title: "백엔드 스터디 Day 1",
  description: "API에서 온 설명",
  publishedAt: "2026-06-28T00:00:00.000Z",
  updatedAt: "2026-06-28T01:00:00.000Z",
  body: {
    html: '<h2 id="intro">도입</h2><p>API 본문입니다.</p>',
    blocks: [
      {
        id: "intro",
        type: "HEADING",
        sortOrder: 0,
        content: { level: 2, text: "도입" },
        plainText: "도입",
      },
    ],
  },
};

describe("backend article content adapter", () => {
  it("maps public article API payload to SEOJing content data", () => {
    const content = toBackendArticleContentData(article);
    const Component = content.compiled.default;

    expect(content.frontmatter).toMatchObject({
      title: "백엔드 스터디 Day 1",
      description: "API에서 온 설명",
      date: "2026-06-28T00:00:00.000Z",
      tags: [],
    });
    expect(content.source).toContain("API 본문입니다.");
    expect(renderToStaticMarkup(<Component />)).toContain(
      "data-backend-article-html",
    );
    expect(renderToStaticMarkup(<Component />)).toContain("API 본문입니다.");
  });

  it("encodes slash-containing slugs for the backend article endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(article, {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchBackendArticle(
      "http://127.0.0.1:4000",
      "study/backend/day1",
    );

    expect(result?.slug).toBe("study/backend/day1");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:4000/articles/study%2Fbackend%2Fday1"),
      expect.objectContaining({
        headers: { Accept: "application/json" },
        cache: "force-cache",
      }),
    );

    vi.unstubAllGlobals();
  });

  it("falls back to updatedAt, block text, and decoded html when metadata is sparse", () => {
    const content = toBackendArticleContentData({
      ...article,
      description: null,
      publishedAt: null,
      body: {
        html: "<style>.x{}</style><script>bad()</script><p>A&amp;B &lt; C &quot;D&quot; &#39;E&#39;&nbsp;</p>",
        blocks: [
          {
            id: "blank",
            type: "PARAGRAPH",
            sortOrder: 0,
            content: {},
            plainText: "   ",
          },
          {
            id: "summary",
            type: "PARAGRAPH",
            sortOrder: 1,
            content: {},
            plainText: "블록 설명",
          },
        ],
      },
    });

    expect(content.frontmatter.date).toBe("2026-06-28T01:00:00.000Z");
    expect(content.frontmatter.description).toBe("블록 설명");
    expect(content.source).toBe("A&B < C \"D\" 'E'");
  });

  it("uses the title when html and block text are empty", () => {
    const content = toBackendArticleContentData({
      ...article,
      description: null,
      body: { html: "", blocks: [] },
    });

    expect(content.frontmatter.description).toBe("백엔드 스터디 Day 1");
    expect(content.source).toBe("백엔드 스터디 Day 1");
  });

  it("returns null for missing API origin, 404, and failed backend fetches", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.stubEnv("SEOJING_BACKEND_ARTICLE_API_ORIGIN", "");
    vi.stubEnv("SEOJING_BACKEND_API_ORIGIN", "");

    await expect(loadBackendArticleContent("study/backend/day1")).resolves.toBe(
      null,
    );

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchBackendArticle("http://127.0.0.1:4000/", "missing"),
    ).resolves.toBe(null);
    await expect(
      fetchBackendArticle("http://127.0.0.1:4000", "broken"),
    ).resolves.toBe(null);
    await expect(
      fetchBackendArticle("http://127.0.0.1:4000", "network"),
    ).resolves.toBe(null);
    expect(consoleError).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    consoleError.mockRestore();
  });

  it("loads and adapts backend article content when origin env is configured", async () => {
    vi.stubEnv("SEOJING_BACKEND_ARTICLE_API_ORIGIN", "http://127.0.0.1:4000");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(article)),
    );

    const content = await loadBackendArticleContent("study/backend/day1");

    expect(content?.frontmatter.title).toBe("백엔드 스터디 Day 1");

    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses the Cloudflare Worker env binding when process env is absent", async () => {
    const runtimeEnv = cloudflareEnv as Record<string, string | undefined>;
    runtimeEnv.SEOJING_BACKEND_ARTICLE_API_ORIGIN = "http://127.0.0.1:4000";
    const fetchMock = vi.fn(async () => Response.json(article));
    vi.stubGlobal("fetch", fetchMock);

    const content = await loadBackendArticleContent("study/backend/day1");

    expect(content?.frontmatter.title).toBe("백엔드 스터디 Day 1");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:4000/articles/study%2Fbackend%2Fday1"),
      expect.objectContaining({
        headers: { Accept: "application/json" },
      }),
    );

    delete runtimeEnv.SEOJING_BACKEND_ARTICLE_API_ORIGIN;
    vi.unstubAllGlobals();
  });
});
