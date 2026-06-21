# SEOJing analytics ingestion/storage API MVP

작성일: 2026-06-08
관련 티켓: local #55 / kanban t_5dc3cd6d
선행 산출물: `docs/seojing-analytics-event-taxonomy-privacy.md`

## 결정 요약

MVP 저장소는 Mac mini private API의 append-only JSONL 파일로 시작한다.

- Public collect 경로: `POST /api/analytics/events` 또는 Worker proxy 뒤 `POST /v1/analytics/events`
- 실제 저장 책임: Mac mini origin process
- 저장 파일 기본값: `apps/web/var/analytics/events.jsonl` 또는 `SEOJING_ANALYTICS_JSONL_PATH`
- batch 한도: 최대 20개 이벤트 / 기본 32KB body
- 응답: `{ ok, accepted, rejected, request_id, rejected_reasons }` 집계만 반환
- admin/read endpoint: MVP collect surface에는 없음. dashboard/read는 후속 admin 티켓에서 Cloudflare Access 또는 강한 서버 인증 뒤에 별도로 둔다.

## SQLite/Postgres/파일 선택 근거

| 후보                   | 판단       | 이유                                                                                                                                                                                           |
| ---------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres               | 보류       | 운영/백업/접속면이 커지고 MVP에는 과하다. dashboard 집계가 커지거나 다중 writer가 필요해질 때 승격한다.                                                                                        |
| SQLite                 | 2단계 후보 | Mac mini 단일 writer와 집계 view에는 적합하지만, 최초 구현에서 schema migration/lock/retention job까지 묶으면 범위가 커진다. JSONL replay가 안정화된 뒤 SQLite aggregate table을 만들 수 있다. |
| append-only JSONL 파일 | 채택       | 구현이 단순하고 raw event replay/backup이 명확하다. valid row만 한 줄씩 저장하므로 rejected/private payload를 남기지 않는다. Mac mini 단일 origin process에서는 충분하다.                      |

따라서 MVP는 JSONL을 source-of-truth backup log로 삼고, dashboard가 필요해지는 시점에 JSONL replay 결과를 SQLite/Postgres aggregate로 적재한다.

## Privacy contract

저장 row는 다음 shape이다.

```ts
type StoredAnalyticsEvent = {
  schema_version: "seojing.analytics.v1";
  request_id: string;
  received_at: string;
  event: AnalyticsEventV1;
};
```

저장하지 않는 값:

- raw IP
- raw User-Agent
- email/name/token/secret
- raw Q&A question/answer
- copied code text
- rejected payload body

금지 field name이 payload 어디에든 나타나면 해당 이벤트만 reject한다. batch는 부분 실패를 허용하며 valid event만 append한다.

## 실행

Mac mini origin process:

```bash
cd /Users/seojing/.hermes/workspace/projects/SEOJing
SEOJING_ANALYTICS_JSONL_PATH=apps/web/var/analytics/events.jsonl \
SEOJING_ANALYTICS_ALLOWED_ORIGINS=https://seojing.com,http://localhost:5173 \
pnpm --filter @app/web run analytics:origin
```

Health check:

```bash
curl -s http://127.0.0.1:8791/healthz
```

Collect 예시:

```bash
curl -s -X POST http://127.0.0.1:8791/v1/analytics/events \
  -H 'origin: https://seojing.com' \
  -H 'content-type: application/json' \
  -H 'x-request-id: req-local-demo' \
  --data '{"events":[{"schema_version":"seojing.analytics.v1","event_id":"evt_demo_001","session_id":"s_demo_001","event_type":"post_view","occurred_at":"2026-06-08T04:00:00.000Z","content":{"content_slug":"study/backend/day1","content_kind":"study_post"},"event":{"source":"route_load"}}]}'
```

## Replay/backup 방식

1. `events.jsonl`를 주기적으로 압축 백업한다. 예: `events-YYYYMMDD.jsonl.gz`
2. 복구 시 `replayAnalyticsBackup(jsonlPath)`로 row count와 daily aggregate key를 재생한다.
3. 후속 dashboard 저장소가 SQLite/Postgres로 승격되면 JSONL을 그대로 읽어 `date|content_slug|event_type` 등의 aggregate table을 재구성한다.
4. rejected payload는 저장하지 않으므로 replay 대상은 accepted event뿐이다.

현재 구현의 replay smoke는 다음 aggregate key를 만든다.

```text
YYYY-MM-DD|content_slug|event_type -> count
```

## 구현 파일

- `apps/web/src/shared/analytics/analytics-ingestion.ts`: schema validation, privacy forbidden-field reject, JSONL append storage, replay helper
- `apps/web/src/shared/analytics/analytics-collect-api.ts`: Web Request handler, CORS allowlist, body limit, response shape
- `apps/web/scripts/analytics-origin-server.ts`: Mac mini Node HTTP origin process
- `apps/web/src/shared/analytics/*.test.ts`: collect/ingestion/replay tests

## Dashboard / 접근 최종 플랜

진규가 웹에서 바로 내부용을 확인할 수 있게 하되, GitHub OAuth를 SEOJing 앱에 바로 넣지는 않는다. Giscus 댓글의 GitHub 로그인은 `giscus.app` iframe 내부 인증이라 SEOJing 앱 세션으로 재사용할 수 없기 때문이다.

### 공개용

- 경로: `/analytics`
- 목적: SEOJing을 포트폴리오처럼 보여주는 public-safe 운영 지표
- 데이터: public summary JSON/API 또는 콘텐츠 인벤토리 fallback
- 노출 가능: 총 이벤트, 조회 이벤트, 인기 글, 이벤트 타입별 집계, 콘텐츠 분류별 개수
- 노출 금지: session id, raw IP, raw User-Agent, raw Q&A question/answer, raw referrer, 정확한 개인별 journey
- 작은 표본: 기본 threshold 미만은 숫자 대신 `< threshold` 형태로 숨긴다.

### 내부용

- 경로: `/ops/analytics`
- 목적: ingestion/storage/rejected event 상태 확인
- 접근: `/ops/*`와 `/v1/ops/*`를 Cloudflare Access로 보호하는 방식을 1순위로 둔다.
- fallback: origin read endpoint의 server-side bearer token. 이 값은 browser bundle 또는 `PUBLIC_*` env에 넣지 않는다.
- GitHub OAuth 직접 구현: 관리자 액션, 방문자 계정 기능, Q&A→GitHub Discussion 연결이 필요해질 때 후순위로 도입한다.

### Origin read endpoints

Mac mini origin process는 collect endpoint와 분리된 read endpoint를 제공한다.

```text
GET /v1/analytics/public-summary
GET /v1/ops/analytics/summary
```

`/v1/ops/analytics/summary`는 다음 중 하나가 있어야 통과한다.

- Cloudflare Access headers: `cf-access-authenticated-user-email` 또는 `cf-access-jwt-assertion`
- `SEOJING_ANALYTICS_OPS_READ_TOKEN`과 일치하는 `Authorization: Bearer ...`

## 후속 TODO

- Worker BFF/proxy 실제 배포 경로에서 `/api/analytics/events -> Mac mini /v1/analytics/events` 연결
- Cloudflare Tunnel/Access/env secret 운영값 확정
- `/ops/*`와 `/v1/ops/*` Cloudflare Access 정책 적용
- `SEOJING_ANALYTICS_PUBLIC_SUMMARY_URL`, `SEOJING_ANALYTICS_OPS_SUMMARY_URL` 운영값 연결
- retention job: raw accepted JSONL 30일, compressed backup/archive 정책 적용
- SQLite aggregate table은 dashboard 요구가 커진 뒤 JSONL replay source에서 생성
