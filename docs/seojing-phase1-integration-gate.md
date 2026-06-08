# SEOJing Phase 1 통합 게이트

작성일: 2026-06-08
관련 티켓: local #53 / kanban t_6f48d19c
입력 산출물:

- local #50 / kanban t_ac638550: `docs/seojing-cloudflare-macmini-backend-adr.md`
- local #51 / kanban t_a0d71f6d: SEO/GEO/AEO quick wins 구현 및 CodeRabbit follow-up
- local #52 / kanban t_4dfc7b52: `spikes/001-macmini-backend-boundary/`

## 1. Gate verdict

Phase 1은 다음 조건으로 통과한다.

- 공개 읽기/검색 표면은 Cloudflare Worker와 canonical `https://seojing.com`에 고정한다.
- Mac mini는 analytics/RAG/TTS/admin 같은 동적 API만 맡고, 글 HTML/metadata/sitemap/rss/llms.txt 생성의 hard dependency가 되지 않는다.
- Phase 2 이후 기능은 먼저 이벤트/콘텐츠/API contract를 문서화한 뒤 구현한다.
- admin/raw Mac mini origin은 public browser에 직접 노출하지 않는다.
- 현재 `www.seojing.com` DNS 미설정, 실제 Tunnel/Access/secret 값 미확정, rate limit/queue/observability 미구현은 보류 리스크로 남긴다.

즉 Phase 2+는 진행 가능하지만, 모든 후속 티켓은 아래 기준을 acceptance criteria로 가져가야 한다.

## 2. 통합된 기준

### 2.1 Public SEO surface

기준:

- canonical site origin은 `https://seojing.com` 하나로 둔다.
- `workers.dev`는 배포 확인/백업 URL로 유지하되 검색 canonical은 custom domain으로 통일한다.
- `/`, `/blog`, `/blog/**`, `/robots.txt`, `/sitemap.xml`, `/rss.xml`, `/llms.txt`는 Mac mini 장애와 무관하게 Cloudflare에서 응답해야 한다.
- metadata, canonical, OG, JSON-LD, RSS, sitemap, llms.txt URL은 shared site config에서 파생해야 한다.

이미 완료된 근거:

- #51에서 siteConfig 기반 canonical origin 통일, robots/sitemap/rss/llms.txt, post metadata/OG/canonical, WebSite/BlogPosting/Breadcrumb JSON-LD를 구현했다.
- #51 CodeRabbit follow-up에서 description fallback, RSS fallback, JSON-LD/metadata 정합성, wrangler custom-domain 설정, spike ESLint/globals, smoke cleanup을 보정했다.

후속 티켓에서 금지:

- 기능별 API origin을 canonical URL, sitemap, RSS, JSON-LD, OG URL에 섞지 않는다.
- Mac mini API 응답을 기다려야만 article page SSR/SEO metadata가 완성되는 구조를 만들지 않는다.

### 2.2 Cloudflare ↔ Mac mini API boundary

기준:

- browser가 Mac mini raw LAN host, dynamic port, tunnel origin을 직접 알면 안 된다.
- 공개 동적 API는 Worker BFF/proxy 또는 `api.seojing.com` 같은 Cloudflare 앞단을 통과해야 한다.
- Worker/server-only secret으로 `MACMINI_API_ORIGIN`, proxy token, admin token을 관리한다.
- public API allowlist는 최소 경로만 연다.
- API 실패는 widget/API degraded response로 격리하고 글 읽기/색인에는 영향이 없어야 한다.

이미 완료된 근거:

- #50 ADR이 Cloudflare public front + Mac mini dynamic API 분리, TLS/Tunnel/proxy/env 경계를 Accepted로 정했다.
- #52 spike가 `/api/analytics/events`, `/api/rag/query`, `/api/tts/jobs` allowlist, proxy token 주입, CORS allowlist, request id 전달, upstream degraded 502, admin 비노출을 local smoke test 8개로 검증했다.

후속 티켓에서 금지:

- `/admin/*`을 public Worker proxy에 라우팅하지 않는다.
- `PUBLIC_*` env에 secret, token, raw origin, internal port를 넣지 않는다.
- `Access-Control-Allow-Origin: *`와 credentials를 같이 쓰지 않는다.

### 2.3 Privacy and analytics model

기준:

- analytics는 원문 IP/UA 저장을 피하고, 최소 이벤트/익명 세션/짧은 retention으로 시작한다.
- event model은 analytics, RAG, TTS, presentation 기능이 공유할 수 있게 `session_id`, `content_slug`, `event_type`, optional `section_id`를 중심으로 잡는다.
- Phase 2 완료 후속 기준은 `docs/seojing-phase2-analytics-gate.md`의 `seojing.analytics.v1` contract를 따른다.
- 이벤트 수집 경로와 admin dashboard 경로는 인증/노출 정책을 분리한다.

Phase 2 첫 티켓 #54의 gate acceptance:

- 조회, 스크롤, 섹션 체류, 코드 복사, 목차, TTS, 프레젠테이션, Q&A 이벤트 taxonomy를 하나의 버전 문서로 정의한다.
- raw IP/UA 저장 여부, retention, 익명 session id 생성/회전, opt-out 또는 최소 수집 정책을 명시한다.
- public collect endpoint와 admin dashboard endpoint를 분리한다.
- RAG/TTS가 나중에 같은 content/session model을 재사용할 수 있음을 예시 event payload로 보여준다.

## 3. Phase 2+ 티켓별 구현 기준

### #54 B1 분석 이벤트 taxonomy/privacy 설계

진행 가능.

Acceptance criteria:

- privacy-safe event schema 문서가 먼저 생긴다.
- browser event payload에는 raw IP/UA/secret이 없다.
- `content_slug`, `section_id`, `event_type`, `session_id`, `occurred_at`, `client_context`의 최소/허용 필드를 분리한다.
- dashboard/admin 조회 API는 public collect와 분리한다.

주의:

- analytics를 먼저 붙이더라도 SEO metadata나 article SSR에 의존시키지 않는다.

### #59 C1 MDX chunk/index pipeline

진행 가능.

Acceptance criteria:

- MDX heading 단위 chunk id가 canonical blog slug와 안정적으로 연결된다.
- chunk/index 산출물은 공개 static index와 private RAG index를 분리할 수 있게 설계한다.
- 검색/RAG API가 실패해도 `/blog/**` 렌더링은 정상이어야 한다.
- chunk id는 analytics `section_id`, presentation outline, TTS section artifact와 공유 가능해야 한다.

주의:

- private RAG embedding/index를 Cloudflare public asset에 그대로 노출하지 않는다.
- frontmatter description fallback과 충돌하지 않게 본문 추출 규칙을 맞춘다.

### #63 D1 이미지 asset 저장/파일명/경로 규칙

진행 가능.

Acceptance criteria:

- MDX 이미지 public path, 파일명 slug, alt/caption/frontmatter 규칙을 확정한다.
- sitemap/RSS/OG 이미지 fallback과 충돌하지 않는다.
- 이미지 alt 누락을 lint/check 가능한 형태로 만든다.
- 기존 Cloudflare Images `/_vinext/image` 처리와 정적 asset 경로를 구분한다.

주의:

- 이미지 워크플로우는 canonical post URL을 바꾸면 안 된다.

### #66 E1 TTS artifact spec/generator

조건부 진행 가능.

Acceptance criteria:

- TTS는 long-running request가 아니라 artifact/job/cache 모델로 설계한다.
- 2분 요약, 5분 핵심, 섹션별 오디오 artifact가 canonical slug와 chunk/section id에 연결된다.
- TTS 생성 실패 시 article page는 정상 렌더링하고 widget만 degraded 상태가 된다.
- API token, generation queue, cache path는 server-only로 관리한다.

보류/선행 필요:

- #54 event/session model과 #59 chunk/section id가 정해진 뒤 artifact key를 확정하는 편이 안전하다.

### #69 F1 MDX heading 기반 slide outline 추출

진행 가능.

Acceptance criteria:

- slide outline은 MDX heading/code/image 구조에서 파생하고 canonical post를 변경하지 않는다.
- presentation route가 생길 경우 검색 노출 정책을 별도로 결정한다.
- 중복 콘텐츠라면 `noindex` 또는 canonical 원문 지정을 기본값으로 둔다.
- outline section id는 #59 chunk id, #54 section analytics와 맞출 수 있어야 한다.

주의:

- 발표 UX를 원문 article route에 강하게 결합하지 않는다.

## 4. 남은 리스크와 보류 결정

| 구분                           | 상태                   | Phase 2+ 처리                                                         |
| ------------------------------ | ---------------------- | --------------------------------------------------------------------- |
| `www.seojing.com` DNS          | 현재 미설정으로 보고됨 | apex canonical 유지. www redirect/DNS는 별도 Cloudflare 작업으로 처리 |
| `api.seojing.com`              | 후보만 확정            | 실제 Tunnel hostname, Access policy, DNS는 API 구현 티켓에서 확정     |
| Cloudflare Tunnel/Access       | 정책만 확정            | Mac mini service port, tunnel name, Access group은 환경값 필요        |
| rate limit/queue/observability | 미구현                 | analytics/RAG/TTS 각 MVP acceptance에 포함                            |
| admin API                      | public 비노출만 확정   | dashboard 구현 전 Access/auth 설계 필요                               |
| RAG/private index              | 미구현                 | static public index와 private embedding index 분리 필요               |
| TTS artifact storage           | 미구현                 | #54/#59의 session/section id 결정 후 artifact key 확정                |
| presentation SEO               | 미결정                 | 중복 route는 기본 `noindex` 또는 canonical 원문                       |

## 5. Phase 1에서 닫힌 결정

- SEOJing 공개 블로그/색인 표면을 Mac mini full origin으로 이전하지 않는다.
- canonical front는 `https://seojing.com`으로 둔다.
- Mac mini는 동적 API origin으로만 둔다.
- public browser는 raw Mac mini origin을 직접 호출하지 않는다.
- sitemap/robots/rss/llms.txt/metadata/JSON-LD는 Cloudflare public front의 책임이다.
- Worker BFF/proxy는 allowlist 기반으로 시작한다.
- admin은 public proxy 경로에 포함하지 않는다.

## 6. Phase 2 진입 체크리스트

Phase 2+ 티켓을 시작하기 전에 각 티켓 본문 또는 첫 산출물에 다음을 명시한다.

- [ ] 이 기능이 public SEO surface에 영향을 주는가?
- [ ] canonical URL/site origin을 바꾸는가?
- [ ] Mac mini 장애 시 public article route가 계속 200인가?
- [ ] browser bundle에 들어가는 env와 server-only env가 분리되어 있는가?
- [ ] public API path와 admin/internal path가 분리되어 있는가?
- [ ] privacy-sensitive data가 raw로 저장되거나 public asset에 노출되지 않는가?
- [ ] #54 event model, #59 chunk id, TTS/presentation section id가 충돌하지 않는가?

## 7. Verification evidence to carry forward

현재까지 확인된 검증 근거:

- #51: `pnpm --filter @app/web run lint` 성공
- #51: `pnpm --filter @app/web run build` 성공
- #51: local production route probe에서 `/robots.txt`, `/sitemap.xml`, `/rss.xml`, `/llms.txt`, `/blog/okayJing/reading-guide` 200 확인
- #51 follow-up: `pnpm exec eslint spikes/**/*.mjs` 성공
- #51 follow-up: `node spikes/001-macmini-backend-boundary/smoke-test.mjs` 성공
- #51 follow-up: `git diff --check` 성공
- #52: smoke test 8개 체크 통과

이 gate 문서는 새 runtime 동작을 추가하지 않는다. 따라서 문서 검증은 Prettier check로 충분하다. Phase 2 구현 티켓은 각자 lint/build/smoke 검증을 다시 수행해야 한다.
