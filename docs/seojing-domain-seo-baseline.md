# SEOJing 도메인/배포 구조 및 SEO 기반 정리

작성일: 2026-06-08
관련 티켓: local #41 / kanban t_5d0b3bfc, local #49 / kanban t_09983f91

## 1. 결론

우선 구조는 `Cloudflare 공개 프론트 + Mac mini 동적 백엔드` 하이브리드로 간다.

- 공개 읽기 경로는 계속 Cloudflare Worker/Assets에 둔다.
- Mac mini는 검색/추천/RAG/TTS/analytics/admin처럼 상태, 모델, 개인 데이터, 장기 작업이 필요한 기능만 맡는다.
- 프론트에서 Mac mini를 직접 노출하지 않고 `api.seojing...` 같은 API 서브도메인 또는 Cloudflare Worker 프록시를 둔다.
- SEO 색인은 정적 프론트에서 완결되어야 한다. 즉 sitemap, robots, RSS/Atom, canonical, 글별 metadata/OG/JSON-LD는 Mac mini 없이도 응답되어야 한다.

이 구조가 맞는 이유:

1. SEOJing의 핵심 자산은 MDX 글 131개이며 공개 크롤링/공유 성능이 중요하다.
2. 현재 Cloudflare 배포는 전 세계 캐시/HTTPS/Workers 도메인이 이미 동작한다.
3. Mac mini 기능은 동적이지만 장애가 나도 공개 글 읽기와 색인은 살아 있어야 한다.
4. RAG/TTS/analytics는 크롤러가 반드시 호출해야 하는 경로가 아니므로 공개 프론트와 장애 도메인을 분리할 수 있다.

## 2. 현재 상태 조사

### Repo / 배포

- repo path: `/Users/seojing/.hermes/workspace/projects/SEOJing`
- 현재 브랜치: `docs/okayjing-posts-reading-guide`
- monorepo 스크립트:
  - root `pnpm build` → `turbo build`
  - web `pnpm run generate:content && vinext build`
- Cloudflare Worker 설정: `apps/web/wrangler.jsonc`
  - worker name: `seojing`
  - main: `./worker/index.ts`
  - assets binding: `ASSETS`
  - images binding: `IMAGES`
  - compatibility flag: `nodejs_compat`
- Worker entry: `apps/web/worker/index.ts`
  - `/_vinext/image`만 Cloudflare Images 최적화로 처리
  - 나머지는 `vinext/server/app-router-entry`로 위임

### 콘텐츠/라우팅

- MDX 콘텐츠: `apps/web/content/**/*.mdx` 131개
- build 전 생성 스크립트: `apps/web/scripts/generate-content-tree.ts`
  - `content-tree.json`
  - 글별 `{slug}.json`
  - 글별 `{slug}.compiled.jsx`
  - `content-loader.ts`
- 라우팅:
  - `/` → `apps/web/src/app/page.tsx`
  - `/blog` → `apps/web/src/app/blog/page.tsx`
  - `/blog/[...slug]` → `apps/web/src/app/blog/[...slug]/page.tsx`
- 폴더 slug는 탐색 UI로 렌더링하고, leaf slug는 MDX 글로 렌더링한다.

### 현재 공개 URL 응답 확인

명령 근거:

```bash
curl -I https://seojing.tjwlsrb1021.workers.dev/
curl -I https://seojing.tjwlsrb1021.workers.dev/blog
curl -I https://seojing.tjwlsrb1021.workers.dev/sitemap.xml
curl -I https://seojing.tjwlsrb1021.workers.dev/robots.txt
curl -I https://seojing.tjwlsrb1021.workers.dev/rss.xml
```

확인 결과:

- `/` 200
- `/blog` 200
- `/sitemap.xml` 404
- `/robots.txt` 404
- `/rss.xml` 404

2026-06-08 local #49 재확인 결과:

- `/` 200
- `/blog` 200
- `/blog/okayJing/reading-guide` 200
- `/sitemap.xml` 404
- `/robots.txt` 200, 단 Cloudflare/사이트 기본 content-signal 설명문만 응답하고 `User-agent`, `Allow`, `Sitemap` 지시문은 없음
- `/rss.xml` 404
- 글 페이지 HTML snippet: `<title>SEOJing</title>`, 전역 description/OG 유지, canonical 없음, JSON-LD 없음

DNS 확인:

- `seojing.tjwlsrb1021.workers.dev` → Cloudflare IP 응답
- `seojing.com` → Cloudflare edge 응답 및 HTTPS 200 확인
- `www.seojing.com` → 현재 이 환경의 DNS 조회에서 응답 없음

### 현재 metadata/OG 상태

`apps/web/src/app/layout.tsx`에 전역 metadata가 있다.

- title: `SEOJing`
- description: `SEOJing's 프론트엔드 개발 블로그 플랫폼`
- metadataBase: `https://seojing.tjwlsrb1021.workers.dev`
- openGraph: site-level title/description/url/logo
- twitter: summary card/logo

공개 HTML 확인 결과:

- `/`, `/blog`, `/blog/okayJing/reading-guide` 모두 `<title>SEOJing</title>`로 동일
- meta description도 전역 설명으로 동일
- og:title/description/url도 site-level 값으로 동일
- canonical 없음
- JSON-LD 없음

즉 글별 색인 신호가 아직 약하다. 검색엔진과 AI answer engine 입장에서는 모든 글이 같은 제목/설명/OG를 가진 페이지처럼 보일 수 있다.

## 3. 권장 도메인/배포 구조

### 3.1 공개 도메인

최종 권장:

- canonical site: `https://seojing.com`으로 전환
- `workers.dev`는 배포 확인/백업 URL로 유지하고 검색 canonical은 custom domain으로 고정
  - canonical: `https://seojing.com`
- 나머지 도메인은 301 redirect 또는 canonical로 통일

작업 원칙:

- canonical URL은 `layout.tsx`, sitemap, RSS, JSON-LD, OG url이 모두 같은 값을 사용해야 한다.
- 도메인 변경은 SEO 기반 구현 후 별도 확인을 거쳐 진행한다.
- workers.dev는 배포 확인/백업 URL로 남길 수 있지만, custom domain을 붙인 뒤에는 검색 canonical을 custom domain으로 맞춘다.

### 3.2 Cloudflare 프론트

역할:

- 정적/SSR 프론트 렌더링
- MDX 글 제공
- sitemap/robots/rss/llms.txt 제공
- OG 이미지, 정적 이미지, 글 목록 JSON 제공
- Mac mini API 호출의 공개 프록시 또는 BFF 역할 일부

유지해야 하는 성질:

- Mac mini 장애와 무관하게 `/`, `/blog`, `/blog/**`, `/sitemap.xml`, `/robots.txt`, `/rss.xml`은 정상 응답
- 검색 크롤러가 필요한 정보는 Cloudflare 단독으로 제공

### 3.3 Mac mini 백엔드

역할:

- privacy-safe analytics event 수집
- 관리자/대시보드 API
- RAG indexing/query API
- TTS 생성/캐시/재생 메타데이터 API
- 장기 작업 큐, 로컬 모델, 로컬 DB

권장 노출 방식:

1. Cloudflare Worker/프론트 → Mac mini backend로 서버 간 요청
2. 외부 공개 API가 필요하면 `api.<canonical-domain>`을 Cloudflare Access/Tunnel/Worker 앞단에 둔다.
3. 브라우저가 직접 Mac mini LAN/동적 포트를 호출하지 않는다.

필수 보안/운영 조건:

- public read API와 admin API 분리
- admin은 Cloudflare Access 또는 강한 인증 뒤에 둔다.
- analytics는 IP/UA 원문 저장을 피하고, 최소 이벤트/익명 세션/짧은 retention으로 설계한다.
- RAG/TTS는 비용/동시성 제한과 캐시 키 정책이 필요하다.

## 4. SEO/GEO/AEO 우선 체크리스트

우선순위 P0/P1은 다음 티켓들이 시작되기 전에 먼저 끝내는 게 좋다.

### P0: 색인 가능성 회복

- [ ] `/robots.txt` 제공
  - `User-agent: *`
  - `Allow: /`
  - `Sitemap: <canonical-origin>/sitemap.xml`
- [ ] `/sitemap.xml` 제공
  - `/`, `/blog`, `/blog/**` leaf 글 URL 포함
  - `lastmod`는 frontmatter date 또는 파일 mtime 중 하나로 일관
  - folder explorer 페이지를 포함할지 별도 결정. 우선 leaf 글 중심 권장.
- [ ] `/rss.xml` 또는 `/feed.xml` 제공
  - 최신 글 제목/URL/date/description 포함
  - RSS discoverability를 위해 `<link rel="alternate" type="application/rss+xml">` 추가
- [ ] canonical URL 추가
  - root/blog/folder/post 모두 자기 canonical
  - query/hash 제외
- [ ] 글별 `generateMetadata` 또는 동등한 vinext metadata 구현
  - title: 글 frontmatter title
  - description: frontmatter description이 없으면 첫 문단/요약 fallback
  - og:url: canonical post URL
  - og:type: `article`
  - article published_time/tag 가능하면 추가

### P1: 공유/AI 답변 엔진 품질

- [ ] frontmatter schema 정리
  - 필수: title, date, tags
  - 권장 추가: description, updated, category, series, order
- [ ] JSON-LD 추가
  - BlogPosting for posts
  - WebSite/SearchAction for site
  - BreadcrumbList for `/blog/...`
- [ ] `llms.txt` 추가
  - 사이트 주제, 주요 카테고리, 대표 글, RSS/sitemap 링크
- [ ] 글 본문 구조 점검
  - H1은 ArticleHeader가 담당하므로 MDX 내부 H1 중복 방지
  - H2/H3 계층 유지
  - 코드블록 언어명 지정
  - 이미지 alt 필수
- [ ] OG 이미지 전략
  - 우선 site logo fallback
  - 이후 글별 동적 OG 또는 카테고리별 OG 템플릿

### P2: 성능/운영

- [ ] HTML caching 정책 검토
- [ ] content-hashed assets는 현재 `_headers`에서 immutable cache 적용됨
- [ ] 이미지 파일명/alt/크기 워크플로우 개선
- [ ] Search Console/Bing Webmaster 제출 절차 문서화
- [ ] analytics 이벤트는 SEO에 필요한 서버 로그와 사용자 학습 analytics를 분리

## 5. 구현 단위

이미 만들어진 후속 kanban 작업과 연결해서 아래 순서로 진행한다.

### 단위 A: SEO foundation routes

대상 파일 후보:

- `apps/web/src/app/robots.txt/route.ts` 또는 vinext에서 지원되는 route handler 위치
- `apps/web/src/app/sitemap.xml/route.ts`
- `apps/web/src/app/rss.xml/route.ts`
- `apps/web/src/shared/config/site.ts`

수용 기준:

- `/robots.txt` 200
- `/sitemap.xml` 200, 131개 leaf 글 중 공개 글이 포함됨
- `/rss.xml` 200, 최신 글 목록 포함
- canonical origin이 한 곳의 config에서 파생됨

### 단위 B: post metadata/canonical

대상 파일 후보:

- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/blog/layout.tsx`
- `apps/web/src/app/blog/[...slug]/page.tsx`
- `apps/web/src/shared/config/index.ts`

수용 기준:

- 글 페이지 title/description/OG가 글별 값으로 달라짐
- canonical link가 존재함
- folder page와 post page metadata가 구분됨
- 기존 MDX 렌더링이 깨지지 않음

### 단위 C: structured data / AEO

대상 파일 후보:

- `apps/web/src/widgets/mdx-renderer` 또는 article page 주변
- `apps/web/src/shared/seo/*`

수용 기준:

- BlogPosting JSON-LD 생성
- BreadcrumbList JSON-LD 생성
- WebSite JSON-LD 생성
- 글 URL, 제목, 날짜, 태그가 frontmatter에서 일관되게 들어감

### 단위 D: Mac mini backend boundary

연결 티켓:

- #42 analytics dashboard MVP
- #43 post context Q&A/RAG MVP
- #45 TTS learning mode

수용 기준:

- Cloudflare 프론트에서 호출할 API contract가 먼저 문서화됨
- API origin/env var를 `PUBLIC_*`와 server-only로 분리
- Mac mini 장애 시 글 읽기/색인 영향 없음
- analytics/RAG/TTS가 모두 같은 event/user/session model을 공유할 수 있음

### 단위 E: image/asset workflow

연결 티켓:

- #44 image/asset insertion workflow

수용 기준:

- MDX 이미지 경로 규칙 확정
- 파일명 slug 규칙 확정
- alt text lint/check 추가
- OG 이미지 fallback과 충돌하지 않음

### 단위 F: presentation/PPTX SEO 영향 분리

연결 티켓:

- #46 presentation mode / PPTX spike

수용 기준:

- 발표 모드는 canonical post와 별도 UX로 제공
- 발표 전용 route가 검색에 노출될지 결정
- 중복 콘텐츠면 `noindex` 또는 canonical 원문 지정

## 6. 추천 진행 순서

1. SEO foundation routes: robots/sitemap/rss/site config
2. 글별 metadata/canonical
3. JSON-LD/llms.txt/AEO
4. #42 analytics event schema/API boundary
5. #43 RAG API/UI
6. #45 TTS mode
7. #44 image workflow
8. #46 presentation/PPTX

이 순서가 좋은 이유는 4~8번 동적 기능이 생겨도 canonical URL, sitemap, article metadata, event naming을 다시 갈아엎지 않아도 되기 때문이다.

## 7. 검증 명령

구현 티켓에서 최소 다음을 확인한다.

```bash
pnpm --filter @app/web run generate:content
pnpm --filter @app/web run lint
pnpm --filter @app/web run build

curl -I <origin>/robots.txt
curl -I <origin>/sitemap.xml
curl -I <origin>/rss.xml
curl -s <origin>/sitemap.xml | grep '<loc>' | head
curl -s <post-url> | grep -E '<title>|canonical|og:title|application/ld\\+json'
```

배포 전에는 custom domain/canonical 변경 여부를 별도 확인한다.

## 8. 이번 조사에서 확인한 리스크

- sitemap/rss가 현재 404이고, robots가 크롤러용 sitemap 진입점을 제공하지 않아 검색엔진 기본 진입점이 부족하다.
  - #49 재확인 기준 `/robots.txt`는 200이지만 `User-agent`, `Allow`, `Sitemap` 지시문이 없는 content-signal 설명문만 반환한다. 따라서 실질적인 robots/sitemap discoverability 리스크는 계속 남아 있다.
- 모든 페이지가 site-level title/description/OG를 공유해 글별 검색/공유 품질이 낮다.
- canonical이 없어 workers.dev와 custom domain을 병행할 때 중복 URL 문제가 생길 수 있다.
- Mac mini 동적 기능을 먼저 붙이면 API URL과 canonical/site URL 경계가 흐려질 수 있다.
- 현재 브랜치가 문서/가이드 작업 브랜치이므로 실제 SEO 구현 전에는 브랜치/PR 범위를 정리해야 한다.
