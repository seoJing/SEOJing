# SEOJing Backend Content Platform ADR

Date: 2026-06-28
Status: Proposed
Ticket: Hermes #160

## Context

SEOJing의 글 수가 늘면서 MDX 본문이 Cloudflare Worker 배포 번들에 compiled JS module로 포함되고 있다. 로컬 `pnpm build`는 통과해도 Cloudflare Deploy 단계에서 Worker script size limit에 걸릴 수 있다.

2026-06-28 기준 Day 6 study publish는 다음 이유로 공개 발행이 보류되었다.

- Cloudflare Workers free-plan script size limit: 3 MiB
- Wrangler error: `Worker exceeded the size limit of 3 MiB` / Cloudflare code `10027`
- 실패 당시 업로드: `gzip 3046.98 KiB`
- draft 보존: local branch `local/day6-study-size-blocked`, commit `718896e`
- main 복구: `45f9ca0 feature: add dual study day 5 posts`

이 문제는 글 내용의 품질이나 MDX 문법 문제가 아니라, 콘텐츠가 Worker bundle에 누적되는 구조 문제다.

## Current baseline

Measured on `main` at `45f9ca0` with:

```bash
pnpm --filter @app/web exec wrangler deploy --dry-run --outdir /tmp/seojing-wrangler-size-adr
```

Wrangler output:

```text
Total Upload: 22692.95 KiB / gzip: 3047.13 KiB
```

Generated server artifact estimate:

```text
apps/web/dist/server files: 388
apps/web/dist/server raw: 22920.8 KiB
apps/web/dist/server gzip estimate: 3462.8 KiB
```

MDX-like compiled assets:

```text
compiled *.compiled-*.js files: 185
compiled raw: 12429.4 KiB
compiled gzip estimate: 1201.2 KiB
```

Source content:

```text
apps/web/content markdown/mdx files: 183
source raw: 2183.1 KiB

SEOJing: 39 files / 289.0 KiB
clab: 6 files / 41.2 KiB
kd-team: 6 files / 50.5 KiB
okayJing: 62 files / 414.2 KiB
spot: 7 files / 105.1 KiB
study: 62 files / 1278.1 KiB
```

Largest current server JS artifacts by raw size:

```text
6888.1 KiB index.js
539.2 KiB ssr/index.js
428.9 KiB ssr/assets/worker-entry-BPvsfkLv.js
404.4 KiB assets/day6.compiled-tnashILN.js
355.9 KiB assets/week11.compiled-CcHc0zo6.js
315.8 KiB assets/week2.compiled-BoBCXLGg.js
300.8 KiB assets/week9.compiled-Ddyjy3Wg.js
294.2 KiB assets/day2.compiled-Dvff16dT.js
294.1 KiB assets/day7.compiled-DS_lM3sG.js
293.3 KiB assets/week4.compiled-BWEXvxO2.js
292.3 KiB assets/week8.compiled-BiXCXPlr.js
280.6 KiB assets/week7.compiled-B7SbG2Gf.js
244.3 KiB assets/week10.compiled-C3OvGvYH.js
242.1 KiB assets/day5.compiled-1o_SWWtw.js
232.7 KiB assets/day1.compiled-Dbcu2nfR.js
```

## Decision

Create a separate public repository, `seojing-backend`, as SEOJing's content/community backend.

The backend should not be a thin file proxy only. It should become a portfolio-worthy content platform backend that owns:

- article metadata and publish status;
- article revision history;
- MDX ingestion/rendering;
- block-based writing model;
- public article API;
- GitHub OAuth identity;
- comments/questions/discussions storage;
- later search, analytics, Q&A/RAG, and TTS integrations.

Cloudflare Worker should remain the public frontend/cache layer for `seojing.com`, but article body content should not be compiled into Worker JS modules.

## Data model direction

Use PostgreSQL from the start because content creation, edits, revisions, section-level questions, comments, moderation, and later analytics/search are relational and frequently updated.

Initial core tables:

```text
users
github_accounts

articles
article_revisions
article_blocks
article_assets

comments
questions
```

Article storage should support both MDX and block-based editing:

```text
article_revisions.source_format = mdx | blocks
article_revisions.source_text   = original MDX or markdown-compatible source
article_revisions.rendered_html = cached public rendering
article_revisions.rendered_json = optional block/render payload
article_blocks                  = structured Notion-like blocks for new/editor-authored content
```

MDX is not removed. It is demoted from "Worker-bundled runtime component source" to one supported authoring/import/export format.

## Rendering/API direction

Public SEOJing URLs should remain stable:

```text
/blog/study/javascript-quizbook/day5
/blog/study/effective-typescript/day5
/blog/okayJing/...
```

Frontend request flow target:

```text
Browser
  -> seojing.com / Cloudflare Worker
  -> backend article API fetch/cache
  -> SEO-safe HTML response under the existing route
```

Initial public API shape:

```text
GET /articles
GET /articles/:slug
```

Article response should include:

- slug, title, description, date, category, series, tags;
- cover/asset metadata;
- table of contents;
- rendered body payload (`html` first, block payload later);
- `updatedAt` and `etag`/cache metadata.

Public API must not expose:

- draft/unpublished content;
- local filesystem paths;
- private notes;
- raw secrets or admin metadata.

## Writing UX direction

The immediate writing pain is that MDX components are inconvenient to insert and maintain by hand. The first UX improvement should be an Admin Writing MVP, not a full Notion clone.

Phased writing UX:

1. MDX editor with component insert buttons:
   - Quiz
   - Callout
   - Code
   - Diagram
   - Question prompt
2. Block editor foundation:
   - paragraph
   - heading
   - code
   - image
   - callout
   - quiz
   - diagram
3. Import/export compatibility:
   - MDX -> blocks where supported
   - blocks -> HTML
   - blocks -> MDX export where useful

This keeps existing content compatible while enabling lower-friction future authoring.

## GitHub interaction direction

Use GitHub OAuth for user identity. Store comments/questions in SEOJing's own backend database rather than using GitHub Discussions/Issues as the primary datastore.

Reasons:

- section-level questions are easier to model;
- moderation/status workflow is under SEOJing control;
- later Q&A/RAG/article-improvement loops can use first-party data;
- public UX is not constrained by GitHub Discussion UI.

GitHub mirroring can be added later if desired, but should not be the MVP datastore.

## Bundle-size success target

Current Worker gzip upload:

```text
3047.13 KiB
```

Expected reduction if MDX compiled body modules leave the Worker bundle:

```text
conservative: -1100 to -1300 KiB gzip
initial target: <= 1800 KiB gzip
stretch target: 1200-1600 KiB gzip
```

CI should enforce a Worker size budget before deploy:

```text
warning threshold: 2500 KiB gzip
hard fail threshold: 2800 KiB gzip
```

This budget should be implemented separately from the backend migration so future content publishes fail early before Cloudflare Deploy.

## Migration plan

1. Document current bundle/content baseline and Day 6 blocker evidence. (#160)
2. Create public `seojing-backend` repository skeleton. (#161)
3. Implement Article/Revision/Block DB schema MVP. (#162)
4. Add Worker bundle size budget CI gate to SEOJing. (#166)
5. Implement MDX ingest/render pipeline. (#163)
6. Implement public Article API and cache contract. (#164)
7. Integrate SEOJing frontend experimentally behind a feature flag. (#165)
8. Move study series gradually, starting with JS Quizbook and Effective TypeScript. (#170)
9. Add Admin Writing MVP with MDX component insert buttons. (#167)
10. Add block editor foundation. (#168)
11. Add GitHub OAuth comments/questions MVP. (#169)

## Non-goals for the first pass

- Rewriting all existing SEOJing content at once.
- Removing MDX as an authoring format.
- Building a complete Notion clone before fixing the deploy-size blocker.
- Breaking existing public `/blog/...` URLs.
- Moving private drafts or internal notes into public APIs.
- Treating SPOT archive content as an active migration priority.

## Open questions

- Repository name final choice: `seojing-backend` vs `seojing-content-api`. Current recommendation: `seojing-backend` because scope includes content, community, analytics, and AI features.
- Deployment target for MVP: Mac mini via Cloudflare Tunnel first, or hosted Postgres/backend provider from day one.
- Whether the admin writing UI should live inside SEOJing frontend (`/ops/write`) or a separate app. Current recommendation: start inside SEOJing/admin surface, split later only if needed.
- Which MDX custom components are mandatory for the first migration batch. Current recommendation: support enough for JS Quizbook and Effective TypeScript Day 5/6, document unsupported components explicitly.

## Verification for this ADR

- `git status --short --branch`: clean before writing this ADR.
- `wrangler deploy --dry-run`: captured current upload size.
- Local branch `local/day6-study-size-blocked` exists at `718896e` with Day 6 draft files.
- Hermes tickets #159-#170 created for execution split.
