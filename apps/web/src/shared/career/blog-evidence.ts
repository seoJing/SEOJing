import type { CareerOpportunity } from "./types";

export interface BlogSearchChunk {
  id: string;
  slug: string;
  href: string;
  title: string;
  description?: string;
  tags?: string[];
  date?: string;
  heading: string;
  searchText: string;
}

export interface BlogEvidenceLink {
  slug: string;
  href: string;
  title: string;
  heading: string;
  score: number;
  evidenceKind: "PROJECT_RECORD" | "LEARNING_RECORD";
}

export interface BlogEvidenceChecklistItem {
  id: string;
  title: string;
  keywords: string[];
  whyItMatters: string;
  evidenceLinks: BlogEvidenceLink[];
  nextAction: string;
  classification: "EVIDENCE_AVAILABLE" | "NEEDS_WORK";
}

interface PreparationTopic {
  id: string;
  title: string;
  keywords: string[];
  whyItMatters: string;
  searchTerms: string[];
  requiredSearchGroups: string[][];
  evidenceNextAction: string;
  gapNextAction: string;
}

interface TopicProfile extends PreparationTopic {
  aliasGroups: string[][];
}

const TOPIC_PROFILES: TopicProfile[] = [
  {
    id: "react-typescript-operations",
    title: "React·TypeScript 제품 운영",
    keywords: ["React", "TypeScript", "배포", "운영 개선"],
    aliasGroups: [
      ["react", "typescript"],
      ["실제 사용자", "배포", "운영", "개선"],
    ],
    searchTerms: [
      "react",
      "typescript",
      "배포",
      "운영",
      "사용자",
      "프론트엔드",
    ],
    requiredSearchGroups: [
      ["react", "typescript"],
      ["배포", "운영", "실제 사용자", "사용자에게"],
    ],
    whyItMatters:
      "구현 자체보다 실제 사용자에게 전달한 뒤 관찰하고 개선한 과정이 공식 지원 요건에 포함됩니다.",
    evidenceNextAction:
      "가장 가까운 글 1개에 본인 역할, 배포 대상, 운영 중 개선 결과를 각각 한 문장으로 표시해 지원서 사례로 연결하세요.",
    gapNextAction:
      "배포한 React·TypeScript 프로젝트 1개를 골라 사용자, 배포 경로, 운영 중 바꾼 점을 5문장으로 기록하세요.",
  },
  {
    id: "cross-layer-debugging",
    title: "경계까지 추적하는 문제 해결",
    keywords: ["디버깅", "네트워크", "서버 경계", "원인 추적"],
    aliasGroups: [
      ["화면", "네트워크", "서버", "경계"],
      ["문제", "원인", "추적", "좁힌", "해결"],
    ],
    searchTerms: [
      "트러블슈팅",
      "디버깅",
      "네트워크",
      "서버",
      "원인",
      "문제",
      "해결",
    ],
    requiredSearchGroups: [
      ["트러블슈팅", "디버깅", "원인", "문제"],
      ["네트워크", "서버", "화면", "경계", "hydration", "rsc", "cloudflare"],
    ],
    whyItMatters:
      "공식 요건은 증상 수정이 아니라 화면·네트워크·서버 사이에서 원인을 구분하고 끝까지 해결한 경험을 요구합니다.",
    evidenceNextAction:
      "연결된 글 1개의 진단 순서를 화면 → 네트워크 → 서버로 다시 적고, 결정적 증거와 최종 수정 결과를 표시하세요.",
    gapNextAction:
      "최근 장애 1건의 가설, 확인 도구, 배제한 원인, 최종 원인, 재발 방지를 순서대로 기록하세요.",
  },
  {
    id: "requirement-prioritization",
    title: "변경 요구사항 우선순위 판단",
    keywords: ["요구사항", "우선순위", "트레이드오프", "제품 판단"],
    aliasGroups: [
      ["요구사항", "요구 사항"],
      ["우선순위", "먼저", "미뤘", "판단"],
    ],
    searchTerms: [
      "요구사항",
      "우선순위",
      "트레이드오프",
      "결정",
      "판단",
      "mvp",
    ],
    requiredSearchGroups: [
      ["요구사항", "우선순위", "판단", "결정"],
      ["미뤘", "제약", "트레이드오프", "mvp", "선택", "먼저"],
    ],
    whyItMatters:
      "변화하는 상황에서 무엇을 먼저 만들고 미룰지 스스로 판단한 근거가 공식 지원 요건에 명시돼 있습니다.",
    evidenceNextAction:
      "연결된 사례에 선택지, 판단 기준, 미룬 범위, 결과를 한 줄씩 추가해 의사결정 근거를 드러내세요.",
    gapNextAction:
      "요구사항이 바뀐 사례 1개를 골라 선택지·제약·우선순위 기준·포기한 범위·결과를 표로 정리하세요.",
  },
  {
    id: "cross-functional-collaboration",
    title: "다른 직군과 인터페이스 조율",
    keywords: ["협업", "인터페이스", "요구사항 조율", "다른 직군"],
    aliasGroups: [
      ["다른 직군", "pm", "디자이너", "모바일 엔지니어", "서버 엔지니어"],
      ["조율", "인터페이스", "협업", "요구사항"],
    ],
    searchTerms: [
      "협업",
      "인터페이스",
      "요구사항",
      "디자이너",
      "백엔드",
      "팀",
      "조율",
    ],
    requiredSearchGroups: [
      ["협업", "조율", "합의", "인계", "handoff", "넘기", "전달"],
      ["인터페이스", "요구사항", "api", "백엔드", "pm", "디자이너", "팀"],
    ],
    whyItMatters:
      "공식 요건은 구현 능력과 별개로 다른 직군과 요구사항 또는 인터페이스를 합의한 경험을 확인합니다.",
    evidenceNextAction:
      "연결된 사례에 상대 직군, 의견 차이, 합의한 인터페이스, 합의 뒤 달라진 결과를 각각 한 문장으로 추가하세요.",
    gapNextAction:
      "PM·디자이너·서버·모바일 중 한 직군과 조율한 사례를 골라 쟁점, 합의, 결과를 5문장으로 기록하세요.",
  },
  {
    id: "ai-assisted-verification",
    title: "AI 코딩 결과 검증과 위임 판단",
    keywords: ["AI 코딩", "결과 검증", "위임 범위", "직접 판단"],
    aliasGroups: [
      ["코딩 에이전트", "ai 코딩", "ai 도구", "인공지능"],
      ["검증", "위임", "맡긴 범위", "판단"],
    ],
    searchTerms: [
      "ai",
      "에이전트",
      "검증",
      "위임",
      "codex",
      "claude",
      "테스트",
      "리뷰",
    ],
    requiredSearchGroups: [
      ["ai", "에이전트", "codex", "claude"],
      ["검증", "위임", "리뷰", "테스트", "하네스"],
    ],
    whyItMatters:
      "공식 요건은 도구 사용 여부가 아니라 위임 범위를 정하고 산출물을 직접 검증하는 역량을 요구합니다.",
    evidenceNextAction:
      "연결된 사례에 AI에 맡긴 범위, 직접 확인한 항목, 실패를 발견한 증거, 최종 수동 판단을 명시하세요.",
    gapNextAction:
      "최근 AI 코딩 작업 1건에서 입력, 위임 범위, 자동 검사, 수동 검토, 수정 결정을 체크리스트로 남기세요.",
  },
];

const FIELD_WEIGHTS = {
  title: 12,
  description: 8,
  tags: 10,
  heading: 6,
  searchText: 2,
} as const;
const MIN_EVIDENCE_SCORE = 12;

export function extractPreparationTopics(
  opportunity: Pick<CareerOpportunity, "recruitments" | "preparationNotes">,
): PreparationTopic[] {
  const verifiedPreparationTexts = [
    ...opportunity.recruitments.flatMap(
      (recruitment) => recruitment.eligibility,
    ),
    ...opportunity.preparationNotes,
  ].map(normalize);

  return TOPIC_PROFILES.filter((profile) =>
    verifiedPreparationTexts.some((text) =>
      profile.aliasGroups.every((aliases) =>
        aliases.some((alias) => matchesTerm(text, alias)),
      ),
    ),
  ).map(({ aliasGroups: _aliasGroups, ...topic }) => topic);
}

export function rankBlogEvidence(
  topic: PreparationTopic,
  chunks: BlogSearchChunk[],
  limit = 3,
): BlogEvidenceLink[] {
  const bestBySlug = new Map<
    string,
    BlogEvidenceLink & { headingScore: number }
  >();

  for (const chunk of chunks) {
    if (chunk.slug === "resume") continue;

    const score = scoreChunk(
      chunk,
      topic.searchTerms,
      topic.requiredSearchGroups,
    );
    if (score < MIN_EVIDENCE_SCORE) continue;

    const headingScore = countMatches(chunk.heading, topic.searchTerms);
    const candidate: BlogEvidenceLink & { headingScore: number } = {
      slug: chunk.slug,
      href: chunk.href,
      title: chunk.title,
      heading: headingScore > 0 ? chunk.heading : "",
      score,
      headingScore,
      evidenceKind: chunk.slug.startsWith("study/")
        ? "LEARNING_RECORD"
        : "PROJECT_RECORD",
    };
    const current = bestBySlug.get(chunk.slug);
    if (!current || compareRankedEvidence(candidate, current) < 0) {
      bestBySlug.set(chunk.slug, candidate);
    }
  }

  return [...bestBySlug.values()]
    .sort(compareEvidence)
    .slice(0, Math.max(0, Math.min(limit, 3)))
    .map(({ headingScore: _headingScore, ...link }) => link);
}

export function buildBlogEvidenceChecklist(
  opportunity: Pick<CareerOpportunity, "recruitments" | "preparationNotes">,
  chunks: BlogSearchChunk[],
): BlogEvidenceChecklistItem[] {
  return extractPreparationTopics(opportunity).map((topic) => {
    const evidenceLinks = rankBlogEvidence(topic, chunks);
    const hasEvidence = evidenceLinks.some(
      (link) => link.evidenceKind === "PROJECT_RECORD",
    );

    return {
      id: topic.id,
      title: topic.title,
      keywords: topic.keywords,
      whyItMatters: topic.whyItMatters,
      evidenceLinks,
      nextAction: hasEvidence ? topic.evidenceNextAction : topic.gapNextAction,
      classification: hasEvidence ? "EVIDENCE_AVAILABLE" : "NEEDS_WORK",
    };
  });
}

function scoreChunk(
  chunk: BlogSearchChunk,
  terms: string[],
  requiredSearchGroups: string[][],
): number {
  const fields = {
    title: normalize(chunk.title),
    description: normalize(chunk.description ?? ""),
    tags: normalize((chunk.tags ?? []).join(" ")),
    heading: normalize(chunk.heading),
    searchText: normalize(chunk.searchText),
  };

  const highSignalText = [
    fields.title,
    fields.description,
    fields.tags,
    fields.heading,
  ].join(" ");
  const combinedText = Object.values(fields).join(" ");
  const meetsRequiredGroups = requiredSearchGroups.every((group) =>
    group.some((term) => matchesTerm(combinedText, term)),
  );
  const everyGroupHasHighSignalAnchor = requiredSearchGroups.every((group) =>
    group.some((term) => matchesTerm(highSignalText, term)),
  );
  if (!meetsRequiredGroups || !everyGroupHasHighSignalAnchor) return 0;

  return terms.reduce(
    (score, term) =>
      score +
      (Object.keys(FIELD_WEIGHTS) as (keyof typeof FIELD_WEIGHTS)[]).reduce(
        (fieldScore, field) =>
          fieldScore +
          (matchesTerm(fields[field], term) ? FIELD_WEIGHTS[field] : 0),
        0,
      ),
    0,
  );
}

function compareRankedEvidence(
  a: BlogEvidenceLink & { headingScore: number },
  b: BlogEvidenceLink & { headingScore: number },
): number {
  return b.headingScore - a.headingScore || compareEvidence(a, b);
}

function compareEvidence(a: BlogEvidenceLink, b: BlogEvidenceLink): number {
  const kindOrder = { PROJECT_RECORD: 0, LEARNING_RECORD: 1 } as const;
  return (
    kindOrder[a.evidenceKind] - kindOrder[b.evidenceKind] ||
    b.score - a.score ||
    a.slug.localeCompare(b.slug, "ko")
  );
}

function countMatches(value: string, terms: string[]): number {
  return terms.filter((term) => matchesTerm(value, term)).length;
}

function matchesTerm(value: string, term: string): boolean {
  const haystack = normalize(value);
  const needle = normalize(term);
  if (!needle) return false;
  if (!/^[a-z0-9][a-z0-9 ._+#-]*$/.test(needle)) {
    return haystack.includes(needle);
  }

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

function normalize(value: string): string {
  return value
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, " ")
    .trim();
}
