import { describe, expect, it } from "vitest";

import type { CareerOpportunity } from "./types";
import {
  buildBlogEvidenceChecklist,
  extractPreparationTopics,
  rankBlogEvidence,
  type BlogSearchChunk,
} from "./blog-evidence";

function opportunityWith(
  eligibility: string[],
  preparationNotes: string[] = [],
): Pick<CareerOpportunity, "recruitments" | "preparationNotes"> {
  return {
    recruitments: [
      {
        id: "9cc765a8-6de3-4059-b7df-d2a5886c9a49",
        year: 2026,
        title: "Frontend Internship",
        eligibility,
        process: [],
        sources: [],
      },
    ],
    preparationNotes,
  };
}

function chunk(
  overrides: Partial<BlogSearchChunk> & Pick<BlogSearchChunk, "slug" | "title">,
): BlogSearchChunk {
  return {
    id: `${overrides.slug}#section`,
    href: `/blog/${overrides.slug}`,
    heading: "Section",
    searchText: "",
    ...overrides,
  };
}

describe("extractPreparationTopics", () => {
  it("deterministically maps verified eligibility and preparation notes through explicit profiles", () => {
    const opportunity = opportunityWith(
      [
        "React와 TypeScript로 만든 제품을 실제 사용자에게 배포하고 운영한 경험",
        "화면·네트워크·서버 중 문제 원인을 끝까지 구분해 해결한 경험",
        "변경되는 요구사항에서 우선순위를 직접 판단한 경험",
        "다른 직군과 요구사항이나 인터페이스를 조율한 경험",
        "코딩 에이전트 결과를 직접 검증하고 위임 범위를 판단하는 역량",
      ],
      ["React와 TypeScript 프로젝트의 배포 뒤 운영 개선 근거를 정리합니다."],
    );

    const topics = extractPreparationTopics(opportunity);

    expect(topics.map((topic) => topic.id)).toEqual([
      "react-typescript-operations",
      "cross-layer-debugging",
      "requirement-prioritization",
      "cross-functional-collaboration",
      "ai-assisted-verification",
    ]);
    expect(topics[0]?.keywords).toEqual([
      "React",
      "TypeScript",
      "배포",
      "운영 개선",
    ]);
  });

  it("does not infer a topic from unrelated notes", () => {
    expect(
      extractPreparationTopics(
        opportunityWith(["성실하고 적극적으로 업무에 참여한 경험"]),
      ),
    ).toEqual([]);
  });
});

describe("rankBlogEvidence", () => {
  it("weights explicit fields, deduplicates heading chunks by slug, and caps links at three", () => {
    const [topic] = extractPreparationTopics(
      opportunityWith([
        "React와 TypeScript로 만든 제품을 실제 사용자에게 배포하고 운영한 경험",
      ]),
    );
    expect(topic).toBeDefined();

    const results = rankBlogEvidence(topic!, [
      chunk({
        slug: "react-operations",
        title: "React TypeScript 운영과 배포",
        description: "실제 사용자 개선",
        tags: ["React", "TypeScript"],
        heading: "첫 번째 섹션",
        searchText: "react typescript 운영 배포 사용자",
      }),
      chunk({
        slug: "react-operations",
        title: "React TypeScript 운영과 배포",
        heading: "더 약한 중복 섹션",
        searchText: "react",
      }),
      chunk({
        slug: "body-only",
        title: "개발 기록",
        searchText: "react typescript 프론트엔드 사용자 배포 운영",
      }),
      chunk({ slug: "third", title: "React 배포 회고" }),
      chunk({ slug: "fourth", title: "TypeScript 운영 기록" }),
      chunk({
        slug: "unrelated-operations",
        title: "사용자 운영 개선과 배포 기록",
        description: "운영과 배포를 반복한 이야기",
        tags: ["운영", "배포"],
        searchText: "사용자 운영 개선 배포 프론트엔드",
      }),
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      slug: "react-operations",
      heading: "첫 번째 섹션",
      evidenceKind: "PROJECT_RECORD",
    });
    expect(
      results.filter((result) => result.slug === "react-operations"),
    ).toHaveLength(1);
    expect(results.map((result) => result.slug)).not.toContain("body-only");
    expect(results.map((result) => result.slug)).not.toContain(
      "unrelated-operations",
    );
  });
});

describe("buildBlogEvidenceChecklist", () => {
  it("separates topics with matching posts from topics that need more evidence", () => {
    const items = buildBlogEvidenceChecklist(
      opportunityWith([
        "React와 TypeScript로 만든 제품을 실제 사용자에게 배포하고 운영한 경험",
        "다른 직군과 요구사항이나 인터페이스를 조율한 경험",
      ]),
      [
        chunk({
          slug: "react-release",
          title: "React TypeScript 배포 회고",
          tags: ["React", "TypeScript"],
          searchText: "react typescript 배포 운영 사용자",
        }),
      ],
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "react-typescript-operations",
      classification: "EVIDENCE_AVAILABLE",
    });
    expect(items[0]?.evidenceLinks).toHaveLength(1);
    expect(items[1]).toMatchObject({
      id: "cross-functional-collaboration",
      classification: "NEEDS_WORK",
      evidenceLinks: [],
    });
    expect(items.every((item) => item.nextAction.length > 0)).toBe(true);
  });

  it("treats study posts as supporting material rather than proof of project experience", () => {
    const items = buildBlogEvidenceChecklist(
      opportunityWith([
        "React와 TypeScript로 만든 제품을 실제 사용자에게 배포하고 운영한 경험",
      ]),
      [
        chunk({
          slug: "study/react-release",
          title: "React TypeScript 배포와 운영 학습",
          tags: ["React", "TypeScript"],
          searchText: "react typescript 배포 운영 사용자",
        }),
      ],
    );

    expect(items[0]).toMatchObject({
      classification: "NEEDS_WORK",
      evidenceLinks: [{ evidenceKind: "LEARNING_RECORD" }],
    });
  });
});
