# SEOJing Phase 2 analytics gate

작성일: 2026-06-08
관련 티켓: local #58
상태: Phase 2 통합 게이트

## 1. Gate verdict

Phase 2 analytics MVP는 다음 조건으로 통과한다.

- Analytics event contract의 canonical schema version은 `seojing.analytics.v1`이다.
- 공개 collect surface와 admin/dashboard read surface는 분리한다.
- 공개 글/SEO route는 analytics API availability에 의존하지 않는다.
- browser event payload에는 raw IP, raw User-Agent, email/name/token/secret, raw Q&A question/answer, copied code 전문을 넣지 않는다.
- `session_id`, `content_slug`, optional `section_id`는 이후 RAG, TTS, presentation 기능이 공유하는 correlation key로 사용한다.
- MVP 저장소는 Mac mini origin의 append-only JSONL로 시작한다. dashboard/aggregate 저장소는 필요해질 때 JSONL replay에서 SQLite/Postgres로 승격한다.

즉 Phase 3+는 진행 가능하지만, 다음 기능들은 이 문서의 event contract와 degraded UI 원칙을 acceptance criteria로 가져가야 한다.

## 2. 입력 산출물

| 티켓                              | 산출물                                                                                                                              | Gate 판단                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| #54 B1 analytics taxonomy/privacy | `docs/seojing-analytics-event-taxonomy-privacy.md`                                                                                  | v1 envelope, event taxonomy, privacy/retention 기준 확정                     |
| #55 B2 ingestion/storage API MVP  | `docs/seojing-analytics-ingestion-storage-api.md`, `apps/web/src/shared/analytics/*`, `apps/web/scripts/analytics-origin-server.ts` | JSONL append-only storage, validation/reject, replay smoke 경로 확보         |
| #56 B3 frontend events            | `apps/web/src/widgets/article-analytics/*`, blog page wiring, code copy event                                                       | post/scroll/section/code/toc 이벤트 emission 경로 확보                       |
| #57 B4 dashboard MVP              | PR #28 산출물과 CI 검증                                                                                                             | 글/섹션 지표를 읽는 최소 dashboard surface가 같은 contract를 참조하도록 승인 |

PR #28은 review-required block 해소 시점에 Lint/Test/Build/Workers Builds/CodeRabbit이 green이었다.

## 3. Canonical event contract

### 3.1 Schema version

```ts
const ANALYTICS_SCHEMA_VERSION = "seojing.analytics.v1";
```

Major breaking change가 생기면 새 버전 문자열을 만든다. 기존 `v1` row를 수정 migration하지 않고 replay/aggregate 계층에서 version별로 해석한다.

### 3.2 Common envelope

```ts
type AnalyticsEventV1 = {
  schema_version: "seojing.analytics.v1";
  event_id: string;
  session_id: string;
  event_type: EventTypeV1;
  occurred_at: string;
  content: {
    content_slug: string;
    canonical_url?: string;
    content_kind:
      | "blog_post"
      | "study_post"
      | "okayjing_post"
      | "devlog_post"
      | "page";
    section_id?: string;
    section_heading?: string;
  };
  client_context?: {
    viewport?: "xs" | "sm" | "md" | "lg" | "xl";
    theme?: "light" | "dark" | "system";
    locale?: "ko" | "en" | "unknown";
    referrer_class?:
      | "internal"
      | "search"
      | "social"
      | "direct"
      | "external"
      | "unknown";
    device_class?: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  };
  event: Record<string, unknown>;
};
```

### 3.3 Event types

Server-side ingestion accepts the full cross-feature v1 taxonomy:

```ts
type EventTypeV1 =
  | "post_view"
  | "scroll_depth"
  | "section_engagement"
  | "code_copy"
  | "toc_interaction"
  | "tts_interaction"
  | "presentation_interaction"
  | "qa_interaction";
```

Current browser instrumentation emits only the Phase 2 reading events:

```ts
"post_view" |
  "scroll_depth" |
  "section_engagement" |
  "code_copy" |
  "toc_interaction";
```

TTS, presentation, and Q&A tickets must reuse the server-side `seojing.analytics.v1` envelope instead of creating separate event schemas.

## 4. Section id and content key contract

### 4.1 Content slug

`content_slug` is the canonical blog slug without `/blog/`.

Examples:

```text
study/backend/day1
okayJing/workflow/hermes-ticket-memory
SEOJing/devLog/day12
```

The dashboard, RAG, TTS, and presentation features should join data by `content_slug`, not by route pathname or title.

### 4.2 Section id

`section_id` is shared by analytics, MDX chunk/index, presentation outline, and TTS section artifacts.

MVP format:

```text
sec_<heading-slug>_<short-hash>
```

Rules:

- Stable within the same `content_slug` and heading path.
- Store/query section-level metrics with `(content_slug, section_id)` together.
- Do not use heading text alone as a durable id because headings can repeat or change.
- If a feature only targets the whole article, omit `section_id` or use a documented root sentinel such as `sec_article_root`.

## 5. Privacy and storage gate

### 5.1 Forbidden event fields

Accepted events must not contain any of these field names anywhere in the event object:

```text
ip, raw_ip, user_agent, ua, email, name, token, secret, question, answer, copied_code
```

This is enforced by ingestion validation. The event is rejected, while other valid events in the same batch may still be accepted.

### 5.2 Retention baseline

| 데이터                      | 기본 retention | 비고                              |
| --------------------------- | -------------- | --------------------------------- |
| raw accepted JSONL row      | 30일           | raw IP/UA 없음. replay/debug 목적 |
| daily aggregate             | 13개월         | slug/event/section 단위           |
| rejected/rate-limit summary | 7일            | payload 전문 저장 금지            |
| operational request log     | 14일           | request id 중심                   |

### 5.3 Storage decision

MVP source of truth is append-only JSONL:

```text
apps/web/var/analytics/events.jsonl
```

or the path configured by `SEOJING_ANALYTICS_JSONL_PATH`.

SQLite/Postgres is not required for Phase 2 completion. A dashboard implementation may create derived aggregate tables later, but raw replay should continue to work from JSONL.

## 6. API and UI boundary

### 6.1 Collect endpoint

Allowed public write surface:

```http
POST /api/analytics/events
```

or Mac mini origin behind Cloudflare front:

```http
POST /v1/analytics/events
```

Required behavior:

- batch limit: 20 events
- body limit: 32KB default
- partial accept/reject response
- CORS allowlist for canonical origins
- request id propagation
- no admin/read data in collect response

### 6.2 Admin/dashboard read surface

Dashboard/read endpoints are private/admin only. They must not be added to the public collect route.

Minimum rule:

```text
public write-only collect != private read dashboard
```

Use Cloudflare Access or an equivalent server-side auth gate before exposing raw/aggregate analytics views.

### 6.3 Frontend degraded behavior

Article pages must render normally when analytics is disabled, blocked, or unavailable.

Required behavior:

- opt-out and Do Not Track prevent browser collect calls.
- collect failure does not throw into React render.
- analytics API is not needed for SSR, metadata, sitemap, RSS, or llms.txt.
- dashboard failure does not affect public `/blog/**` routes.

## 7. Phase 3+ consumers

### 7.1 RAG/Q&A tickets (#59, #60, #61, #62)

- Use `content_slug` and `section_id` from the MDX chunk/index pipeline.
- Emit `qa_interaction` events without storing raw question/answer in analytics.
- Use length buckets and latency/status metadata instead of text bodies.
- RAG API failure must degrade the widget only.

### 7.2 TTS tickets (#66, #67, #68)

- Use the existing TTS artifact id plus `content_slug` and optional `section_id`.
- Emit `tts_interaction` for open/play/pause/complete/request_generate/change_speed.
- Do not log raw TTS prompt, generated audio path secrets, or user voice data.
- Audio API failure must degrade the audio widget only.

### 7.3 Presentation tickets (#69, #70, #71)

- Use the same `content_slug` and `section_id` as the article/chunk model.
- Emit `presentation_interaction` for open/slide navigation/exit.
- Presentation routes must not create duplicate SEO canonical ambiguity. Prefer original article canonical or noindex for derived deck routes.

### 7.4 Portfolio tickets (#72, #73)

- Use `content_kind` and `content_slug` for case-study metrics.
- Do not introduce account/profile identity in analytics before there is a privacy page and explicit product need.

## 8. Verification evidence

Gate evidence at approval time:

- PR #28 remote checks: Lint pass, Test pass, Build pass, Workers Builds pass, CodeRabbit pass.
- #55 ingestion implementation includes schema validation, forbidden field rejection, JSONL append storage, and replay helper.
- #56 frontend instrumentation emits privacy-safe reading events and does not include copied code text.
- Current gate document adds no runtime behavior; document verification is Prettier check.

## 9. Open risks carried forward

| Risk                                                 | Carry-forward rule                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Actual Cloudflare Tunnel/Access values are not fixed | API implementation tickets must use server-only env and not expose raw origin          |
| Rate limiting is policy-level only                   | First public API deployment must add per-IP/session budget                             |
| Dashboard aggregate store may outgrow JSONL replay   | Promote to SQLite/Postgres derived tables only after query shape is known              |
| Privacy page/opt-out UI is not complete              | Do not expand event payload detail until user-facing privacy text exists               |
| Cross-feature section id drift                       | RAG/TTS/presentation tickets must reuse or explicitly map the same section id contract |

## 10. Acceptance criteria for closing #58

- Phase 2 inputs and approval evidence are summarized.
- `seojing.analytics.v1` is named as the canonical event contract for next features.
- Public collect, private dashboard, and public article route boundaries are restated.
- RAG/TTS/presentation consumers have explicit carry-forward rules.
- The document is formatted and referenced from the Phase 1 gate follow-up list.
