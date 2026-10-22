# Post-management retirement boundaries

This cleanup removes the blog Q&A/RAG endpoint and widgets, blog audio player and comment tracking. Giscus public article comments were subsequently restored from the pre-PR61 configuration; see `cms-corrections-verification.md`. Public `/blog` index/detail, sitemap, RSS, llms.txt, presentation, reading progress/history, protected `/ops/articles`, backend article fallback and D1 public snapshot synchronization remain.

Career routes/code were already absent from tracked application source. The regression suite enumerates actual route files, checks navigation and application/corpus links, executes sitemap/RSS/llms handlers against all retained manifest slugs, and checks retired module absence. It also exercises the remaining toolbar controls. These are assertions against current source/behavior, not updated snapshots.

## Local gates

From `apps/web`:

```sh
pnpm exec vitest run src/shared/content/retirement-boundary.test.ts src/shared/content/mdx-migration-manifest.test.ts src/widgets/article-toolbar/ArticleToolbar.test.tsx
pnpm test
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

Do not run publication, deployment, migration, restart, staging or commit commands as part of this cleanup. Builds and tests are local verification only.

## MDX retirement remains blocked

Retain all 201 MDX blog posts plus `content/resume.mdx`, the exact migration manifest, source hashes, referenced assets, conversion tools, migration review UI and all canonical routes. A count or successful structural conversion is not visual acceptance.

The authoritative offline readiness command and evidence schema are documented in the backend's `docs/post-management-retirement.md`. From `/Users/seojing/Projects/seojing-backend`:

```sh
pnpm mdx:retirement-audit --content-root /Users/seojing/Projects/SEOJing/apps/web/content --manifest /Users/seojing/Projects/SEOJing/apps/web/src/shared/content/mdx-migration-manifest.json --corpus-only
```

For actual readiness omit `--corpus-only` and supply `--evidence /private/path/review/evidence.json`. Without evidence the final gate exits 1. It requires all 201 named desktop/mobile visual acceptances, matching source and native DOCUMENT hashes, exact slug inventories, published current/latest revisions, and raw API/D1 payload plus D1 index-column parity. Evidence files themselves are hashed. Do not fabricate acceptance records. Existing transition notes and `MdxReviewQueue` states describe conversion/publication, not permission to retire the corpus. Even a passing final audit requires independent review and a completed rollback window before a separate removal change.

The backend also contains the unapplied, backup-first Career migration `20261021000000_retire_career_radar`; follow its runbook, never rewrite old migrations.

## Exact shared blockers retained

- `apps/web/src/shared/tts/tts-artifacts.ts` and its test, `apps/web/scripts/generate-tts-artifacts.ts`, and the `generate:tts` package script: consumed by `apps/web/src/shared/presentation/presentation-export.ts` and `apps/web/scripts/export-presentation-pptx.ts`. Removing them would change retained presentation export contracts.
- `apps/web/public/tts-artifacts/**`, `apps/web/public/summary-videos/**`, and all other public assets: presentation/media references and preserved corpus assets; no asset deletion is authorized here. `purpleSilling.png` also remains under this asset boundary.
- `apps/web/src/widgets/article-analytics/useArticleAnalytics.ts`, `article-analytics.utils.ts`, their tests, `apps/web/src/shared/analytics/**`, and `/ops/analytics`: historical Q&A/TTS metrics and shared analytics contracts remain. Event names are not active blog Q&A/TTS routes. Removing historical reporting requires a separate decision.
- `.agent-local/ocr-career-review/branch.patch`, `review.txt`, `rereview.txt`, `rules.txt`, `fixes.patch`, `final-gate.txt`: local review evidence/patches, not reproducible application outputs; preserve until their owner approves archival/removal.
- README/Work24 code, routes and documents are outside scope, including shared files' existing registrations. No changes to either feature are authorized.

The untracked generated `apps/web/src/generated/career-blog-evidence.json` was removed. The backend cleanup removes stale Career compilation outputs directly under `dist`; protected historical README build copies are listed separately as blockers.
