/**
 * Slug-level source of truth for the public article migration boundary.
 *
 * Keep an article in `bundled-mdx` until its DB projection and public renderer
 * meet the backend-backed readback contract. This registry intentionally does
 * not enable a prefix or ingest content. It defines the healthy-backend readback
 * contract and any explicitly retained, public bundled outage fallback.
 * Transport/body-read failures and 5xx responses may use that fallback.
 * An authoritative API 404 preserves backend unpublish/not-found semantics.
 */
export const ARTICLE_MIGRATION_REGISTRY = Object.freeze([
  {
    slug: "study/clab-26-1/week1",
    mode: "bundled-mdx",
    label: "legacy CLAB study MDX parity sentinel",
    public: {
      expectedText: [
        "프론트엔드 스터디 1주차",
        "2026년 3월 23일",
        "프론트엔드",
        "웹접근성",
        "데이터 요금을 아껴주는",
        "article과 section",
        "스터디 인증 미션",
        "og 태그 작업 이전",
        "og 태그 작업 이후",
      ],
      forbiddenText: [
        "data-backend-article-blocks",
        "data-backend-article-html",
        "ArticleImage fallback",
        "component omitted",
        "2026년 6월 28일",
      ],
    },
  },
  {
    slug: "study/javascript-quizbook/day10",
    mode: "bundled-mdx",
    label: "current JS Quizbook study article sentinel",
    public: {
      expectedText: [
        "자바스크립트 퀴즈북 리마인드 Day 10",
        "함수는 값이고 경계다",
        "함수 설계 경계",
        "ArticleQuiz",
        "고차 함수",
      ],
      forbiddenText: [
        "data-backend-article-blocks",
        "data-backend-article-html",
        "ArticleImage fallback",
        "component omitted",
      ],
    },
  },
  {
    slug: "study/effective-typescript/day5",
    mode: "backend-migrated",
    fallback: "bundled-mdx",
    label: "Effective TypeScript Day 5 backend projection sentinel",
    api: {
      requiredStatus: "PUBLISHED",
      minimumBlockCount: 1,
      requiredBlockTypes: ["CODE", "IMAGE", "QUIZ"],
      requiredQuizItems: 1,
    },
    public: {
      expectedText: [
        "이펙티브 타입스크립트 2판 Day 5",
        "좁혀진 타입은 언제 다시 넓어지는가",
      ],
      requiredHtmlPatterns: [
        {
          label: "backend article renderer marker",
          scope: "article-content",
          pattern: "<[^>]+data-backend-article-(?:blocks|html)(?:=|\\s|>)",
        },
        {
          label: "rendered code block",
          scope: "article-content",
          pattern: "<[^>]+data-code-block(?:=|\\s|>)",
        },
        {
          label: "rendered article-body image",
          scope: "article-content",
          pattern:
            '<img(?=[^>]*src="[^"]*inference-api-design\\.svg")(?=[^>]*alt="타입 추론과 API 경계")[^>]*>',
        },
        {
          label: "rendered interactive quiz",
          scope: "article-content",
          pattern: "<[^>]+data-article-quiz(?:=|\\s|>)",
        },
      ],
      forbiddenText: [
        "ArticleQuiz fallback",
        "ArticleQuizItem fallback",
        "ArticleImage fallback",
        "component omitted",
        "block is not supported",
        "RAW_MDX",
        "```",
      ],
    },
  },
]);

export function publicArticlePath(slug) {
  return `/blog/${slug}`;
}

export function publicArticleApiPath(slug) {
  return `/articles/${slug}`;
}
