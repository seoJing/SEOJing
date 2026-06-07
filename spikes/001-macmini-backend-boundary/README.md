# 001: Mac mini backend boundary/proxy spike

관련 티켓: local #52 / kanban t_4dfc7b52
상위 ADR: `docs/seojing-cloudflare-macmini-backend-adr.md`

## 질문

Cloudflare 공개 프론트는 그대로 두고, Mac mini가 analytics/RAG/TTS/admin API만 담당하도록 나누는 경계를 로컬에서 검증할 수 있는가?

Given SEOJing public HTML/SEO surface stays on Cloudflare, when a dynamic API call is needed, then a Worker/BFF-style proxy should forward only approved public API paths to a Mac mini origin with server-only credentials, while admin/raw-origin paths stay hidden.

## 스파이크 구성

- `macmini-origin.mjs`: Mac mini 내부 origin 역할.
  - `GET /healthz`: origin 자체 health.
  - `POST /v1/analytics/events`: privacy-safe collect stub.
  - `POST /v1/rag/query`: RAG stub.
  - `POST /v1/tts/jobs`: long-running TTS를 즉시 생성하지 않고 job enqueue 형태로 반환.
  - `/admin/*`: 별도 admin token 필요.
- `worker-proxy.mjs`: Cloudflare Worker/BFF proxy 역할.
  - 공개 경로만 `/api/*`에서 origin `/v1/*`로 매핑.
  - server-only `x-seojing-proxy-token`을 origin 호출에만 주입.
  - canonical site origin만 CORS 허용.
  - `x-request-id`를 origin까지 전달.
  - origin 장애/timeout은 API JSON degraded 응답으로 격리.
- `smoke-test.mjs`: 두 서버를 random localhost port로 띄워 실제 fetch로 검증.

## API 경계 초안

| 기능                     | public front 경로                 | Mac mini origin 경로   | 공개 브라우저 직접 호출         | 인증/운영 원칙                                          |
| ------------------------ | --------------------------------- | ---------------------- | ------------------------------- | ------------------------------------------------------- |
| origin health            | `/api/healthz` 또는 내부 모니터링 | `/healthz`             | 제한적으로 가능하나 no-store    | public HTML과 분리된 상태 점검                          |
| analytics collect        | `/api/analytics/events`           | `/v1/analytics/events` | Worker proxy만                  | raw IP/UA 저장 금지, 최소 이벤트/짧은 retention         |
| post RAG/Q&A             | `/api/rag/query`                  | `/v1/rag/query`        | Worker proxy 또는 API subdomain | rate limit, cache/abuse budget, 실패 시 widget degraded |
| TTS learning mode        | `/api/tts/jobs`                   | `/v1/tts/jobs`         | API subdomain/Worker proxy      | job id + polling/SSE/queue 우선, 긴 요청 금지           |
| admin mutation/dashboard | 노출하지 않음                     | `/admin/*`             | 금지                            | Cloudflare Access 또는 강한 별도 인증 뒤                |

## 실행

```bash
node spikes/001-macmini-backend-boundary/smoke-test.mjs
```

독립 실행도 가능하다.

```bash
PORT=8789 SEOJING_PROXY_TOKEN=example-proxy-token node spikes/001-macmini-backend-boundary/macmini-origin.mjs
PORT=8788 MACMINI_API_ORIGIN=http://127.0.0.1:8789 SEOJING_PROXY_TOKEN=example-proxy-token node spikes/001-macmini-backend-boundary/worker-proxy.mjs
```

`example-proxy-token`은 스파이크용 placeholder다. 실제 secret은 repo/env public bundle에 넣지 않는다.

## 검증 결과

마지막 실행:

```text
node spikes/001-macmini-backend-boundary/smoke-test.mjs
```

확인한 항목:

1. origin `/healthz`가 token 없이 내부 health를 반환한다.
2. origin dynamic API는 proxy token 없는 직접 호출을 401로 거부한다.
3. Worker proxy가 허용된 RAG 호출을 origin으로 전달하고 `x-request-id`를 보존한다.
4. analytics collect가 최소 이벤트만 받아들이고 raw IP/UA 저장 금지 원칙을 명시한다.
5. TTS는 즉시 생성이 아니라 queued job 모델로 응답한다.
6. public Worker proxy가 `/api/admin/*`을 노출하지 않는다.
7. canonical site origin 외 CORS origin을 403으로 막는다.
8. Mac mini origin 장애가 502 degraded JSON으로 격리된다.

## Verdict: VALIDATED

### What worked

- Cloudflare Worker/BFF proxy와 Mac mini origin 사이의 최소 경계가 Node 내장 모듈만으로 재현됐다.
- public browser가 raw Mac mini dynamic API를 직접 호출하지 못하게 proxy token 경계를 둘 수 있음을 확인했다.
- analytics/RAG/TTS/admin을 같은 Mac mini 프로세스에 두더라도 public proxy route allowlist로 노출면을 분리할 수 있다.
- request id 전달과 upstream 장애 degraded 응답이 스파이크 수준에서 동작했다.

### What did not get solved here

- 실제 Cloudflare Worker/Vinext runtime route로 이 proxy를 붙이는 작업은 하지 않았다.
- Cloudflare Tunnel public hostname, Access policy, real TLS/cert 설정은 환경값이 필요하다.
- rate limit, queue, DB, observability storage는 후속 MVP 티켓에서 구현해야 한다.

### Recommendation for the real build

1. SEOJing public article/layout/render path에는 Mac mini fetch를 넣지 않는다.
2. `apps/web`에는 먼저 Worker route/BFF 형태로 `/api/analytics/events`, `/api/rag/query`, `/api/tts/jobs`만 추가한다.
3. `MACMINI_API_ORIGIN`, proxy token, admin token은 server-only secret으로만 관리한다.
4. `/admin/*`은 public Worker proxy에서 라우팅하지 말고 Cloudflare Access 뒤 별도 hostname/path로 분리한다.
5. #42/#43/#45는 이 스파이크의 route matrix를 각 기능별 contract로 확장한다.
