# Backend article component parity final gate (#187)

Date: 2026-06-29

## Scope

Backend-backed SEOJing study article rendering was checked against the existing MDX/local reader experience before widening the migration.

Representative routes:

- JavaScript Quizbook Day 6: `/blog/study/javascript-quizbook/day6`
- Effective TypeScript Day 6: `/blog/study/effective-typescript/day6`

## Regression checklist

For each backend-backed representative article, check these separately:

1. Public API readback
   - Encoded slug route returns 200.
   - Slash slug route returns 200.
   - Response contains the expected title/body data.
   - Local file paths are redacted from public assets.
2. Canonical production route readback
   - Canonical `https://seojing.com/blog/...` route returns 200.
   - Page contains the expected article title.
   - Page does not expose backend component placeholder text such as `[ArticleQuiz component]`.
3. Local backend-backed DOM/render check
   - Structured backend blocks are used instead of duplicating HTML fallback.
   - Code fences render as code blocks with language/meta where present.
   - Paragraph/quote inline markdown does not leak as literal `` `code` ``, `**bold**`, or escaped `<br />`.
   - Markdown tables render as tables and remain horizontally safe.
   - Structured `ArticleQuiz` candidate renders through the SEOJing quiz UI.
   - Q&A/TTS-adjacent page areas remain present and not displaced.
4. Visual check
   - Headings, body rhythm, code blocks, inline visual/image, table, quiz, Q&A panel, post list, and related cards render without obvious clipping/overflow.
   - No literal markdown/component placeholders are visible in the reader path.

## Implementation notes from #187

Frontend adapter patch:

- `apps/web/src/shared/content/backend-article.tsx`
  - Renders backend `PARAGRAPH` blocks with `content.table` as `<table>`.
  - Parses conservative inline markdown for backend paragraph/quote/table cell text: inline code, bold, and `<br>`.
- `apps/web/src/shared/content/backend-article.test.tsx`
  - Covers inline markdown, quote `<br>`, and structured table rendering without fallback duplication.

Backend ingest patch:

- `src/services/mdx-ingest.ts`
  - Preserves fenced-code info string as `language` + `meta`.
  - Preserves MDX component candidates as structured block content with `rawMdx`, `props`, `renderHint`, and nested `ArticleQuizItem` props where simple parsing is possible.
  - Keeps `Callout` as sanitized fallback HTML plus structured candidate data.
- `src/routes/admin-writing.ts`
  - Admin draft/create paths now derive `renderedHtml`, `blocks`, and `assets` from `sourceText` when explicit values are not provided.
- `docs/mdx-ingest-support.md`
  - Updated the ingest boundary contract for code/meta and component candidates.

## Evidence captured

Automated tests/builds:

- SEOJing frontend: `pnpm --filter @app/web test -- backend-article.test.tsx` → 23 files / 189 tests passed.
- SEOJing frontend: `pnpm --filter @app/web build` → build complete.
- seojing-backend: `pnpm test -- mdx-ingest admin-writing articles-api` → 11 files passed, 1 skipped / 44 passed, 2 skipped.
- seojing-backend: `pnpm build` → `tsc -p tsconfig.json` passed.

Local backend-backed route probe:

- `/blog/study/javascript-quizbook/day6`
  - blocks: true
  - HTML fallback duplication: false
  - code block: true
  - quiz: true
  - table: true
  - literal `<br>`/`**bold**`: false
  - component placeholder: false
- `/blog/study/effective-typescript/day6`
  - blocks: true
  - HTML fallback duplication: false
  - code block: true
  - component placeholder: false

Visual check:

- Browser screenshot of local backend-backed JS Quizbook Day 6 showed code blocks, inline visual, table, quiz, Q&A, post list, and related cards rendered reasonably without visible clipping or literal markdown/component placeholders.

Public readback on 2026-06-29:

- `https://api.seojing.com/articles/study%2Fjavascript-quizbook%2Fday6` → HTTP 200, expected JS title present, no placeholder marker detected.
- `https://api.seojing.com/articles/study/javascript-quizbook/day6` → HTTP 200, expected JS title present, no placeholder marker detected.
- `https://api.seojing.com/articles/study%2Feffective-typescript%2Fday6` → HTTP 200, expected TS title present, no placeholder marker detected.
- `https://api.seojing.com/articles/study/effective-typescript/day6` → HTTP 200, expected TS title present, no placeholder marker detected.
- `https://seojing.com/blog/study/javascript-quizbook/day6` → HTTP 200, expected JS title present, no placeholder marker detected.
- `https://seojing.com/blog/study/effective-typescript/day6` → HTTP 200, expected TS title present, no placeholder marker detected.

## Gate result

Pass for #187 local/frontend-backend parity and public readback separation. Keep the API boundary conservative: backend ingest preserves component data and safe fallbacks; frontend owns actual interactive rendering for supported candidates.
