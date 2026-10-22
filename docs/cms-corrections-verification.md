# CMS corrections and retirement gate

Implementation base: `aaecab116a56d73eb2212716244e76c65cfcb6ca`. Backend companion base: `8f05dbbbf988e72c1992e1bcdb7f7b45fe3728b9`.

## Behavior

- `formatDateOnly` in `@app/utils` uses `ko-KR` and `Asia/Seoul`. ISO calendar dates retain their date; timestamps must include an offset. Invalid dates and offset-less datetimes display an em dash. Header, carousel, cover cards and ops list share it. Tests include leap days, Seoul midnight, year rollover and multiple host time zones.
- Ops checkboxes select individual articles. The header checkbox applies to the current page (20 items), including its mixed state. The separately labelled filter-wide action selects all matching IDs. Category, status, format and title/slug/category search intersect. Changing a filter or page clears selection. Filters/navigation are disabled during mutations. Both visibility actions confirm the exact count; unpublishing explicitly warns that public pages disappear.
- The browser sends explicit slugs in batches of at most 20 with its current filter scope. The proxy authenticates through the existing Access boundary and sends the existing server-only bearer credential to the backend. Empty/duplicate/oversized IDs and invalid scopes fail before writes. Backend scope checks and conditional `updatedAt` writes reject concurrent changes. There is no all-or-nothing transaction across a batch or across PostgreSQL and D1.
- Every item returns its own outcome. Publication commits a PostgreSQL revision then writes its public JSON to D1. A D1 failure reports a partial publication and a reconciliation retry. Unpublishing removes D1 before changing the backend. A definite rejection reconciles from authenticated backend state; an uncertain timeout leaves D1 absent and requires an explicit retry, never blindly restoring an old snapshot. The public backend fallback remains in place. Backend-only API callers must coordinate their own edge snapshot synchronization; ops callers use the proxy.
- Editor preview and public articles share `ArticleLayout`, `Paper`, article header, media and the actual document/block renderer. Preview is outside the editor form padding and uses the same site content width. Code and tables retain shared overflow/components; quizzes remain interactive. The saved editor payload includes an explicit `preview` projected by backend `toPublicArticleDetail`, including the public block/HTML sanitizer. Unsaved edits use authenticated, read-only `POST /admin/articles/preview` through the ops proxy (512 KiB maximum); only server-projected content reaches the renderer. Requests debounce by 300 ms, stale responses are discarded, and missing/failed previews never fall back to raw editor blocks. Per-block raw previews were removed. `ArticleContentView` and the pure public content adapter supply identical frontmatter, canonical source and reading time in both flows. Tests render the actual public page and ops editor, and compare hostile saved HTML against the real public API projection. Desktop/mobile visual parity remains an unexecuted gate.
- CMS content trees and explorer rows carry semantic `kind: "article"`; it selects the blue article icon independently of storage format/extension. Folder behavior remains separate.

## Restored Giscus identity

Source of truth: parent of `5eb1ad98e99bd44cab279334d6e65b24e6724a8e` (PR #61; merge `88e2bd8`). Restored `@giscus/react` 3.1.0 and the original repo/category configuration:

- repository `seoJing/SEOJing`, node ID `R_kgDORmQykw`
- category `Announcements`, ID `DIC_kwDORmQyk84C4cEF`
- mapping `specific`, term = canonical article slug without `/blog/`, strict `0`
- Korean language; light/dark follows the site; reactions enabled; input at top

The public article toolbar opens the prior comments modal. Lazy import and iframe loading happen only after activation. Modal labelling, Escape, focus containment and focus restoration are tested. The official Giscus web component removes its message listener on disconnect. No custom comment tracker, Q&A comment event bridge, metadata tracking or analytics callbacks were restored (`emitMetadata=0`). A GitHub Discussions link remains available.

A read-only GitHub API lookup on 2026-10-22 confirmed the repository is public, has Discussions enabled and has the same node ID. The live category and Giscus installation could not be validated from this environment; this is not a full live compatibility pass.

## Verification boundary on 2026-10-22

Operational evidence is outside the repositories at `/Users/seojing/.openclaw/workspace/seojing-cms-mdx-evidence-20261022`; the ledger is `/Users/seojing/.openclaw/workspace/.task-worklog-seojing-cms-mdx.md`.

The sandbox rejects local TCP listening (`EPERM`), PostgreSQL shared-memory initialization (`shmget: Operation not permitted`) and Chromium startup. Computer-use inventory has no browser; IAB is unavailable and native Chrome access is not approved. Consequently there are no desktop/mobile screenshots, full-stack local readback results or real PostgreSQL/D1 integration results. Unit/API tests and builds do not substitute for those gates.

The real PostgreSQL bulk test in the backend is opt-in and refuses any database that is not loopback with a `cms_test_*` name. It covers publication, scoped rejection, injected SQL rollback and unpublication. It remains unexecuted here.

## MDX gate remains closed

Do not treat this change as MDX retirement. The 201 blog sources plus `resume.mdx`, reconstruction assets, conversion tooling and manifests remain. No archive was created, no MDX source was removed and no database data was changed. Only after independent correction review ACCEPT and all five correction gates pass, create and verify the protected timestamped archive under `/Users/seojing/Archives` before removing active MDX artifacts. Archive readability, member count/size, checksums, privacy scan and reconstruction provenance are mandatory. Retirement tests must then fail closed on active MDX runtime/build/authoring dependencies and verify canonical CMS/D1 routes, search, sitemap, RSS and llms.

Do not delete production `sourceText` or revisions. Their later destructive retention decision needs a separate owner decision. Preserve existing PostgreSQL backups and the backend `docs/postgres-backup-restore.md` procedure; eventual retirement rollback must additionally name the verified external archive. No push, PR, merge, deployment or production DB operation is part of this work.
