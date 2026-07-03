import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

describe("/api/rag/query", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("proxies article QA requests to the SEOJing backend and maps the public response", async () => {
    vi.stubEnv("SEOJING_BACKEND_ARTICLE_API_ORIGIN", "http://127.0.0.1:4000/");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              ok: true,
              slug: "study/backend/day1",
              status: "answered",
              answer: "Controller는 요청을 Service에 전달해요.",
              sources: [
                {
                  articleSlug: "study/backend/day1",
                  blockId: "p-controller",
                  sectionId: "controller",
                  heading: "Controller",
                  excerpt: "Controller는 HTTP 요청을 Service에 넘긴다.",
                  score: 3,
                },
              ],
              related: [
                { slug: "study/backend/day2", title: "백엔드 스터디 Day 2" },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    const response = await POST(
      new Request("https://seojing.com/api/rag/query", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "browser-readback",
        },
        body: JSON.stringify({
          slug: "study/backend/day1",
          question: "Controller는 Service랑 어떻게 연결돼?",
          section_id: "controller",
          session_id: "reader-session",
        }),
      }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:4000/articles/study%2Fbackend%2Fday1/qa",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "browser-readback",
        },
        body: JSON.stringify({
          question: "Controller는 Service랑 어떻게 연결돼?",
          section_id: "controller",
          session_id: "reader-session",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "answered",
      answer: "Controller는 요청을 Service에 전달해요.",
      sources: [
        {
          chunkId: "p-controller",
          slug: "study/backend/day1",
          href: "/blog/study/backend/day1",
          heading: "Controller",
          excerpt: "Controller는 HTTP 요청을 Service에 넘긴다.",
        },
      ],
      relatedPosts: [
        {
          slug: "study/backend/day2",
          href: "/blog/study/backend/day2",
          title: "백엔드 스터디 Day 2",
        },
      ],
      analytics: {
        event_type: "qa_interaction",
        event: { action: "answer_shown", question_length_bucket: "1-40" },
      },
    });
  });

  it("fails closed instead of using the legacy local RAG index when no backend origin is configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(
      new Request("https://seojing.com/api/rag/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "study/backend/day1",
          question: "백엔드 QA가 연결됐나요?",
        }),
      }),
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      status: "insufficient_context",
      sources: [],
      relatedPosts: [],
    });
  });

  it("keeps the public route POST-only", async () => {
    const response = GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
