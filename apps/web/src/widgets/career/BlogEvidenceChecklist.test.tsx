import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BlogEvidenceChecklistItem } from "@/shared/career/blog-evidence";

import { BlogEvidenceChecklist } from "./BlogEvidenceChecklist";

const items: BlogEvidenceChecklistItem[] = [
  {
    id: "react-typescript-operations",
    title: "React·TypeScript 제품 운영",
    keywords: ["React", "TypeScript", "배포"],
    whyItMatters: "실제 사용자에게 배포하고 개선한 과정이 필요합니다.",
    evidenceLinks: [
      {
        slug: "react-release",
        href: "/blog/react-release",
        title: "React 배포 회고",
        heading: "운영 뒤 개선",
        score: 40,
        evidenceKind: "PROJECT_RECORD",
      },
    ],
    nextAction: "본인 역할과 운영 결과를 각각 한 문장으로 표시하세요.",
    classification: "EVIDENCE_AVAILABLE",
  },
  {
    id: "cross-functional-collaboration",
    title: "다른 직군과 인터페이스 조율",
    keywords: ["협업", "인터페이스"],
    whyItMatters: "다른 직군과의 합의 경험이 필요합니다.",
    evidenceLinks: [],
    nextAction: "쟁점, 합의, 결과를 5문장으로 기록하세요.",
    classification: "NEEDS_WORK",
  },
];

describe("BlogEvidenceChecklist", () => {
  it("renders accessible evidence and gap groups without claiming mastery", () => {
    render(<BlogEvidenceChecklist items={items} />);

    expect(
      screen.getByRole("region", { name: "지원 준비 체크리스트" }),
    ).toBeInTheDocument();
    const evidenceGroup = screen.getByRole("region", {
      name: "블로그 근거로 어필 가능",
    });
    const gapGroup = screen.getByRole("region", { name: "추가 보완 추천" });

    expect(
      within(evidenceGroup).getByRole("article", {
        name: "React·TypeScript 제품 운영",
      }),
    ).toBeInTheDocument();
    expect(
      within(gapGroup).getByRole("article", {
        name: "다른 직군과 인터페이스 조율",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/숙련도를 확정하지 않습니다/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "React 배포 회고" }),
    ).toHaveAttribute("href", "/blog/react-release");
    expect(screen.getByText("프로젝트·운영 기록")).toBeInTheDocument();
    expect(screen.getAllByText("다음 행동")).toHaveLength(2);
  });

  it("keeps cards and links mobile-safe with wrapping and no horizontal grid requirement", () => {
    const { container } = render(<BlogEvidenceChecklist items={items} />);

    const root = screen.getByRole("region", {
      name: "지원 준비 체크리스트",
    });
    const layout = root.querySelector(".grid");
    const cards = screen.getAllByRole("article");
    const link = screen.getByRole("link", { name: "React 배포 회고" });

    expect(root).toHaveClass("min-w-0", "overflow-hidden");
    expect(layout).toHaveClass("grid-cols-1");
    expect(cards.every((card) => card.classList.contains("min-w-0"))).toBe(
      true,
    );
    expect(link).toHaveClass("break-words");
    expect(container.querySelector('[aria-label="핵심 키워드"]')).toHaveClass(
      "flex-wrap",
    );
  });
});
