# SEOJing 분석 이벤트 taxonomy/privacy 설계

작성일: 2026-06-08
관련 티켓: local #54 / kanban t_a499a2f3
상태: Phase 2 B1 설계 기준
입력 산출물:

- local #50 / kanban t_ac638550: `docs/seojing-cloudflare-macmini-backend-adr.md`
- local #52 / kanban t_4dfc7b52: `spikes/001-macmini-backend-boundary/`
- local #53 / kanban t_6f48d19c: `docs/seojing-phase1-integration-gate.md`

## 1. 설계 목표

SEOJing의 분석 이벤트는 글 읽기 경험을 개선하기 위한 최소 데이터만 수집한다. 이 문서는 조회, 스크롤, 섹션 체류, 코드 복사, 목차, TTS, 프레젠테이션, Q&A 이벤트를 하나의 버전된 taxonomy로 정의하고, 이후 RAG/TTS/presentation 기능이 같은 `content_slug` / `section_id` / `session_id` 모델을 재사용하도록 기준을 고정한다.

핵심 원칙:

- 공개 글 route, SEO metadata, sitemap, RSS, llms.txt는 analytics API availability에 의존하지 않는다.
- browser event payload에는 raw IP, raw User-Agent, secret, email, 이름, 로그인 식별자, query 전문을 넣지 않는다.
- public collect endpoint와 admin/dashboard 조회 endpoint는 경로, 인증, rate limit, 응답 payload를 분리한다.
- 이벤트 taxonomy는 버전 문자열로 진화시킨다. 이 문서의 최초 버전은 `seojing.analytics.v1`이다.

## 2. Boundary

| 영역              | 공개/비공개       | 권장 경로                                 | 책임                                                                                            |
| ----------------- | ----------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| event collect     | public write-only | `POST /api/analytics/events`              | browser 이벤트 수집. 인증 대신 origin allowlist, rate limit, schema validation, size limit 적용 |
| admin dashboard   | private read      | `/admin/analytics/**` 또는 별도 admin API | 집계 조회. Cloudflare Access 또는 강한 server-side auth 필요                                    |
| raw/event storage | private           | Mac mini 또는 server-only DB              | 짧은 retention, raw IP/UA 저장 금지, request id만 운영 로그와 연결                              |
| public article    | public read       | `/blog/**`                                | analytics 실패와 무관하게 렌더링 성공                                                           |

금지:

- `GET /api/analytics/events`처럼 public collect endpoint에서 조회 기능을 같이 제공하지 않는다.
- admin token, Mac mini origin, internal port, proxy token을 browser bundle 또는 `PUBLIC_*` env에 넣지 않는다.
- analytics 응답을 기다려야 article SSR/metadata가 완성되는 구조를 만들지 않는다.

## 3. Identity and privacy model

### 3.1 Session id

`session_id`는 익명 클라이언트 세션 식별자다.

권장 생성 규칙:

- browser에서 `crypto.randomUUID()` 또는 동등한 128-bit 이상 난수로 생성한다.
- 값 자체는 사용자 계정, email, IP, UA, device id에서 파생하지 않는다.
- 저장 위치는 localStorage보다 sessionStorage를 기본값으로 둔다. 방문자 경로 분석이 꼭 필요하면 localStorage를 쓰되 24시간 TTL을 둔다.
- 회전 기준은 24시간 경과, 사용자의 opt-out 변경, storage clear, schema major version 변경이다.
- 서버는 `session_id`를 그대로 공개 로그에 장기간 남기지 않는다. 장기 집계가 필요하면 daily salt 기반 hash로 별도 파생한다.

형식:

```text
s_<uuid-v4-or-random-base64url>
```

예시:

```text
s_8bf0c1d3-7e34-4d38-a3c4-f0a0c7f6f9d1
```

### 3.2 IP and User-Agent

- event payload에 raw IP와 raw User-Agent를 포함하지 않는다.
- 서버/Worker는 abuse 방어와 rate limit을 위해 요청 IP/UA를 ephemeral signal로 사용할 수 있지만 event row에 저장하지 않는다.
- device 분류가 필요하면 서버에서 coarse context만 저장한다. 예: `device_class: "mobile"`, `browser_family: "chrome"`, `country_region: "KR"`.
- 정밀 위치, 도시, full UA string, fingerprint entropy가 큰 header 조합은 저장하지 않는다.

### 3.3 Retention

| 데이터                        | 기본 retention | 비고                                                       |
| ----------------------------- | -------------- | ---------------------------------------------------------- |
| raw accepted event row        | 30일           | 디버깅/품질 확인용. raw IP/UA 없음                         |
| daily aggregated metric       | 13개월         | slug/event/section 단위 집계만 유지                        |
| rejected event/rate-limit log | 7일            | payload 전문 저장 금지. reason/count/request_id 중심       |
| request id operational log    | 14일           | Cloudflare/Mac mini 장애 추적용. event row와 느슨하게 연결 |

### 3.4 Opt-out and minimum collection

- 초기 MVP는 cookie banner 없이도 설명 가능한 최소 수집으로 제한한다.
- `/privacy` 또는 footer에 “익명 사용성 이벤트, raw IP/UA 미저장, opt-out 가능”을 명시한다.
- opt-out 사용자는 browser에서 collect 호출 자체를 보내지 않는다.
- opt-out state는 `seojing_analytics_opt_out=true`처럼 명시적 key로 저장하고, 변경 즉시 기존 `session_id`를 폐기한다.
- Do Not Track 신호가 켜져 있으면 opt-out과 동일하게 처리한다.

## 4. Common event envelope

모든 이벤트는 아래 envelope를 따른다.

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

필수 필드:

| 필드                   | 필수   | 설명                                                              |
| ---------------------- | ------ | ----------------------------------------------------------------- |
| `schema_version`       | 예     | 최초 버전은 `seojing.analytics.v1`                                |
| `event_id`             | 예     | 클라이언트 생성 UUID. 중복 전송 dedupe용                          |
| `session_id`           | 예     | 익명 세션 id. PII에서 파생 금지                                   |
| `event_type`           | 예     | 5장의 enum 중 하나                                                |
| `occurred_at`          | 예     | ISO 8601 UTC timestamp. 서버 수신 시각과 별도 저장 가능           |
| `content.content_slug` | 예     | canonical blog slug. 예: `okayJing/workflow/hermes-ticket-memory` |
| `content.section_id`   | 조건부 | 섹션 단위 이벤트, TTS, presentation, Q&A는 권장/필수              |
| `event`                | 예     | event_type별 세부 payload. allowlist 외 필드 reject               |

Payload size limit:

- 단일 이벤트: 4KB 이하
- batch collect: 최대 20개 이벤트 또는 32KB 이하
- 문자열 필드: 기본 256자 이하, `canonical_url`은 512자 이하

## 5. Section id contract

`section_id`는 #59 chunk/index pipeline, #54 analytics, TTS artifact, presentation outline이 공유할 안정 id다.

MVP 규칙:

```text
sec_<heading-slug>_<short-hash>
```

- `heading-slug`: MDX heading text를 lowercase, ASCII-compatible slug로 변환한다. 한글 heading은 transliteration보다 안정 hash를 우선하고 사람이 읽을 수 있는 prefix가 어렵다면 `section`을 사용한다.
- `short-hash`: canonical `content_slug + heading path + heading text`의 8~10자 hash.
- 같은 글 안에서 안정적이면 충분하다. 다른 글과 전역 unique일 필요는 없지만, 저장/조회 key는 `content_slug + section_id`를 함께 쓴다.
- heading이 없는 전체 글 이벤트는 `section_id`를 생략하거나 `sec_article_root`를 사용한다. 이후 #59에서 최종 확정한다.

예시:

```text
content_slug = "study/backend/day1"
section_id = "sec_request-flow_a1b2c3d4"
```

## 6. Event taxonomy v1

### 6.1 Event type enum

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

### 6.2 Taxonomy table

| event_type                 | 목적                | section_id | privacy notes                                                               |
| -------------------------- | ------------------- | ---------- | --------------------------------------------------------------------------- |
| `post_view`                | 글 조회 시작        | 선택       | referrer URL 전문 저장 금지. `referrer_class`만 사용                        |
| `scroll_depth`             | 글 소비 깊이        | 선택       | depth milestone만 전송. continuous scroll log 금지                          |
| `section_engagement`       | 섹션 체류/가시성    | 필수       | heartbeat는 15초 이상 간격. mouse path/selection 전문 금지                  |
| `code_copy`                | 코드 예제 유용성    | 권장       | 복사한 코드 전문 저장 금지                                                  |
| `toc_interaction`          | 목차 탐색           | 필수       | target heading text는 section metadata에서 파생. 클릭 좌표 저장 금지        |
| `tts_interaction`          | TTS 학습 mode 수요  | 권장/필수  | 음성 생성 prompt 전문, 사용자 음성, 계정 정보 저장 금지                     |
| `presentation_interaction` | 발표 mode 사용성    | 필수       | 발표 route가 별도여도 canonical article slug로 연결                         |
| `qa_interaction`           | RAG/Q&A 수요와 품질 | 권장/필수  | 질문/답변 전문 저장 금지. 별도 RAG 로그가 필요하면 private opt-in 설계 필요 |

Event payload allowlist:

```ts
type EventPayloadByTypeV1 = {
  post_view: {
    source?: "route_load" | "client_nav" | "restore";
    load_ms?: number;
  };
  scroll_depth: {
    max_depth_percent: 25 | 50 | 75 | 90 | 100;
    reading_ms?: number;
  };
  section_engagement: {
    action: "enter" | "leave" | "heartbeat";
    visible_ms?: number;
    max_visible_percent?: number;
  };
  code_copy: {
    block_id?: string;
    language?: string;
    copied_chars_bucket: "1-80" | "81-200" | "201-500" | "501+";
  };
  toc_interaction: {
    action: "open" | "close" | "jump";
    target_section_id?: string;
  };
  tts_interaction: {
    action:
      | "open"
      | "play"
      | "pause"
      | "resume"
      | "complete"
      | "change_speed"
      | "request_generate"
      | "download";
    artifact_kind?: "summary_2m" | "summary_5m" | "section";
    speed?: 0.8 | 1 | 1.2 | 1.5;
  };
  presentation_interaction: {
    action: "open" | "next_slide" | "prev_slide" | "jump_slide" | "exit";
    slide_index?: number;
  };
  qa_interaction: {
    action: "open" | "submit" | "answer_shown" | "feedback";
    question_length_bucket?: "1-40" | "41-120" | "121+";
    answer_latency_ms?: number;
    feedback?: "up" | "down";
  };
};
```

## 7. Event payload examples

### 7.1 Post view

```json
{
  "schema_version": "seojing.analytics.v1",
  "event_id": "evt_7f7b8f35-84dd-4010-85c6-419d0726b731",
  "session_id": "s_8bf0c1d3-7e34-4d38-a3c4-f0a0c7f6f9d1",
  "event_type": "post_view",
  "occurred_at": "2026-06-08T04:00:00.000Z",
  "content": {
    "content_slug": "okayJing/workflow/hermes-ticket-memory",
    "canonical_url": "https://seojing.com/blog/okayJing/workflow/hermes-ticket-memory",
    "content_kind": "okayjing_post"
  },
  "client_context": {
    "viewport": "lg",
    "theme": "dark",
    "locale": "ko",
    "referrer_class": "internal",
    "device_class": "desktop"
  },
  "event": {
    "source": "route_load",
    "load_ms": 124
  }
}
```

### 7.2 Section engagement shared with RAG/TTS/presentation

```json
{
  "schema_version": "seojing.analytics.v1",
  "event_id": "evt_1cfb5711-536b-4c64-833c-18c6b9a789f0",
  "session_id": "s_8bf0c1d3-7e34-4d38-a3c4-f0a0c7f6f9d1",
  "event_type": "section_engagement",
  "occurred_at": "2026-06-08T04:02:15.000Z",
  "content": {
    "content_slug": "study/backend/day1",
    "canonical_url": "https://seojing.com/blog/study/backend/day1",
    "content_kind": "study_post",
    "section_id": "sec_request-flow_a1b2c3d4",
    "section_heading": "요청이 들어오면 코드가 어떤 순서로 움직이나"
  },
  "event": {
    "action": "leave",
    "visible_ms": 42000,
    "max_visible_percent": 100
  }
}
```

같은 `content_slug + section_id`는 이후 다음 key로 재사용할 수 있다.

| 기능               | key 예시                                                      |
| ------------------ | ------------------------------------------------------------- |
| RAG chunk          | `rag:study/backend/day1:sec_request-flow_a1b2c3d4`            |
| TTS artifact       | `tts:study/backend/day1:sec_request-flow_a1b2c3d4:summary_2m` |
| presentation slide | `slide:study/backend/day1:sec_request-flow_a1b2c3d4:3`        |

### 7.3 Code copy without copied code

```json
{
  "schema_version": "seojing.analytics.v1",
  "event_id": "evt_feb88535-a7a9-4a65-a84f-4965b214e245",
  "session_id": "s_8bf0c1d3-7e34-4d38-a3c4-f0a0c7f6f9d1",
  "event_type": "code_copy",
  "occurred_at": "2026-06-08T04:05:00.000Z",
  "content": {
    "content_slug": "study/backend/day1",
    "content_kind": "study_post",
    "section_id": "sec_controller-example_c9d8e7f6"
  },
  "event": {
    "block_id": "code_controller-example_01",
    "language": "java",
    "copied_chars_bucket": "201-500"
  }
}
```

### 7.4 Q&A without raw question

```json
{
  "schema_version": "seojing.analytics.v1",
  "event_id": "evt_7fcd91f2-87bf-4c81-80bf-d4bdeaf54261",
  "session_id": "s_8bf0c1d3-7e34-4d38-a3c4-f0a0c7f6f9d1",
  "event_type": "qa_interaction",
  "occurred_at": "2026-06-08T04:07:00.000Z",
  "content": {
    "content_slug": "study/backend/day1",
    "content_kind": "study_post",
    "section_id": "sec_request-flow_a1b2c3d4"
  },
  "event": {
    "action": "answer_shown",
    "question_length_bucket": "41-120",
    "answer_latency_ms": 830
  }
}
```

## 8. Validation rules

Collect endpoint는 다음 순서로 처리한다.

1. Method/path 확인: `POST /api/analytics/events`만 허용한다.
2. Origin 확인: canonical `https://seojing.com`과 local dev origin allowlist만 허용한다.
3. Rate limit: IP/session 기준으로 짧은 window 제한을 둔다. 이 때 IP는 저장하지 않고 limiter key로만 사용한다.
4. JSON size limit: 32KB 초과 batch reject.
5. Schema validation: `schema_version`, `event_type`, required fields, enum, string length, payload allowlist 확인.
6. Privacy validation: 금지 필드명 reject. 예: `ip`, `user_agent`, `ua`, `email`, `name`, `token`, `secret`, `question`, `answer`, `copied_code`.
7. Accepted event에는 서버 수신 시각, request id, coarse server context만 추가한다.
8. 응답은 `{ accepted: number, rejected: number, request_id: string }`처럼 집계만 반환한다.

부분 실패 정책:

- batch 안의 일부 이벤트가 invalid면 valid 이벤트만 저장하고 rejected count/reason summary를 반환한다.
- 상세 rejected payload는 저장하지 않는다.
- 클라이언트는 실패해도 재시도를 1회 이하로 제한하고 article UX를 막지 않는다.

## 9. Admin/dashboard read model

Admin/dashboard는 raw event row를 직접 public에 노출하지 않고 집계 view를 읽는다.

권장 집계:

| metric                     | dimensions                                            | 설명                               |
| -------------------------- | ----------------------------------------------------- | ---------------------------------- |
| `post_views_daily`         | date, content_slug, content_kind                      | 글별 조회 trend                    |
| `scroll_depth_daily`       | date, content_slug, depth_percent                     | 25/50/75/90/100 도달률             |
| `section_engagement_daily` | date, content_slug, section_id                        | 섹션별 체류시간 bucket/leave count |
| `code_copy_daily`          | date, content_slug, section_id, language              | 코드 예제 유용성                   |
| `toc_jump_daily`           | date, content_slug, target_section_id                 | 목차 탐색 지점                     |
| `tts_usage_daily`          | date, content_slug, section_id, artifact_kind, action | TTS artifact 우선순위 판단         |
| `presentation_usage_daily` | date, content_slug, section_id                        | 발표 mode 사용 흐름                |
| `qa_usage_daily`           | date, content_slug, section_id, action, feedback      | RAG/Q&A 개선 우선순위              |

Dashboard API 기준:

- private route에서만 제공한다.
- date range는 기본 30일, 최대 13개월로 제한한다.
- row-level `event_id`/`session_id`를 기본 응답에 포함하지 않는다.
- export가 필요하면 별도 admin-only job으로 두고 audit log를 남긴다.

## 10. Implementation acceptance checklist

후속 구현 티켓은 다음을 통과해야 한다.

- [ ] `schema_version = seojing.analytics.v1`을 사용한다.
- [ ] browser payload에 raw IP, raw UA, secret, copied code, raw Q&A text가 없다.
- [ ] event_type별 payload는 allowlist 기반 validation을 통과한다.
- [ ] `content_slug`는 canonical blog slug와 일치한다.
- [ ] 섹션 이벤트는 `content_slug + section_id`를 사용해 #59 chunk id/TTS/presentation outline과 충돌하지 않는다.
- [ ] public collect endpoint와 admin/dashboard endpoint가 분리되어 있다.
- [ ] analytics API 실패가 article route SSR, metadata, sitemap, RSS, llms.txt를 깨지 않는다.
- [ ] retention/opt-out 정책이 privacy 문서 또는 UI copy에 반영된다.
- [ ] local smoke test가 accepted/rejected/privacy-forbidden payload를 모두 검증한다.

## 11. Open decisions for implementation

| 결정                              | 기본값                             | 확정 시점                    |
| --------------------------------- | ---------------------------------- | ---------------------------- |
| 저장소                            | Mac mini private DB                | analytics MVP 구현 티켓      |
| sessionStorage vs localStorage    | sessionStorage + 24h TTL option    | 실제 client instrumentation  |
| exact `section_id` hash algorithm | #59에서 확정                       | MDX chunk/index pipeline     |
| admin auth                        | Cloudflare Access 또는 server auth | dashboard 티켓               |
| public privacy page 문구          | 별도 copy PR                       | analytics UI/collect 구현 전 |

## 12. Handoff to downstream tickets

- #55/#56 analytics 구현 티켓은 이 문서를 API/schema contract로 사용한다.
- #59 chunk/index pipeline은 `content_slug + section_id` 생성 규칙을 최종화하되, analytics event의 key shape은 유지한다.
- TTS artifact spec은 `tts:<content_slug>:<section_id>:<artifact_kind>` 형태를 기본 key로 시작한다.
- Presentation outline은 slide id를 `content_slug + section_id + slide_index`로 파생하고, 별도 route가 생기면 기본 `noindex` 또는 canonical 원문 지정을 따른다.
- Q&A/RAG는 raw question/answer 로그가 필요하면 이 taxonomy와 별도인 private, opt-in, 짧은 retention 설계를 먼저 추가해야 한다.
