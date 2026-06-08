import { describe, expect, it } from "vitest";
import {
  answerPostQuestion,
  handlePostQaRequest,
  questionLengthBucket,
  type MdxSearchChunk,
} from "./post-qa";

const chunks: MdxSearchChunk[] = [
  {
    id: "study/backend/day1#controller",
    slug: "study/backend/day1",
    href: "/blog/study/backend/day1",
    title: "백엔드 스터디 Day 1",
    description: "Controller와 Service 흐름",
    tags: ["backend"],
    heading: "Controller는 요청을 받는다",
    headingPath: ["Controller는 요청을 받는다"],
    level: 2,
    content:
      "Controller는 HTTP 요청 주소와 메서드를 받아서 요청 데이터를 DTO로 변환하고 Service에 처리를 넘긴다.",
    searchText:
      "백엔드 스터디 controller service http 요청 dto controller는 요청을 받는다 service에 처리를 넘긴다",
  },
  {
    id: "study/backend/day1#repository",
    slug: "study/backend/day1",
    href: "/blog/study/backend/day1",
    title: "백엔드 스터디 Day 1",
    description: "Repository와 DB 흐름",
    tags: ["backend"],
    heading: "Repository는 DB에 닿는다",
    headingPath: ["Repository는 DB에 닿는다"],
    level: 2,
    content:
      "Repository는 데이터베이스에 접근하는 경계다. Service가 비즈니스 규칙을 판단한 뒤 Repository를 호출한다.",
    searchText:
      "repository db 데이터베이스 service 비즈니스 규칙 repository는 db에 닿는다",
  },
  {
    id: "SEOJing/cloudflare-workers-fs-issue#fs",
    slug: "SEOJing/cloudflare-workers-fs-issue",
    href: "/blog/SEOJing/cloudflare-workers-fs-issue",
    title: "Cloudflare Workers에서 fs 모듈이 안 되는 이유",
    description: "Workers 런타임과 fs 문제",
    tags: ["Cloudflare Workers"],
    heading: "Cloudflare Workers에는 파일시스템이 없다",
    headingPath: ["Cloudflare Workers에는 파일시스템이 없다"],
    level: 2,
    content:
      "Cloudflare Workers는 V8 isolate 기반 런타임이라 Node.js fs 모듈을 사용할 수 없다.",
    searchText: "cloudflare workers fs node.js 파일시스템 v8 isolate 런타임",
  },
];

describe("post QA retrieval", () => {
  it("answers from current post sections first and attaches source excerpts", () => {
    const result = answerPostQuestion({
      question: "Controller는 요청을 받은 뒤 Service랑 어떻게 연결돼?",
      currentSlug: "study/backend/day1",
      chunks,
    });

    expect(result.status).toBe("answered");
    expect(result.sources[0]).toMatchObject({
      chunkId: "study/backend/day1#controller",
      slug: "study/backend/day1",
      heading: "Controller는 요청을 받는다",
    });
    expect(result.answer).toContain(
      "Controller는 HTTP 요청 주소와 메서드를 받아서",
    );
    expect(result.answer).toContain("출처 1");
    expect(result.relatedPosts).toEqual([]);
  });

  it("returns related posts when the best evidence is outside the current post", () => {
    const result = answerPostQuestion({
      question: "Cloudflare Workers에서 fs가 왜 안 돼?",
      currentSlug: "study/backend/day1",
      chunks,
    });

    expect(result.status).toBe("answered");
    expect(result.sources[0]?.slug).toBe("SEOJing/cloudflare-workers-fs-issue");
    expect(result.relatedPosts).toEqual([
      {
        slug: "SEOJing/cloudflare-workers-fs-issue",
        href: "/blog/SEOJing/cloudflare-workers-fs-issue",
        title: "Cloudflare Workers에서 fs 모듈이 안 되는 이유",
      },
    ]);
  });

  it("does not fabricate an answer when no indexed section matches", () => {
    const result = answerPostQuestion({
      question: "오늘 점심 메뉴는 뭐야?",
      currentSlug: "study/backend/day1",
      chunks,
    });

    expect(result.status).toBe("insufficient_context");
    expect(result.sources).toEqual([]);
    expect(result.answer).toContain(
      "현재 포스트 인덱스에서 충분한 근거를 찾지 못했어요",
    );
  });

  it("rejects punctuation-only and overlong questions before retrieval", () => {
    expect(
      answerPostQuestion({
        question: "!!!",
        currentSlug: "study/backend/day1",
        chunks,
      }).status,
    ).toBe("invalid_request");
    expect(
      answerPostQuestion({
        question: "가".repeat(501),
        currentSlug: "study/backend/day1",
        chunks,
      }).status,
    ).toBe("invalid_request");
  });

  it("clips long source excerpts around the first matched term", () => {
    const result = answerPostQuestion({
      question: "중앙키워드",
      currentSlug: "long/post",
      chunks: [
        {
          id: "long/post#section",
          slug: "long/post",
          href: "/blog/long/post",
          title: "긴 글",
          description: "긴 글 설명",
          tags: [],
          heading: "긴 섹션",
          headingPath: ["긴 섹션"],
          level: 2,
          content: `${"앞문장 ".repeat(40)}중앙키워드 ${"뒷문장 ".repeat(40)}`,
          searchText: "중앙키워드 긴 글",
        },
      ],
    });

    expect(result.status).toBe("answered");
    expect(result.sources[0]?.excerpt).toContain("중앙키워드");
    expect(result.sources[0]?.excerpt.startsWith("…")).toBe(true);
    expect(result.sources[0]?.excerpt.endsWith("…")).toBe(true);
  });

  it("buckets question length without exposing raw question in analytics metadata", () => {
    expect(questionLengthBucket("짧은 질문")).toBe("1-40");
    expect(questionLengthBucket("가".repeat(80))).toBe("41-120");
    expect(questionLengthBucket("가".repeat(160))).toBe("121+");
  });
});

describe("post QA API handler", () => {
  it("accepts a valid question and returns answer plus privacy-safe analytics metadata", async () => {
    const response = await handlePostQaRequest(
      new Request("https://seojing.com/api/rag/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "study/backend/day1",
          question: "Repository는 DB랑 어떻게 연결돼?",
        }),
      }),
      { chunks, now: () => "2026-06-08T01:00:00.000Z" },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("answered");
    expect(body.analytics).toEqual({
      event_type: "qa_interaction",
      event: {
        action: "answer_shown",
        question_length_bucket: "1-40",
      },
    });
    expect(JSON.stringify(body.analytics)).not.toContain("Repository는");
  });

  it("rejects oversized or malformed questions", async () => {
    const response = await handlePostQaRequest(
      new Request("https://seojing.com/api/rag/query", {
        method: "POST",
        body: JSON.stringify({
          slug: "study/backend/day1",
          question: " ".repeat(3),
        }),
      }),
      { chunks },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "invalid_request",
    });
  });

  it("rejects non-post methods and invalid JSON", async () => {
    const getResponse = await handlePostQaRequest(
      new Request("https://seojing.com/api/rag/query", { method: "GET" }),
      { chunks },
    );
    expect(getResponse.status).toBe(404);

    const invalidJsonResponse = await handlePostQaRequest(
      new Request("https://seojing.com/api/rag/query", {
        method: "POST",
        body: "{not json",
      }),
      { chunks },
    );
    expect(invalidJsonResponse.status).toBe(400);
    await expect(invalidJsonResponse.json()).resolves.toMatchObject({
      status: "invalid_json",
    });
  });

  it("rejects payloads that exceed the configured byte limit", async () => {
    const headerTooLarge = await handlePostQaRequest(
      new Request("https://seojing.com/api/rag/query", {
        method: "POST",
        headers: { "content-length": "100" },
        body: JSON.stringify({ slug: "study/backend/day1", question: "왜?" }),
      }),
      { chunks, maxBodyBytes: 10 },
    );
    expect(headerTooLarge.status).toBe(413);

    const bodyTooLarge = await handlePostQaRequest(
      new Request("https://seojing.com/api/rag/query", {
        method: "POST",
        body: JSON.stringify({
          slug: "study/backend/day1",
          question: "가".repeat(30),
        }),
      }),
      { chunks, maxBodyBytes: 20 },
    );
    expect(bodyTooLarge.status).toBe(413);
    await expect(bodyTooLarge.json()).resolves.toMatchObject({
      status: "payload_too_large",
    });
  });

  it("rejects non-object request bodies and missing slugs", async () => {
    const arrayBody = await handlePostQaRequest(
      new Request("https://seojing.com/api/rag/query", {
        method: "POST",
        body: JSON.stringify([]),
      }),
      { chunks },
    );
    expect(arrayBody.status).toBe(400);

    const missingSlug = await handlePostQaRequest(
      new Request("https://seojing.com/api/rag/query", {
        method: "POST",
        body: JSON.stringify({ question: "Controller는 뭐야?" }),
      }),
      { chunks },
    );
    expect(missingSlug.status).toBe(400);
  });
});
