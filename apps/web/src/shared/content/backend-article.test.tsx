import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  fetchBackendArticle,
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
});
