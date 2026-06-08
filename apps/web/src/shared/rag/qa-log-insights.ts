import type { PostQaStatus } from "./post-qa";

export type QaLogEntry = {
  slug: string;
  question: string;
  status: PostQaStatus;
  createdAt: string;
};

export type QaSlugSummary = {
  slug: string;
  questionCount: number;
  insufficientContextCount: number;
  topTerms: string[];
  latestQuestionAt: string;
};

export type QaFaqCandidate = {
  slug: string;
  representativeQuestion: string;
  questionCount: number;
  topTerms: string[];
  priority: "high" | "medium";
};

export type QaContentAction = {
  slug: string;
  action: "revise_existing_post" | "draft_followup_post";
  reason: string;
  sampleQuestions: string[];
};

export type QaLogInsights = {
  generatedAt: string;
  totalQuestions: number;
  bySlug: QaSlugSummary[];
  faqCandidates: QaFaqCandidate[];
  contentActions: QaContentAction[];
};

export type QaLogInsightOptions = {
  minQuestionsForFaq?: number;
  now?: string;
};

const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}._+-]*/gu;
const STOPWORDS = new Set([
  "이건",
  "뭐야",
  "어떻게",
  "다시",
  "설명해줘",
  "예시로",
  "어디서",
  "차이가",
  "흐름을",
]);

export function isQaLogEntry(entry: unknown): entry is QaLogEntry {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return false;
  }
  const candidate = entry as Partial<QaLogEntry>;
  return (
    typeof candidate.slug === "string" &&
    typeof candidate.question === "string" &&
    typeof candidate.createdAt === "string" &&
    ["answered", "insufficient_context", "invalid_request"].includes(
      String(candidate.status),
    )
  );
}

function validLog(entry: QaLogEntry): boolean {
  return (
    isQaLogEntry(entry) &&
    Boolean(entry.slug.trim() && entry.question.trim()) &&
    !Number.isNaN(Date.parse(entry.createdAt))
  );
}

function createdAtMs(entry: QaLogEntry): number {
  return new Date(entry.createdAt).getTime();
}

function tokenizeQuestion(question: string): string[] {
  return Array.from(
    new Set(
      (question.match(TOKEN_PATTERN) ?? [])
        .map((token) => token.toLocaleLowerCase("ko-KR"))
        .filter((token) => token.length >= 2 && !STOPWORDS.has(token)),
    ),
  );
}

function topTerms(entries: QaLogEntry[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const token of tokenizeQuestion(entry.question)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, limit)
    .map(([term]) => term);
}

function latestQuestionAt(entries: QaLogEntry[]): string {
  return (
    entries
      .map((entry) => [entry.createdAt, createdAtMs(entry)] as const)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
  );
}

function representativeQuestion(
  entries: QaLogEntry[],
  terms: string[],
): string {
  const [best] = [...entries].sort((a, b) => {
    const aScore = terms.filter((term) =>
      a.question.toLocaleLowerCase("ko-KR").includes(term),
    ).length;
    const bScore = terms.filter((term) =>
      b.question.toLocaleLowerCase("ko-KR").includes(term),
    ).length;
    return bScore - aScore || createdAtMs(a) - createdAtMs(b);
  });

  return best?.question ?? "";
}

export function buildQaLogInsights(
  entries: QaLogEntry[],
  options: QaLogInsightOptions = {},
): QaLogInsights {
  const minQuestionsForFaq = options.minQuestionsForFaq ?? 3;
  const usableEntries = entries.filter(validLog);
  const grouped = new Map<string, QaLogEntry[]>();

  for (const entry of usableEntries) {
    grouped.set(entry.slug, [...(grouped.get(entry.slug) ?? []), entry]);
  }

  const bySlug = Array.from(grouped.entries())
    .map<QaSlugSummary>(([slug, slugEntries]) => ({
      slug,
      questionCount: slugEntries.length,
      insufficientContextCount: slugEntries.filter(
        (entry) => entry.status === "insufficient_context",
      ).length,
      topTerms: topTerms(slugEntries),
      latestQuestionAt: latestQuestionAt(slugEntries),
    }))
    .sort(
      (a, b) =>
        b.questionCount - a.questionCount ||
        b.insufficientContextCount - a.insufficientContextCount ||
        a.slug.localeCompare(b.slug),
    );

  const faqCandidates = bySlug
    .filter((summary) => summary.questionCount >= minQuestionsForFaq)
    .map<QaFaqCandidate>((summary) => ({
      slug: summary.slug,
      representativeQuestion: representativeQuestion(
        grouped.get(summary.slug) ?? [],
        summary.topTerms,
      ),
      questionCount: summary.questionCount,
      topTerms: summary.topTerms,
      priority:
        summary.insufficientContextCount > 0 || summary.questionCount >= 5
          ? "high"
          : "medium",
    }));

  const contentActions = bySlug.flatMap<QaContentAction>((summary) => {
    const slugEntries = grouped.get(summary.slug) ?? [];
    const sampleQuestions = slugEntries
      .slice(0, 3)
      .map((entry) => entry.question);
    const actions: QaContentAction[] = [];

    if (summary.insufficientContextCount > 0) {
      actions.push({
        slug: summary.slug,
        action: "revise_existing_post",
        reason: `insufficient_context 질문 ${summary.insufficientContextCount}개`,
        sampleQuestions,
      });
    }

    if (summary.questionCount >= minQuestionsForFaq) {
      actions.push({
        slug: summary.slug,
        action: "draft_followup_post",
        reason: `반복 질문 ${summary.questionCount}개`,
        sampleQuestions,
      });
    }

    return actions;
  });

  return {
    generatedAt: options.now ?? new Date().toISOString(),
    totalQuestions: usableEntries.length,
    bySlug,
    faqCandidates,
    contentActions,
  };
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/[\\`*_{}[\]()#+\-.!|>]/g, "\\$&")
    .replace(/\r?\n/g, " ")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[phone]")
    .replace(
      /\b(?:sk|pk|ghp|github_pat|xox[baprs])-?[A-Za-z0-9_.=-]{6,}\b/g,
      "[token]",
    )
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[token]")
    .replace(/https?:\/\/\S+/gi, "[url]");
}

function safeReportText(value: string): string {
  return escapeMarkdown(redactSensitiveText(value));
}

export function renderQaLogInsightsMarkdown(insights: QaLogInsights): string {
  const lines = [
    "# SEOJing Q&A 운영 루프",
    "",
    `생성 시각: ${insights.generatedAt}`,
    `총 질문 수: ${insights.totalQuestions}`,
    "",
    "## FAQ 후보",
  ];

  if (insights.faqCandidates.length === 0) {
    lines.push("- 아직 FAQ로 승격할 반복 질문이 없습니다.");
  } else {
    for (const candidate of insights.faqCandidates) {
      lines.push(
        `- [${candidate.priority}] ${safeReportText(candidate.slug)}: ${safeReportText(candidate.representativeQuestion)}`,
        `  - 질문 수: ${candidate.questionCount}`,
        `  - 핵심어: ${candidate.topTerms.map(safeReportText).join(", ") || "없음"}`,
      );
    }
  }

  lines.push("", "## 콘텐츠 개선 액션");
  if (insights.contentActions.length === 0) {
    lines.push("- 당장 수정/후속 글 후보가 없습니다.");
  } else {
    for (const action of insights.contentActions) {
      lines.push(
        `- ${action.action}: ${safeReportText(action.slug)}`,
        `  - 이유: ${safeReportText(action.reason)}`,
        `  - 샘플: ${action.sampleQuestions.map(safeReportText).join(" / ")}`,
      );
    }
  }

  lines.push("", "## 슬러그별 요약");
  for (const summary of insights.bySlug) {
    lines.push(
      `- ${safeReportText(summary.slug)}: 질문 ${summary.questionCount}개, 근거 부족 ${summary.insufficientContextCount}개, top=${summary.topTerms.map(safeReportText).join(", ") || "없음"}`,
    );
  }

  return `${lines.join("\n")}\n`;
}
