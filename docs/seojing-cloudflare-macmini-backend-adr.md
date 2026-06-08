# ADR: SEOJing Cloudflare 공개 프론트 + Mac mini 동적 백엔드 분리

작성일: 2026-06-07
관련 티켓: local #50 / kanban t_ac638550
상태: Accepted

## 1. 결정

SEOJing은 공개 읽기/SEO 표면을 Cloudflare Worker에 고정하고, Mac mini는 동적 API만 담당하는 분리 구조로 간다.

- Canonical 공개 프론트: `https://seojing.com`으로 전환한다.
- `workers.dev` 도메인은 배포 확인/백업 URL로만 유지한다.
- Mac mini API 공개 진입점은 별도 서브도메인 `https://api.seojing.com`을 후보로 둔다.
- 브라우저는 Mac mini의 LAN 주소, 동적 포트, 원본 터널 호스트를 직접 호출하지 않는다.
- 외부에서 호출해야 하는 동적 API는 Cloudflare 앞단을 거친다.
  - 기본: Cloudflare Worker BFF/proxy가 Mac mini origin을 호출한다.
  - 필요 시: Cloudflare Tunnel public hostname을 `api.seojing.com`에 연결한다.
- SSL/TLS는 사용자-facing edge에서 Cloudflare가 종료하고, Cloudflare → Mac mini 구간은 Cloudflare Tunnel 또는 Origin 인증서/HTTPS로 보호한다.

요약하면 URL 경계는 다음처럼 둔다.

| 용도                        | 결정                                            | 장애 영향                                  |
| --------------------------- | ----------------------------------------------- | ------------------------------------------ |
| 공개 글/목록/SEO            | Cloudflare Worker, canonical site origin        | Mac mini 장애와 무관하게 살아 있어야 함    |
| sitemap/robots/rss/llms.txt | Cloudflare Worker                               | 검색 진입점이므로 Mac mini에 의존하지 않음 |
| analytics/RAG/TTS/admin API | `api.<canonical-domain>` 앞단 + Mac mini origin | API만 degraded; 글 읽기/색인은 유지        |
| 관리자 API                  | Cloudflare Access 또는 별도 강한 인증 뒤        | 공개 브라우징과 완전 분리                  |

## 2. 배경

A1 감사 결과 현재 상태는 다음과 같다.

- SEOJing은 Cloudflare Worker `seojing`으로 배포된다.
- Worker entry는 `/_vinext/image`만 Cloudflare Images로 처리하고 나머지는 Vinext app-router로 위임한다.
- 공개 콘텐츠는 `apps/web/content/**/*.mdx` 131개이고, `/`, `/blog`, `/blog/[...slug]`가 핵심 읽기 경로다.
- 현재 공개 workers.dev 도메인은 응답하지만 sitemap/rss/canonical/글별 metadata는 아직 부족하다.
- custom-domain 후보들은 이 환경의 DNS 조회 기준 아직 응답하지 않았다.

따라서 지금 필요한 결정은 “Mac mini 기능을 붙일 수 있게 하되, SEOJing의 공개 색인 표면을 동적 홈서버 장애에 묶지 않는 것”이다.

## 3. 선택지

### Option A — Cloudflare-only: 모든 기능을 Worker/Cloudflare 서비스로 구현

장점:

- 운영 표면이 단순하다.
- Edge 응답성과 SSL/DNS 관리가 쉽다.
- 크롤러와 사용자에게 안정적이다.

단점:

- RAG/TTS/local model/개인 DB/장기 작업 큐처럼 Mac mini 로컬 자원을 쓰는 기능에 맞지 않는다.
- Cloudflare 런타임 제약과 비용/스토리지 모델에 기능 설계가 끌려간다.

판단: 공개 읽기/SEO에는 적합하지만 전체 제품 방향에는 부족하다.

### Option B — Mac mini full origin: 프론트까지 Mac mini로 이전

장점:

- 한 서버에서 프론트/API/DB/모델을 모두 제어할 수 있다.
- 내부 기능 개발은 단순해 보일 수 있다.

단점:

- Mac mini 장애, 재부팅, ISP/터널 문제, 로컬 네트워크 문제가 곧 공개 블로그 장애가 된다.
- 글로벌 캐시/edge/TLS/DDoS/배포 단순성을 잃는다.
- SEOJing의 핵심 자산인 공개 MDX 글 131개의 색인 안정성이 동적 API 실험에 묶인다.

판단: SEOJing의 공개 블로그 역할과 맞지 않으므로 채택하지 않는다.

### Option C — Hybrid: Cloudflare public front + Mac mini dynamic API

장점:

- 공개 글/색인은 Cloudflare에서 안정적으로 유지된다.
- Mac mini는 로컬 모델, RAG, TTS, analytics, admin 등 동적 기능만 맡는다.
- API 장애가 글 읽기/검색 색인 장애로 전파되지 않는다.
- 나중에 API별로 Worker proxy, Tunnel, Access, rate limit을 독립적으로 조정할 수 있다.

단점:

- site origin과 API origin, public env와 server-only env 경계를 문서화하고 지켜야 한다.
- Cloudflare ↔ Mac mini 관측/인증/timeout/retry 정책이 필요하다.
- 브라우저 CORS와 쿠키 정책을 신중하게 설계해야 한다.

판단: 채택한다.

## 4. 도메인 결정

### 4.1 현재 단계

현재 canonical site origin은 `https://seojing.com`이다.

근거:

- `apps/web/src/shared/config/site.ts`의 `siteConfig.origin`이 `https://seojing.com`으로 설정되어 있다.
- metadataBase, canonical URL, sitemap, robots, RSS, JSON-LD, OG URL은 이 `siteConfig.origin`/`absoluteUrl`/`blogUrl` 계약에서 파생된다.
- `workers.dev` 도메인은 배포 확인/백업 URL로 유지하되 검색 canonical은 custom domain으로 통일한다.

### 4.2 API custom domain 전환 기준

Mac mini 동적 API용 custom domain은 별도 검증 뒤 전환한다.

전환 시 권장값:

- canonical front: `https://seojing.com`
- API front: `https://api.seojing.com`
- workers.dev: 배포 확인/백업 URL로 유지하되, 검색 canonical은 custom domain으로 통일

전환 수용 기준:

- `apps/web/src/shared/config/site.ts`의 `siteConfig.origin`과 metadata/sitemap/robots/RSS/JSON-LD/OG 생성 경로가 canonical front를 사용한다.
- workers.dev와 다른 custom domain은 301 redirect 또는 canonical로 중복 색인을 방지한다.
- Cloudflare DNS에서 `seojing.com`과 `api.seojing.com` 레코드가 모두 의도한 대상에 연결된다.

### 4.3 apex/root 도메인 처리

신규 구매한 `seojing.com` apex를 SEOJing canonical로 확정한다. 기존 `tjwlsrb1021.com` 계열 후보는 개인 포트폴리오/다른 프로젝트와 섞일 수 있으므로 SEOJing canonical 후보에서 제외한다.

## 5. SSL/TLS 결정

### 5.1 사용자 → Cloudflare

- Cloudflare Universal SSL 또는 Advanced Certificate Manager가 edge 인증서를 담당한다.
- 사용자는 항상 HTTPS origin만 본다.
- `http://`는 `https://`로 redirect한다.

### 5.2 Cloudflare → Mac mini

기본 선택은 Cloudflare Tunnel이다.

- Mac mini에서 `cloudflared tunnel`이 내부 API 서버(`localhost:<port>`)로 연결한다.
- 공인 포트포워딩을 열지 않는다.
- Cloudflare public hostname은 `api.seojing.com`으로 둔다.
- 관리자 경로는 Cloudflare Access로 보호한다.

대안이 필요한 경우:

- 직접 origin HTTPS를 열어야 한다면 Origin Certificate 또는 Let’s Encrypt 인증서를 쓰고 Cloudflare SSL mode는 Full(strict)로 둔다.
- 단, 이 경우 방화벽, 포트포워딩, fail2ban/rate limit, origin IP 노출 리스크를 별도로 관리해야 하므로 기본안이 아니다.

## 6. Tunnel/proxy 결정

### 6.1 기본 API 접근 패턴

브라우저는 되도록 Cloudflare Worker BFF를 호출한다.

예:

```text
browser
  -> https://seojing.com/api/public-events
  -> Cloudflare Worker route/proxy
  -> Mac mini internal service through Tunnel
```

또는 API 서브도메인을 직접 노출해야 하는 기능은 다음처럼 둔다.

```text
browser/server client
  -> https://api.seojing.com/public/query
  -> Cloudflare Tunnel public hostname
  -> Mac mini localhost:<service-port>
```

선호 순서:

1. SEO/읽기와 무관한 단순 서버 간 기능: Worker BFF/proxy
2. 스트리밍, 긴 작업, 별도 OpenAPI가 필요한 기능: `api.seojing...` Tunnel hostname
3. 관리자/내부 기능: Cloudflare Access 뒤의 admin hostname 또는 path

### 6.2 timeout/retry 원칙

- Cloudflare 프론트의 HTML 렌더링은 Mac mini API를 hard dependency로 두지 않는다.
- API 호출 실패 시 article page는 정상 렌더링하고, 위젯만 degraded UI를 보여준다.
- RAG/TTS 같은 장기 작업은 request/response로 오래 붙잡지 않고 job id + polling/SSE/queue 모델을 우선한다.
- Worker proxy는 upstream timeout을 짧게 두고, 실패 응답은 cacheable public HTML과 분리한다.

## 7. 환경 변수 경계

### 7.1 public env

브라우저 번들에 들어갈 수 있는 값:

- `PUBLIC_SITE_ORIGIN=https://seojing.tjwlsrb1021.workers.dev` 또는 custom domain
- `PUBLIC_API_ORIGIN=https://api.seojing.com`가 꼭 필요한 경우만 사용
- 공개 기능 flag

주의:

- `PUBLIC_API_ORIGIN`이 있더라도 브라우저가 Mac mini raw host/port를 알아서는 안 된다.
- secret, token, tunnel origin, internal port는 절대 public env에 넣지 않는다.

### 7.2 server-only env

Cloudflare Worker 또는 Mac mini 서버 내부에서만 쓰는 값:

- `MACMINI_API_ORIGIN`
- `MACMINI_API_TOKEN`
- analytics write key
- RAG/TTS/admin service token
- Cloudflare Access service token 또는 mTLS 관련 secret

## 8. API 기능별 배치

| 기능                           | 위치                                       | 공개 여부    | 비고                                |
| ------------------------------ | ------------------------------------------ | ------------ | ----------------------------------- |
| 글 목록/글 본문                | Cloudflare Worker                          | 공개         | SEO 핵심. Mac mini 의존 금지        |
| robots/sitemap/rss/llms.txt    | Cloudflare Worker                          | 공개         | crawler entrypoint                  |
| 검색 인덱스 JSON               | Cloudflare Worker assets/generated content | 공개         | static index 우선                   |
| privacy-safe analytics collect | Worker proxy → Mac mini                    | 제한 공개    | raw IP/UA 저장 금지, retention 짧게 |
| analytics dashboard            | Mac mini                                   | 비공개/admin | Cloudflare Access 필요              |
| post context Q&A/RAG           | Worker BFF 또는 API subdomain → Mac mini   | 제한 공개    | rate limit/cache/job model 필요     |
| TTS learning mode              | API subdomain → Mac mini                   | 제한 공개    | 생성/캐시 분리, 비용/동시성 제한    |
| admin mutation                 | Mac mini                                   | 비공개/admin | public read API와 분리              |

## 9. 보안/운영 원칙

- public read path와 admin mutation path를 같은 인증 정책에 섞지 않는다.
- analytics는 원문 IP/UA 저장을 피하고, 최소 이벤트/익명 세션/짧은 retention으로 시작한다.
- RAG/TTS는 per-session/IP/user rate limit과 queue backpressure를 둔다.
- Mac mini origin health check와 public front health check를 분리한다.
- Cloudflare 로그와 Mac mini 로그의 request id를 맞출 수 있게 `x-request-id`를 전달한다.
- API 토큰은 Worker/server-only secret으로만 관리하고 repo에 두지 않는다.
- CORS는 canonical site origin allowlist로 시작한다. `*` + credentials 조합은 금지한다.

## 10. 후속 구현 티켓에 주는 제약

### #52 SEO foundation routes

- sitemap/robots/rss는 Cloudflare 단독으로 응답해야 한다.
- canonical origin은 shared site config에서만 파생한다.
- custom domain 전환에 맞춰 `https://seojing.com`을 canonical로 둔다.

### #53 post metadata/canonical

- post/folder/root metadata는 canonical site origin을 사용한다.
- API origin은 metadata/canonical에 섞지 않는다.

### #42 analytics dashboard MVP

- collect endpoint는 Worker proxy 또는 API subdomain 뒤에 둔다.
- dashboard/admin은 Cloudflare Access 또는 강한 인증 뒤에 둔다.
- 이벤트 스키마는 RAG/TTS와 공유 가능한 `session_id`, `content_slug`, `event_type` 중심으로 잡는다.

### #43 post context Q&A/RAG MVP

- article page SSR은 RAG API를 기다리지 않는다.
- RAG API는 degraded widget으로 붙이고, 실패해도 글 읽기는 성공해야 한다.
- 공개 query endpoint에는 rate limit, cache, abuse budget이 필요하다.

### #45 TTS learning mode

- TTS 생성은 장기 작업으로 간주하고 job/cache 모델을 우선한다.
- 글 HTML과 sitemap은 TTS API availability에 의존하지 않는다.
- 실제 MP3는 초기 MVP에서 R2가 아니라 Mac mini local cache에 저장하고, API는 상태 조회/생성 큐/Range streaming을 담당한다.
- 세부 계약은 `docs/seojing-tts-local-audio-api-mvp.md`를 따른다.

## 11. 수용 기준

이 ADR은 다음 기준으로 완료된 것으로 본다.

- Cloudflare 공개 프론트 유지 + Mac mini 동적 API 분리안을 명시했다.
- canonical front domain, API domain 후보, custom domain 전환 기준을 정했다.
- SSL/TLS 종료 지점과 Tunnel/direct-origin 대안을 정했다.
- Worker proxy와 API subdomain 사용 기준을 정했다.
- public env/server-only env 경계를 정했다.
- #42/#43/#45와 SEO foundation 티켓이 따라야 할 제약을 명시했다.

## 12. 미해결 사항

- 실제 Cloudflare zone에서 `tjwlsrb1021.com` DNS를 관리 중인지 확인해야 한다.
- `seojing.com`을 canonical로 사용한다. `www.seojing.com`은 DNS/custom-domain 설정 후 apex redirect 또는 canonical 유지 정책만 추가 확인하면 된다.
- Cloudflare Tunnel 이름, Mac mini service port, Access policy는 구현 티켓에서 실제 환경값으로 확정한다.
- API contract와 event/session model은 #42/#43/#45에서 별도 문서화한다.
