# SEOJing 운영 분석·발견 연결

2026-09-29 기준. 이 문서는 기존 JSONL 원형 설계의 **운영 연결 변경분**이다.

## 내부 글 읽기 분석

- 수집: 브라우저 `POST /api/analytics/events` → SEOJing Worker → Cloudflare D1 `seojing-analytics`.
- 저장: `analytics_events`의 이벤트 ID 중복 방지. IP와 User-Agent는 저장하지 않는다. 익명 세션 ID와 이벤트 본문은 30일만 보관한다.
- 남용 제어: Worker rate-limit binding, 요청당 20건·32 KiB 제한, origin allowlist 및 스키마/금지 필드 검증.
- 삭제: Worker scheduled handler가 매일 03:17 UTC에 30일 초과 이벤트를 삭제한다.
- 관리자 조회: `GET /api/ops/analytics/summary` → 최근 30일 D1 이벤트를 읽어 조회 세션·75% 도달률·능동 상호작용 비율을 계산한다. 20,000행을 넘으면 부분 집계 대신 실패 상태를 반환한다.
- 보호: Cloudflare Access가 `/ops/*`와 `/api/ops/*`를 가로막는다. Worker는 추가로 Access JWT 서명·issuer·audience·소유자 이메일을 검증한다.
- 공개 글은 수집 실패와 무관하게 렌더링한다. 관리자 화면은 실패를 0건으로 위장하지 않는다.

## 발견 분석

- `/ops/discovery`는 Google 일반 검색, Google 생성형 AI 노출, AI 리퍼러 방문을 별도 카드로 표시한다.
- 일반 검색: Search Console `searchAnalytics.query`, `sc-domain:seojing.com`, `web`, 완결 데이터. 28일 일별 클릭·노출과 이전 28일, 검색어/글 상위 1,000행을 가져온다.
- AI 리퍼러 방문: Cloudflare Web Analytics GraphQL의 RUM pageload groups를 site tag로 제한하고 알려진 AI host만 분류한다. 글별 방문 합이며 사이트 고유 방문자 수가 아니다. 리퍼러 없는 방문이나 AI 답변만 읽은 노출은 계산할 수 없다.
- Google 생성형 AI: Search Console UI 공식 내보내기 연결 전에는 `미연결`로 표시한다. 일반 검색 노출에 포함될 수 있으므로 합산하지 않는다.
- 원천별 API가 빈 결과를 돌려준 것과 인증/호출 실패를 다른 상태로 표시한다.

## 운영 자격 정보

Worker의 비공개 secret으로 아래 값이 필요하다. 실제 값은 저장소나 브라우저 번들에 넣지 않는다.

| Secret                       | 목적                                               |
| ---------------------------- | -------------------------------------------------- |
| `SEOJING_OPS_ACCESS_EMAIL`   | 관리자 JWT 소유자 비교. 기존 Worker에 존재         |
| `SEOJING_GSC_CLIENT_ID`      | Google Search Console 읽기 전용 OAuth client       |
| `SEOJING_GSC_CLIENT_SECRET`  | 해당 OAuth client secret                           |
| `SEOJING_GSC_REFRESH_TOKEN`  | `webmasters.readonly` 동의로 발급된 refresh token  |
| `SEOJING_CF_ANALYTICS_TOKEN` | Cloudflare Account Analytics Read 범위의 API token |

Cloudflare RUM site tag, Access issuer/audience는 비밀이 아닌 Worker vars로 고정한다. OAuth/분석 토큰이 없으면 페이지에서 해당 원천을 `미연결`로 표시한다.

## 배포·검증

1. `wrangler d1 migrations apply seojing-analytics --remote --config apps/web/wrangler.jsonc`로 스키마 적용.
2. CI가 기본 브랜치의 `vinext build`와 `dist/server/wrangler.json` 배포를 담당한다.
3. 익명 요청이 `/api/ops/analytics/summary`, `/api/ops/discovery`에서 Access 로그인으로 이동하는지 확인한다.
4. 수집은 실제 공개 글 방문 뒤 D1 행 증가와 관리자 조회 세션 증가로 검증한다. 점검 트래픽은 외부 유입 기준선에서 제외한다.
5. Google·Cloudflare 자격 정보 연결 뒤에는 각 원천의 API 상태·기간·빈 결과를 실제 값으로 확인한다.

원천 참고: [Search Console Search Analytics API](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [Cloudflare D1 Worker API](https://developers.cloudflare.com/d1/worker-api/), [Cloudflare Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [Google 생성형 AI 실적 보고서](https://support.google.com/webmasters/answer/16984139?hl=en).
