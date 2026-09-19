# Ticket 249: Day 5 offline fallback

## Inspection and implementation plan (updated after review)

- Worktree: `/Users/seojing/Projects/SEOJing-ticket-249-day5-fallback`, branch
  `fix/ticket-249-day5-offline-fallback`, clean at
  `5e659493f08911dbc77b81372680e5c6aa111294` (also `origin/main`).
- No applicable `AGENTS.md` files found. The canonical frontend checkout and
  backend checkout are outside the write scope; neither is needed for changes.
- PR #35 (`6bdd239`) introduced the slug migration/readback registry. PR #36
  (`f8afa3e`, merged at the base) explicitly enabled backend rendering for Day 5
  in CI and Worker vars. Preserve this healthy-backend behavior.
- `generate-content-tree.ts` omits compiled MDX/JSON for backend slugs and emits
  backend-only loader entries. `fetchBackendArticle` returns null for network,
  non-2xx, and JSON parsing failures. Both route metadata and rendering use
  `loadContent`; rendering calls `notFound()` on null.
- Keep `mode: backend-migrated` and the healthy-backend readback gate. Add an
  explicit `fallback: bundled-mdx` registry policy for Day 5. Generate its normal
  MDX modules plus a lazy fallback entry. Other migrated slugs stay backend-only.
- Preserve the nullable public adapter functions, with a typed internal result
  distinguishing found, authoritative not-found, unavailable and other rejected
  HTTP responses. Fall back only on unavailable results; backend HTTP 404 must
  preserve unpublish semantics. Other 4xx responses retain the existing null path.
- Bound opted-in backend reads to three seconds so an unresponsive API also
  reaches fallback. Keep unknown/CMS-native slug behavior unchanged.
- Add integration tests against the real generated loader and Day 5 MDX for
  network rejection, HTTP 530 with an Error 1033 body, timeout, metadata,
  backend-first recovery, and genuine absence. Run in a dedicated script that
  generates with production's Day 5 migration flag, including in CI.
- Verify focused tests, existing backend/readback tests, scoped lint/type checks,
  production build with the migration flag, the unchanged worker size gate, and
  local production HTTP responses using a controlled failing API if feasible.
  Record commands, results, limits, and rollback below. Leave changes unstaged;
  no commits, pushes, PRs, deployments, or external writes.

## Review follow-up plan (before follow-up edits)

- Rename the dedicated suite to `content-fallback.integration.tsx` and update its
  config so it cannot match default Vitest test suffixes. Run the default web
  suite against ordinary generated content, then the dedicated production-mode
  suite after build/size validation.
- Add typed results while preserving nullable callers; update Day 5 tests for
  network, timeout, 500/503/530 versus authoritative 404 and other 4xx failures.
- `await response.json()` is already within the adapter's try/catch. Add focused
  tests for parsing failures and aborted streamed bodies to lock in this behavior.
- Move the CI fallback suite after the worker size gate. Compare worker gzip
  against a base-revision build inside the ignored baseline archive if feasible.
- Repeat requested tests, scoped checks, production build/size and loopback HTTP
  proof, recording any sandbox blockers. Current permission policy forbids
  escalation. No commits, pushes, deployments or other checkout writes.

## Final design

The migration registry retains `mode: backend-migrated` and explicitly opts Day 5
into a bundled outage fallback. Healthy backend content wins. The new local
`BackendArticleLoadResult<T>` union distinguishes:

| Result        | Meaning                                                                                | Generated loader behavior                             |
| ------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `found`       | Existing API payload was loaded                                                        | Render adapted backend content                        |
| `not-found`   | Authoritative HTTP 404                                                                 | Return null; route stays 404, metadata stays noindex  |
| `unavailable` | Transport failure, timeout/body-read failure, invalid JSON, 5xx, or missing API origin | Use the opted-in bundled MDX                          |
| `rejected`    | Other non-success HTTP responses, including other 4xx                                  | Preserve null/not-found behavior; no bundled fallback |

These are frontend return types, not new backend response fields. Existing
`loadBackendArticleContent` and `fetchBackendArticle` callers still receive data
or null. The generator uses the typed result and a three-second abort signal for
opted-in backend reads. There is no callback side channel or persistent cache.

`await response.json()` was already inside the try/catch. It remains there, with
new tests using a partial `ReadableStream` response: they wait until `bodyUsed`
is true, abort the body, and verify the typed result and both nullable adapters.
Invalid JSON and authoritative 404-with-non-JSON-body are also covered.

The integration suite is now `content-fallback.integration.tsx`. The dedicated
config includes only that file. The ordinary web config restricts discovery to
`src/**/*.{test,spec}.{ts,tsx}`; the renamed suffix also avoids generic/default
Vitest test discovery. CI runs the fallback suite **after** the worker size gate,
so its content generation cannot affect the artifact whose size is checked.

## Changed files

- `apps/web/scripts/generate-content-tree.ts`: retain opted-in MDX/JSON, validate
  source availability, and generate typed-result fallback dispatch.
- `apps/web/scripts/public-article-migration-registry.mjs`: Day 5 outage policy and
  authoritative-404 semantics.
- `apps/web/scripts/public-article-migration-registry.d.mts` (new): registry types.
- `apps/web/src/shared/content/backend-article.tsx`: typed outcomes, nullable
  compatibility wrappers, and optional abort-signal propagation.
- `apps/web/src/shared/content/backend-article.test.tsx`: failure classification,
  nullable compatibility, JSON parsing and streamed-body abort tests.
- `apps/web/scripts/content-fallback.integration.tsx` (new, renamed from the
  earlier untracked `.test.tsx`): real generated MDX, route and metadata tests.
- `apps/web/vitest.content-fallback.config.ts` (new): isolated integration config.
- `apps/web/scripts/check-public-blog-readback.test.mjs`: explicit registry
  opt-in assertion alongside the existing healthy-backend renderer contract.
- `apps/web/package.json`: dedicated generation/integration test command.
- `.github/workflows/ci.yml`: fallback suite after worker size validation.
- `docs/ticket-249-day5-offline-fallback.md` (new): plan, design and evidence.

The route, Day 5 source MDX, Worker budget and backend response shape are unchanged.
Generated artifacts and baseline archives remain ignored. All eleven source/doc
changes are unstaged; the Git index is unchanged.

## Follow-up verification

Environment: Node `v24.16.0`, locked pnpm `10.19.0`, this worktree only. Every pnpm
command below used the prefix `PATH=/private/tmp/ticket-249-bin:$PATH`. That bin
contains the pinned pnpm installed during the initial implementation. No dependency
or lockfile changes were made in this follow-up. Logs below are from this revision;
the previous report is archived at `/private/tmp/ticket-249-pre-review-notes.md`.

### Full and focused tests

Ordinary bundled content was generated with no migration flags before running
the full suite:

```sh
TMPDIR=/private/tmp SEOJING_BACKEND_ARTICLE_SLUGS= SEOJING_BACKEND_ARTICLE_PREFIXES= node --import ./apps/web/node_modules/tsx/dist/loader.mjs apps/web/scripts/generate-content-tree.ts
pnpm --filter @app/web test
pnpm --filter @app/web exec vitest run src/shared/content/backend-article.test.tsx src/widgets/mdx-renderer/MdxRenderer.test.tsx
pnpm --filter @app/web run public:readback:test
```

Results, all exit 0:

- Generation: 202 bundled articles, 2327 search chunks.
- Full web suite: **219/219 tests, 26/26 files**, 2.62 s. The integration file is
  absent from ordinary discovery and does not assume backend-first generation.
- Focused adapter/MDX suite: **29/29 tests, 2/2 files**, 768 ms.
- Readback/deployment tests: **8/8 tests**.

Logs: `/private/tmp/ticket-249-r2-{generate-direct,full-web,focused,readback}.log`.

### Production generation/build and integration suite

The original command wrappers were attempted:

```sh
TMPDIR=/private/tmp WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=/private/tmp/ticket-249-r2-wrangler-logs SEOJING_BACKEND_ARTICLE_SLUGS=study/effective-typescript/day5 SEOJING_BACKEND_ARTICLE_PREFIXES= pnpm build
TMPDIR=/private/tmp pnpm --filter @app/web run test:content-fallback
```

Both exit 1 before generation because the sandbox blocks the `tsx` CLI IPC
socket (`listen EPERM /private/tmp/tsx-501/...pipe`). The current permission
policy disallows escalation. The equivalent production generation/build steps
completed successfully without that CLI socket:

```sh
TMPDIR=/private/tmp SEOJING_BACKEND_ARTICLE_SLUGS=study/effective-typescript/day5 SEOJING_BACKEND_ARTICLE_PREFIXES= node --import ./apps/web/node_modules/tsx/dist/loader.mjs apps/web/scripts/generate-content-tree.ts
TMPDIR=/private/tmp WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=/private/tmp/ticket-249-r2-wrangler-logs SEOJING_BACKEND_ARTICLE_SLUGS=study/effective-typescript/day5 SEOJING_BACKEND_ARTICLE_PREFIXES= pnpm --filter @app/web exec vinext build
```

Both exit 0. Production generation retains 202 bundled articles, keeps 2315
search chunks, and explicitly enables the Day 5 backend loader. The full Vinext
production build completed all five stages and emitted `dist/server/wrangler.json`.
No source/package-script change was made just to accommodate this local sandbox.

After the build and worker size gate, the dedicated suite was run against that
fresh production-mode generated loader:

```sh
pnpm --filter @app/web exec vitest run --config vitest.content-fallback.config.ts
```

Exit 0: **15/15 tests, 1/1 file**, 762 ms. Coverage includes network failure,
timeout, HTTP 500/503/530, invalid JSON, missing configuration, backend recovery,
Day 5 HTTP 404 with noindex metadata/notFound, other rejected 4xx, and unknown slugs.
It renders the real generated MDX and article components; surrounding client
widgets are mocked. No built-Worker HTTP result is inferred from these tests.

Logs: `/private/tmp/ticket-249-r2-{build-script,fallback-script,prod-generate,build,integration}.log`.
The first two logs record blocked wrappers, not successful suite/build invocations.

### Worker size and clean-base delta

```sh
TMPDIR=/private/tmp WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=/private/tmp/ticket-249-r2-wrangler-logs pnpm --filter @app/web run worker:size:check
```

Exit 0; unchanged budget: warning 2500 KiB, hard limit 2800 KiB. Wrangler ran
`deploy --dry-run` and explicitly exited without deploying.

A fresh base archive was created entirely inside the ignored worktree directory:

```sh
mkdir -p _workspace/ticket-249-r2-base
git archive HEAD | tar -x -C _workspace/ticket-249-r2-base
TMPDIR=/private/tmp SEOJING_BACKEND_ARTICLE_SLUGS=study/effective-typescript/day5 SEOJING_BACKEND_ARTICLE_PREFIXES= node --import ./apps/web/node_modules/tsx/dist/loader.mjs _workspace/ticket-249-r2-base/apps/web/scripts/generate-content-tree.ts
cd _workspace/ticket-249-r2-base/apps/web
TMPDIR=/private/tmp WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=/private/tmp/ticket-249-r2-base-wrangler-logs SEOJING_BACKEND_ARTICLE_SLUGS=study/effective-typescript/day5 SEOJING_BACKEND_ARTICLE_PREFIXES= pnpm exec vinext build
TMPDIR=/private/tmp WRANGLER_SEND_METRICS=false WRANGLER_LOG_PATH=/private/tmp/ticket-249-r2-base-wrangler-logs pnpm run worker:size:check
```

The archive contains unchanged source at
`5e659493f08911dbc77b81372680e5c6aa111294`. Its `node_modules` directories were
symlinked to this worktree's already installed dependencies (root, apps/web,
packages/ui, packages/utils, packages/design-system, packages/config/eslint and
packages/config/typescript). No canonical checkout or backend checkout was used.
Base generation/build/size checks all exit 0; base generates 201 bundled articles.

| Artifact                | Raw upload (KiB) | Gzip upload (KiB) |
| ----------------------- | ---------------- | ----------------- |
| Clean base              | 10752.92         | **2034.50**       |
| Reviewed implementation | 10837.40         | **2043.44**       |
| Delta                   | +84.48           | **+8.94**         |

Logs: `/private/tmp/ticket-249-r2-worker-size.log` and
`/private/tmp/ticket-249-r2-base-{generate,build,worker-size}.log`.

### Scoped checks and TypeScript blocker

```sh
pnpm --filter @app/web exec eslint scripts/generate-content-tree.ts scripts/public-article-migration-registry.mjs scripts/public-article-migration-registry.d.mts scripts/content-fallback.integration.tsx scripts/check-public-blog-readback.test.mjs src/shared/content/backend-article.tsx src/shared/content/backend-article.test.tsx vitest.content-fallback.config.ts
pnpm exec prettier --check .github/workflows/ci.yml apps/web/package.json apps/web/scripts/generate-content-tree.ts apps/web/scripts/public-article-migration-registry.mjs apps/web/scripts/public-article-migration-registry.d.mts apps/web/scripts/check-public-blog-readback.test.mjs apps/web/scripts/content-fallback.integration.tsx apps/web/src/shared/content/backend-article.tsx apps/web/src/shared/content/backend-article.test.tsx apps/web/vitest.content-fallback.config.ts docs/ticket-249-day5-offline-fallback.md
git diff --check
pnpm --filter @app/web exec tsc --noEmit --incremental false
```

Scoped lint, formatting and diff checks exit 0. TypeScript exits 2 (pnpm filter
wrapper exits 1): **217 diagnostics**. The same check in the freshly built base
archive exits 2 with **216 diagnostics**. Both have the same 15 non-MDX errors;
current output has 202 missing compiled-JSX declarations versus 201 at base,
adding only Day 5's now-retained generated module. Existing failures include
missing `cloudflare:workers`/`Fetcher` types, component/attribute typing and tests.
No new typed-result, generator or test-specific error was introduced. The
repository-wide TypeScript setup remains an unresolved blocker.

Logs: `/private/tmp/ticket-249-r2-{lint,format,types,base-types}.log`.

### Local built-Worker HTTP and real-browser proof

After the sandboxed Codex review run ended, the host execution layer reran the
standard wrappers successfully, started a loopback API fixture on port 12590 and
the freshly built Worker on port 12591, and executed the five-mode proof:

```sh
pnpm build
pnpm --filter @app/web run worker:size:check
pnpm --filter @app/web run test:content-fallback
node /private/tmp/ticket-249-final-api.mjs
pnpm --filter @app/web exec wrangler dev --local --config dist/server/wrangler.json --ip 127.0.0.1 --port 12591 --inspector-port 12592 --var SEOJING_BACKEND_ARTICLE_API_ORIGIN:http://127.0.0.1:12590 --show-interactive-dev-session=false
node /private/tmp/ticket-249-final-http-proof.mjs
```

The standard build and dedicated test wrappers exit 0. The final size result is
2043.46 KiB gzip against the unchanged 2800 KiB hard limit. Built-Worker HTTP
results:

| API mode                             |                 Day 5 | Unknown slug | Elapsed |
| ------------------------------------ | --------------------: | -----------: | ------: |
| Cloudflare-style HTTP 530/Error 1033 |                   200 |          404 |   52 ms |
| Broken connection                    |                   200 |          404 |   31 ms |
| Never responds                       |                   200 |   not probed | 3049 ms |
| Healthy backend                      | 200, backend renderer |          404 |   26 ms |
| Authoritative 404                    |         404 + noindex |          404 |   18 ms |

Every outage response contained the canonical link, bundled article title,
`data-article-content`, code block, quiz, image and “먼저 보는 코드”, with no
backend-renderer marker. Healthy mode contained the backend marker and current
backend body. Authoritative 404 contained no article-content marker.

Google Chrome headless rendered the HTTP 530 fallback at 1440×1800 and captured
`_workspace/ticket-249-day5-530.png`. Visual inspection confirms the real article
page—not a loading/404/error page—with the expected title, metadata, section
content and styled TypeScript code blocks; no obvious layout regression appears
in the captured viewport.

Logs: `/private/tmp/ticket-249-final-{build,size,fallback,http-proof}.log` and
`/private/tmp/ticket-249-chrome.log`. The screenshot and baseline archives are
under ignored `_workspace/` paths and are not source changes.

## Risks, scope and rollback

- Bundled fallback content is the MDX snapshot at build time; healthy backend
  edits take precedence. An authoritative backend HTTP 404 always suppresses the
  fallback and preserves backend unpublishing/not-found semantics.
- A stalled opted-in backend read waits up to three seconds before fallback.
  CMS-native/backend-only routes keep their existing behavior.
- The strict deployed readback gate continues to require a healthy backend and
  backend renderer marker. An outage can fail that gate while Day 5 stays readable.
- The standard pnpm build/integration wrappers, built-Worker HTTP proof and
  Chrome render pass on the host execution layer. Full TypeScript validation
  remains blocked by the documented baseline diagnostics.
- Verification used Node 24; CI specifies Node 22 and was not run remotely.
- No commits, staging, pushes, PRs, deployment, external writes, or changes to the
  canonical frontend/backend checkouts. HEAD and the branch are unchanged.
- Rollback: remove Day 5's registry fallback opt-in and rebuild to restore the
  previous backend-only availability behavior; or revert only this patch's files
  to the stated base and remove its new files for a complete rollback.

Proposed commit message: `fix: preserve Day 5 through backend outages without masking 404s`.
