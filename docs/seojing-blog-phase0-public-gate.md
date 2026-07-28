# SEOJing Blog Phase 0: public verification and rollback gate

Phase 0 exists to keep the public blog readable while later phases move article data to the backend, split the design system, and add data/AI features.

## Priority position

This is the first phase in the current blog roadmap:

```text
0 검증/롤백
1 article API/DB
2 design-system
5 admin/editor
8 analytics/improvement data
11 SEO/deploy/perf ops
6 search/RAG
7 comments/questions
3 Q&A chatbot
4 TTS
9 visual pipeline
10 presentation/video
```

The rule is simple: public article rendering is the product surface. Code, CI, and deploy success are not enough unless public readback proves the article still renders the expected body, metadata, and component UI.

## What Phase 0 adds

### 1. Public readback script

```bash
pnpm --filter @app/web run public:readback
```

Implementation:

```text
apps/web/scripts/check-public-blog-readback.mjs
```

Default origin:

```text
https://seojing.com
```

The script retries because Cloudflare deploy/readback can lag briefly after Wrangler reports success.

Useful overrides:

```bash
PUBLIC_READBACK_ORIGIN=https://seojing.tjwlsrb1021.workers.dev \
PUBLIC_READBACK_RETRIES=3 \
PUBLIC_READBACK_DELAY_MS=2000 \
pnpm --filter @app/web run public:readback
```

or:

```bash
pnpm --filter @app/web run public:readback -- --origin http://127.0.0.1:8787 --retries 1
```

### 2. Deploy gate

The GitHub Actions deploy job now runs public readback after Wrangler deploy:

```yaml
- name: Verify public blog readback
  run: pnpm --filter @app/web run public:readback
```

This turns obvious public regressions into failed deploy workflows instead of relying on manual inspection after the fact.

## Current sentinel routes

### Legacy JSX-heavy study post

```text
/blog/study/clab-26-1/week1
```

This route caught the backend article migration regression where broad `SEOJING_BACKEND_ARTICLE_PREFIXES=study` made the public page lose original MDX sections and component UI.

Required public evidence:

- original date `2026년 3월 23일`;
- tag text such as `프론트엔드`, `웹접근성`;
- body phrases:
  - `데이터 요금을 아껴주는`
  - `article과 section`
  - `스터디 인증 미션`
- image captions:
  - `og 태그 작업 이전`
  - `og 태그 작업 이후`

Forbidden public evidence:

- `data-backend-article-blocks`
- `data-backend-article-html`
- `ArticleImage fallback`
- `component omitted`
- wrong backend-publish date `2026년 6월 28일`

### Current study post

```text
/blog/study/javascript-quizbook/day10
```

This keeps the newer study lane in the readback set too, so Phase 0 does not only protect legacy CLAB articles.

Required public evidence includes the title, function-boundary content, diagram text, quiz marker, and high-level topic words. Backend fallback markers are forbidden.

## Rollback posture

If a later phase breaks public rendering:

1. First restore the public article surface, usually by removing broad backend article routing or reverting the specific public-surface commit.
2. Keep backend/design-system/admin work behind slug-level or feature-level opt-in until parity is proven.
3. Verify with:

```bash
pnpm build
pnpm --filter @app/web run worker:size:check
pnpm --filter @app/web run public:readback
```

4. After deploy, run canonical public readback again and attach screenshot/browser evidence when reporting to 진규.

## Future extensions

Add more sentinel routes as phases touch more surfaces:

- backend-backed article parity route once slug-level migration is reintroduced;
- code-heavy article with tables/code blocks;
- article with cover/inline diagrams;
- article with Q&A/TTS once those become public-working;
- `/blog`, sitemap, RSS, and canonical metadata probes under Phase 11.

Do not broaden backend article routing again with `SEOJING_BACKEND_ARTICLE_PREFIXES=study` until the sentinel set proves legacy JSX-heavy posts, current study posts, and backend-backed slug opt-ins all pass.
