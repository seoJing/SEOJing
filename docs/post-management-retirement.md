# Post-management and MDX retirement boundaries

Stage 2 retired the active frontend MDX corpus and its generated/runtime/authoring surfaces after the owner approved contract v2 on 2026-10-22. The earlier requirement for 201 individual desktop/mobile visual-acceptance records was **waived and risk-accepted, not completed**. Never describe that evidence as collected.

The immutable pre-retirement archive remains outside this repository at /Users/seojing/Projects/seojing-retirement-archives/seojing-mdx-pre-retirement-5d9c3133-ed7cc2b1-20261022.tar.gz, SHA-256 7c7405b719a647b9aa61a28800bd5e84734fc342e659eab05242e13cb8987fc4. The backend archive audit verifies the archived 201-post manifest, exact source hashes/slugs, and conversion results without requiring active apps/web/content files.

## Retained product contracts

- Public /blog index/detail, sitemap, RSS, llms.txt, search/explorer, presentation and reading progress/history.
- Protected /ops/articles list/editor backed by native DOCUMENT/BLOCKS content.
- Backend article fallback, D1 public snapshot synchronization, Giscus, and all referenced public assets.
- src/shared/content/resume-document.json is the native resume source. The old content/resume.mdx is not required by a route.
- Presentation/TTS assets and generators remain because presentation export consumes them.
- Historical analytics reporting remains; old event names do not reactivate retired routes.

## Deterministic local gates

From apps/web run focused retirement tests, full tests/coverage, TypeScript, lint, format check, build, Worker size, and public readback unit checks. After build, scan tracked active source and the produced Worker bundle for .mdx files and retired manifest/review/generated-loader imports.

Human representative desktop/mobile evidence still covers text, code, tables, images/media, quizzes, dates and responsive layout; exhaustive 201-post visual evidence remains explicitly waived. Deployment and production readback are separate authorized operations. Independent exact-diff review and a verified rollback window remain required before release.
