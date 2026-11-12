# 2026-11-12 블로그 Worker 1102 성능 진단

## 판정

- 원래 장애: `2026-11-12 06:28:55 UTC`, Ray `a5937ab4ef5a74f0`, `seojing.com`의 Worker 1102.
- **하루 요청 수 소진이 아니다.** Cloudflare Workers Free의 요청 수 한도 초과는 1027이고, 1102는 CPU 또는 메모리 한도 오류다. 장애 시간대 GraphQL의 `exceededResources`와 실패 CPU 중앙값 10ms, 성공 요청의 과도한 CPU를 함께 보면 CPU 한도 초과가 가장 강한 설명이다. 메모리 초과의 별도 결과인 `exceededMemory`는 관측되지 않았다.
- Cloudflare는 드문 CPU 초과에 유예를 주지만 지속적으로 초과하면 종료한다. 따라서 성공한 요청의 CPU가 10ms보다 높다는 사실과 10ms에서 실패한 요청이 공존할 수 있다.
- `study/effective-typescript/day5`의 404는 진규가 비공개로 처리한 시리즈의 **의도된 동작**이다. 성능 결함이나 복구 대상으로 취급하지 않는다.

## 배포본 기준선

배포본 `91165930-ea37-4650-9a86-3d35ce402a14` (2026-10-22). Cloudflare GraphQL `workersInvocationsAdaptive`, 06:20–06:30 UTC:

| 항목                         |               값 |
| ---------------------------- | ---------------: |
| Worker 호출                  |            208건 |
| 리소스 초과                  |      16건 (7.7%) |
| 성공 요청 CPU p50 / p99      | 43.5ms / 341.9ms |
| 실패 요청 CPU p50            |             10ms |
| 별도 제어 요청 `/blog` CPU   |     414ms, 414ms |
| 별도 제어 요청 글 페이지 CPU |            202ms |

이 수치는 모든 요청이 동일 경로였다는 뜻이 아니다. 원래 Ray의 정확한 URL은 확인되지 않았다. 제어 요청은 `wrangler tail`로 Ray와 경로를 대조한 소수 표본이며 06:40 UTC경 별도 측정했다.

### Chrome DevTools Performance 기준선

Chrome CDP의 Performance Trace/Network를 사용했다. 캐시를 끄고 `/blog`를 새로고침했으며, 같은 headless Chrome의 800×600 viewport에서 기록했다. 트레이스는 Chrome DevTools Performance 패널로 가져올 수 있다. 시간 값은 실험실 표본 한 번으로 현장 Web Vitals의 p75가 아니다.

| 지표                |      운영 배포본 | 수정본 원격 개발 프리뷰 | 해석                                                            |
| ------------------- | ---------------: | ----------------------: | --------------------------------------------------------------- |
| HTML 압축 해제 크기 |       1,262,572B |                337,189B | **73.3% 감소**                                                  |
| DOM 요소            |            3,676 |                     717 | **80.5% 감소**                                                  |
| 전체 이미지 요소    |              197 |                      46 | 24개 카드 우선 노출                                             |
| 실제 이미지 전송    | 51.17MB / 18요청 |         0.89MB / 12요청 | 관측 로드에서 **98.3% 감소**; 요청 수와 프리뷰/운영 환경이 다름 |
| 자동 RSC 사전요청   |       2건 / 95KB |                     0건 | viewport·관측 시점에 따라 기준선은 5건 / 244KB도 관측           |
| FCP / LCP           |  1.24초 / 1.24초 |       2.468초 / 2.468초 | 서버·이미지 변환 상태가 달라 **속도 개선률로 비교 금지**        |
| CLS                 |          0.00018 |                 0.00018 | 양쪽 모두 양호                                                  |

가장 큰 원본 카드 사진은 4,529,374B였다. 같은 이미지의 개발 프리뷰 640px AVIF 변환은 5,876B(200, `image/avif`)였고 카드 스크린샷에서 시각적 표시를 확인했다. 최적화 이미지 엔드포인트는 기존 `/_vinext/image`뿐 아니라 `next/image`가 실제 생성하는 `/_next/image`도 처리하도록 수정했다. 후자는 수정 전 원본으로 302 리다이렉트되어 최적화가 적용되지 않았다.

프리뷰의 첫 변환이 진행된 표본에서는 LCP가 2.468초였고, 변환이 준비된 앞선 프리뷰 표본에서는 0.536초였다. 개발 프리뷰의 원격 바인딩/이미지 콜드 상태가 영향을 주므로 운영 배포 후 같은 경로에서 재측정한다.
마지막 게시물 총수 표시 수정 후 HTML 원문은 `/blog` 337,220B로, 표의 Performance trace 값보다 31B 컸다.

빌드의 500KB 경고 대상은 `OpsArticleEditor` 청크로, `/blog` 로드에서 요청되지 않았다. 이번 공개 블로그 경로의 우선 병목으로 보지 않았다. INP는 상호작용 표본이 없어 측정하지 않았다.

## 원인과 변경

1. 게시물 전체의 카드 SSR이 1.26MB HTML·3,676 DOM 요소를 만들었다. `/blog`와 대형 분야별 페이지에서는 최근 24개 카드만 먼저 렌더링하고 분야별 링크와 기존 `PostExplorer`로 전체 글을 계속 탐색할 수 있게 했다. 분야별 페이지에는 바로 아래 단계의 폴더·글 HTML 링크를 넣어 전체 글에 도달할 수 있고, 공개 글은 sitemap에도 남는다. `/blog/study` 원격 프리뷰 HTML은 526,674B → 346,445B(34.2% 감소)였다.
2. 카드·캐러셀의 `next/link`가 보이는 글의 RSC를 사전 요청해 각각 고비용 Worker 렌더를 추가했다. 해당 링크의 prefetch를 껐다. `NewPostsCarousel`는 서버 컴포넌트로 옮겨 전체 content tree를 클라이언트로 한 번 덜 직렬화한다.
3. 원본 2–4.5MB 이미지를 카드 크기로 전송했다. 기존 Cloudflare Images binding과 `next/image`를 사용해 640px AVIF 등으로 변환한다. **변환 성공이 확인된** 이미지 응답만 버전별 Cache API에 저장하고 브라우저 TTL은 5분으로 제한한다. vinext가 변환 실패 후 원본을 200으로 반환하는 경우는 캐시를 우회하고 TTL을 60초로 제한해 7일짜리 원본 캐시가 남지 않게 했다. [Images Free의 월 5,000개 고유 변환](https://developers.cloudflare.com/images/pricing/) 범위의 기존 binding을 사용하며 별도 유료 플랜을 신청하지 않는다.
4. 반복 SSR 자체를 막기 위해 공개 HTML과 RSC를 Cache API에 저장한다. 블로그 캐시 키에는 Worker 버전과 D1 게시물 리비전을 포함한다. D1 trigger가 게시·수정·삭제 시 리비전을 올려 어느 데이터센터에서도 비공개 글의 옛 캐시 키를 재사용하지 않는다. 하위 경로는 D1에 해당 공개 글이나 하위 공개 글이 있을 때만 캐시해, 비공개 전환 중 백엔드 fallback의 일시적인 200 응답을 새 리비전 아래에 저장하지 않는다. `_rsc` 값은 정규화하되 RSC·라우터·vinext 변형 헤더는 키에 반영한다. 홈·정적 소개 페이지는 Worker 버전으로 캐시를 무효화한다. 쿠키·인증 요청, 404, 임의 쿼리, `private/no-store` 응답은 저장하지 않는다. 캐시 가능한 페이지의 일반 브라우저·앞단 Worker 응답에는 `private, no-store`를 돌려 리비전 검사를 우회하지 않게 한다. 이는 브라우저 자체 캐시와 일부 뒤로 가기 최적화의 이점을 포기하는 안전성 우선 선택이다.

## 검증과 한계

- 저장소 전체 `pnpm build`, `pnpm lint`, `pnpm format:check`, `pnpm test:coverage`: 통과. 웹 `pnpm test`: 31 파일, 238 테스트 통과. 웹 `test:smoke` 2건, `public:readback:test` 5건, `worker:size:check`(gzip 531.65KiB / 상한 2,800KiB) 통과. 코드 재검토 수정 후 전체 빌드·테스트·Worker 크기를 재검증했다.
- SQLite 메모리 DB에서 새 migration 적용 후 리비전 `0 → 1 → 2 → 3`(insert/update/delete)을 확인했다. `wrangler d1 migrations apply ANALYTICS_DB --local`도 성공했다.
- 로컬 workerd 동일 환경의 반복 요청: 홈 82ms MISS → 9ms HIT, 블로그 34ms MISS → 15ms HIT(로컬 D1에 글 0개), 이미지 800ms MISS → 11ms HIT. **벽시계 시간**이며 운영 CPU 수치는 아니다.
- 독립 검토에서 비공개 전환 중 backend fallback의 일시적 200 캐싱 위험을 발견해 D1 공개 경로 확인을 추가했다. 수정 후 재검토에서 출시 차단 이슈 없이 수용됐다. 로컬 workerd의 실제 vinext `Vary` 헤더가 달린 `/blog` HTML과 RSC 모두 `MISS → HIT`를 확인했다. `_rsc` 임의 값·라우터 변형 분리와 fallback 200 미저장도 테스트했다. 운영에서는 하위 글 경로의 추가 D1 조회 비용을 따로 확인해야 한다.
- PR 자동 리뷰에서 변환 실패 시 원본 이미지가 200으로 반환되는 vinext 경로를 찾아, 장기 캐시가 아닌 60초 응답으로 분리하고 회귀 테스트를 추가했다.
- 이미지 프리뷰 응답: `/_next/image` 200 `image/avif`; 원본 리다이렉트가 아님. 카드 스크린샷도 확인했다.
- `pnpm exec tsc --noEmit`은 이 작업과 무관하게 기존 테스트·디자인시스템·날짜 유틸 타입 오류 7건으로 실패한다. 이 변경 파일의 타입 오류는 수정했다.
- 실제 운영의 캐시 적중 CPU와 1102 감소는 **아직 검증되지 않았다**. 캐시 미스는 여전히 SSR에 200–400ms CPU가 들 수 있고, 최초 요청·새 데이터센터에서는 1102가 완전히 배제되지 않는다. 배포 후 동일 조건에서 확인해야 한다.

## 릴리스 및 실측 순서 (아직 실행하지 않음)

1. 최신 운영 버전·D1 migration 상태 재확인. 원격 D1에는 `0003_public_content_revision.sql`만 미적용으로 확인됨.
2. 원격 D1에 migration을 **먼저** 적용한 뒤 Worker를 배포한다. 새 테이블/trigger는 기존 버전에도 무해하다. 역순이면 블로그 캐시는 안전하게 우회되어 성능 개선이 적용되지 않는다.
3. `/`, `/blog`, 대표 글 및 의도된 비공개 글 404를 확인한다. 동일 URL·동일 UA에서 `x-seojing-cache: MISS → HIT`, 이미지에서 `x-seojing-image-cache: MISS → HIT`를 확인한다.
4. `wrangler tail`의 CPU, 1102 수와 Cloudflare 10분 집계의 초과율을 비교한다. 목표는 캐시 적중 요청 CPU 10ms 미만, 반복 요청 1102 0건. Chrome Performance를 운영 배포본에서 같은 viewport·캐시 조건으로 다시 측정하고 LCP/CLS/이미지 전송량을 기록한다.
5. 문제 시 이전 Worker 버전 `91165930-ea37-4650-9a86-3d35ce402a14`로 롤백한다. migration은 additive이므로 테이블 삭제는 필요 없다.

로컬 원본 Trace/요약/프리뷰 스크린샷: `.agent-local/perf-1102/` (Git에는 포함하지 않음).

근거: [Cloudflare Workers 한도와 CPU 유예](https://developers.cloudflare.com/workers/platform/limits/), [Error 1102](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1102/), [Chrome Performance 패널](https://developer.chrome.com/docs/devtools/performance/), [Web Vitals 기준](https://web.dev/articles/vitals).
