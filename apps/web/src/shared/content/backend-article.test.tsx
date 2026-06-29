import { renderToStaticMarkup } from "react-dom/server";
import { env as cloudflareEnv } from "cloudflare:workers";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

type MockArticleImageProps = { src: string; alt: string; caption?: string };
type MockChildrenProps = { children: ReactNode };
type MockArticleQuizItemProps = {
  question: ReactNode;
  choices?: string[];
  answer: string | number;
  explanation?: ReactNode;
};
type MockCodeBlockProps = { language?: string; children: ReactNode };

vi.mock("@app/ui", async () => {
  const React = await import("react");
  return {
    ArticleImage: ({ src, alt, caption }: MockArticleImageProps) =>
      React.createElement(
        "figure",
        { "data-article-image": true },
        React.createElement("img", { src, alt }),
        caption ? React.createElement("figcaption", null, caption) : null,
      ),
    ArticleQuiz: ({ children }: MockChildrenProps) =>
      React.createElement("section", { "data-article-quiz": true }, children),
    ArticleQuizItem: ({
      question,
      choices,
      answer,
      explanation,
    }: MockArticleQuizItemProps) =>
      React.createElement(
        "div",
        { "data-article-quiz-item": true, "data-answer": answer },
        question,
        choices?.map((choice: string) =>
          React.createElement("span", { key: choice }, choice),
        ),
        explanation,
      ),
    CodeBlock: ({ language, children }: MockCodeBlockProps) =>
      React.createElement(
        "pre",
        { "data-code-block": true, "data-language": language },
        React.createElement("code", null, children),
      ),
  };
});

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
      {
        id: "intro-body",
        type: "PARAGRAPH",
        sortOrder: 1,
        content: { text: "API 본문입니다." },
        plainText: "API 본문입니다.",
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
    const markup = renderToStaticMarkup(<Component />);
    expect(markup).toContain("data-backend-article-blocks");
    expect(markup).toContain("API 본문입니다.");
    expect(markup).toContain("article-prose");
    expect(markup).not.toContain("data-backend-article-html");
  });

  it("reuses existing CodeBlock, ArticleQuiz, and ArticleImage renderers for structured blocks", () => {
    const content = toBackendArticleContentData({
      ...article,
      body: {
        html: "<p>fallback should not duplicate structured blocks</p>",
        blocks: [
          {
            id: "code",
            type: "CODE",
            sortOrder: 0,
            content: { language: "ts", code: "const answer: number = 42;" },
            plainText: "const answer: number = 42;",
          },
          {
            id: "quiz",
            type: "QUIZ",
            sortOrder: 1,
            content: {
              renderHint: "ArticleQuiz",
              items: [
                {
                  props: {
                    mode: "multiple",
                    question: "정답은?",
                    choices: '["41", "42"]',
                    answer: "1",
                    explanation: "42입니다.",
                  },
                  rawMdx: "<ArticleQuizItem />",
                },
              ],
            },
            plainText: null,
          },
          {
            id: "image",
            type: "IMAGE",
            sortOrder: 2,
            content: {
              url: "/images/example.png",
              alt: "예시 이미지",
              caption: "예시 캡션",
            },
            plainText: "예시 이미지",
          },
        ],
      },
    });
    const Component = content.compiled.default;
    const markup = renderToStaticMarkup(<Component />);

    expect(markup).toContain("data-code-block");
    expect(markup).toContain('data-language="ts"');
    expect(markup).toContain("const answer: number = 42;");
    expect(markup).toContain("data-article-quiz");
    expect(markup).toContain("정답은?");
    expect(markup).toContain("/images/example.png");
    expect(markup).toContain("예시 캡션");
    expect(markup).not.toContain("fallback should not duplicate");
  });

  it("keeps sanitized HTML fallback when no structured blocks are provided", () => {
    const content = toBackendArticleContentData({
      ...article,
      body: {
        html: '<h2 id="legacy">Legacy</h2><pre><code>legacy()</code></pre>',
        blocks: [],
      },
    });
    const Component = content.compiled.default;
    const markup = renderToStaticMarkup(<Component />);

    expect(markup).toContain("data-backend-article-html");
    expect(markup).toContain("backend-article-html");
    expect(markup).toContain("legacy()");
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
