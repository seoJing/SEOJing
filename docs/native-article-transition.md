# Backend-native article transition

The backend `ArticleRevision.document` JSON is the editing source of truth. The public Worker serves a published-document snapshot from the existing `ANALYTICS_DB` D1 binding; it does not compile or load post MDX at build or request time. Cloudflare Access authenticates `/ops`, and the Worker uses its backend admin token server-side. No password account is added to the backend.

```text
/ops rich editor → Access-verified Worker → backend draft revision (JSON)
publish → backend public readback → D1 public_articles snapshot
reader/search/sitemap/RSS → D1 snapshot (backend API fallback on a missing row)
```

## Cutover gates

These steps change production visibility or configuration and require the repository's fresh publication authority. **None has been run against production.** Keep the previous Worker artifact and original MDX corpus through the rollback window. Use the backend worktree/repository containing `20261007150000_article_document_source` and the web repository containing `0002_public_articles.sql`.

1. Review the 201-entry manifest and source hashes. Take a fresh, restorable custom-format PostgreSQL backup of the exact target DB. Run `prisma migrate deploy` against that DB and confirm the new migration applied.
2. Run `scripts/convert-mdx-articles-to-documents.ts --apply --content-root <web>/apps/web/content --manifest <reviewed-manifest> --backup-file <fresh-pg-dump>`. It preflights every slug/hash before writing, makes one private JSON revision per article, and does not change public visibility. Verify 201 converted latest revisions. A source mismatch other than one missing terminal newline aborts.
3. Deploy the backend API with the protected `migration-snapshot` endpoint. Apply `apps/web/migrations/0002_public_articles.sql` to **remote** D1 via `wrangler d1 migrations apply ANALYTICS_DB --remote` from `apps/web`. This creates a new table in the already-bound D1 database; it does not clear analytics rows.
4. With backend origin and admin token in the local environment, run `node apps/web/scripts/prepare-public-article-snapshots.mjs --plan --source staged --manifest <reviewed-manifest>`. It must report 201 documents. Then run `--write --source staged --manifest <reviewed-manifest> --output-dir <new-private-temp-dir>`. The 21 SQL chunks contain **public article data** but should still be stored privately until applied. Apply each chunk using `wrangler d1 execute ANALYTICS_DB --remote --file <chunk>`; confirm exactly 201 rows and sample nested slugs before deploying the new Worker. The export validates each converted source hash against the manifest and stops before writing if one differs.
5. Deploy the frontend Worker. Verify `/blog`, representative nested posts, search, sitemap, RSS, and one CMS edit. At this point the old site had already published the same 201 articles, while D1 serves their converted JSON documents. The backend's 201 latest revisions may still be private; that temporary state is intentional during cutover.
6. Take another fresh backend backup, then run `scripts/convert-mdx-articles-to-documents.ts --publish` with the same content root and manifest. It verifies all 201 latest document hashes before changing visibility and is idempotent. Re-export with `--source public` and upsert the resulting SQL chunks into D1 to reconcile publication metadata. Confirm 201 backend published documents, 201 D1 rows, exact slug sets, and representative page/metadata parity.

If a stage fails, stop there and preserve its logs and backups. The old Worker continues to serve its bundled posts until step 5. Before step 6, reverting the Worker leaves the original backend public revisions intact for the four pre-existing backend-published posts. After step 6, retain the original MDX revisions and database backups until readback and visual parity are accepted; do not delete source files as part of this rollout.

After the rollback window and visual parity sign-off, archive the original MDX corpus and retire the migration-only converter, old MDX API/editing branches, and MDX-oriented asset scripts in a separate cleanup. None of those sources is required by the new post build or public read path.

## Local evidence (2026-10-07)

- 201/201 corpus files structurally converted; one DB/file hash difference was only a missing terminal newline.
- A disposable copy of the existing PostgreSQL database migrated, converted 201 private revisions, and separately rehearsed publication of 201 documents. The source database was untouched.
- A staged export of all 201 private converted revisions produced 21 SQL chunks (4,542,617 bytes; largest statement 81,290 bytes). A local D1 chunk-format smoke test inserted, read, and removed an article with an apostrophe in its title.
- Local Worker HTTP readback showed a D1 article in the index, detail page, sitemap, and RSS. The smoke row was deleted. Browser navigation to `localhost` was blocked by OpenClaw browser policy, so interactive and visual parity remain unverified.
- Independent read-only review found no blocker and identified editor-input validation, public index query cost, and revision publication issues; those were corrected and covered by tests. The six DB integration tests passed against a second disposable copy of the local PostgreSQL database after the fixes.
- The web formatting, lint, coverage (346 tests; 80% branch coverage), editor smoke, build, public readback tests, and Worker size gates passed. The backend typecheck, lint, unit tests (307 passed, six DB tests skipped in the default run), build, and changed-file formatting checks passed. The repository-wide backend formatting command still flags five unchanged JSON fixtures. An optional web-wide `tsc --noEmit` check remains red on pre-existing generated MDX artifacts and unrelated test/design-system types; the changed routes, editor, and store had no diagnostics in that check.
