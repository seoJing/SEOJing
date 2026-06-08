import { describe, expect, it } from "vitest";
import {
  buildQaLogInsights,
  renderQaLogInsightsMarkdown,
  type QaLogEntry,
} from "./qa-log-insights";

const logs: QaLogEntry[] = [
  {
    slug: "study/backend/day1",
    question: "Controller와 Service 책임 차이가 뭐야?",
    status: "answered",
    createdAt: "2026-06-08T01:00:00.000Z",
  },
  {
    slug: "study/backend/day1",
    question: "Controller Service 흐름을 예시로 설명해줘",
    status: "answered",
    createdAt: "2026-06-08T01:01:00.000Z",
  },
  {
    slug: "study/backend/day1",
    question: "Repository DB 연결은 어디서 다뤄?",
    status: "insufficient_context",
    createdAt: "2026-06-08T01:02:00.000Z",
  },
  {
    slug: "study/frontend/day2",
    question: "useEffect cleanup 예제 다시 설명해줘",
    status: "answered",
    createdAt: "2026-06-08T01:03:00.000Z",
  },
];

describe("qa-log-insights", () => {
  it("groups local question logs into FAQ candidates and content actions", () => {
    const insights = buildQaLogInsights(logs, {
      minQuestionsForFaq: 2,
      now: "2026-06-08T01:10:00.000Z",
    });

    expect(insights.totalQuestions).toBe(4);
    expect(insights.bySlug).toEqual([
      expect.objectContaining({
        slug: "study/backend/day1",
        questionCount: 3,
        insufficientContextCount: 1,
      }),
      expect.objectContaining({
        slug: "study/frontend/day2",
        questionCount: 1,
        insufficientContextCount: 0,
      }),
    ]);
    expect(insights.faqCandidates[0]).toEqual(
      expect.objectContaining({
        slug: "study/backend/day1",
        representativeQuestion: "Controller와 Service 책임 차이가 뭐야?",
        questionCount: 3,
      }),
    );
    expect(insights.contentActions).toContainEqual(
      expect.objectContaining({
        slug: "study/backend/day1",
        action: "revise_existing_post",
        reason: "insufficient_context 질문 1개",
      }),
    );
  });

  it("filters invalid and empty records before scoring", () => {
    const insights = buildQaLogInsights([
      ...logs,
      { slug: "", question: "무시", status: "answered", createdAt: "bad" },
      {
        slug: "study/backend/day1",
        question: "   ",
        status: "answered",
        createdAt: "bad",
      },
    ]);

    expect(insights.totalQuestions).toBe(4);
  });

  it("renders an operator-friendly Markdown report", () => {
    const markdown = renderQaLogInsightsMarkdown(
      buildQaLogInsights(logs, {
        minQuestionsForFaq: 2,
        now: "2026-06-08T01:10:00.000Z",
      }),
    );

    expect(markdown).toContain("# SEOJing Q&A 운영 루프");
    expect(markdown).toContain("## FAQ 후보");
    expect(markdown).toContain("Controller와 Service 책임 차이가 뭐야?");
    expect(markdown).toContain("## 콘텐츠 개선 액션");
    expect(markdown).toContain("revise_existing_post");
  });

  it("escapes user-controlled Markdown fields in the operator report", () => {
    const markdown = renderQaLogInsightsMarkdown(
      buildQaLogInsights(
        [
          {
            slug: "study/<img src=x>",
            question:
              "[click](javascript:alert(1))\n- injected contact me@example.com token ghp_abcdefgh12345678",
            status: "answered",
            createdAt: "2026-06-08T01:00:00.000Z",
          },
          {
            slug: "study/<img src=x>",
            question: "[click](javascript:alert(1)) 두 번째",
            status: "answered",
            createdAt: "2026-06-08T01:01:00.000Z",
          },
        ],
        { minQuestionsForFaq: 2 },
      ),
    );

    expect(markdown).not.toContain("<img");
    expect(markdown).not.toContain("\n- injected");
    expect(markdown).not.toContain("me@example.com");
    expect(markdown).not.toContain("ghp_ab");
    expect(markdown).toContain("\\[email\\]");
    expect(markdown).toContain("\\[click\\]\\(javascript:alert\\(1\\)\\)");
  });
});
