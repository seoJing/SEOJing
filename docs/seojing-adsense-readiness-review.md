# SEOJing AdSense policy/traffic readiness review

작성일: 2026-06-08 11:31 KST
관련 티켓: local #74 / kanban t_6d399752
범위: AdSense 승인 요건, 개인정보/쿠키 고지, 기술 블로그 UX/트래픽 리스크 검토

## 결론

현재 SEOJing은 공개 도메인, 색인 표면, 콘텐츠 양 측면에서는 AdSense 신청 전 기반이 상당히 준비되어 있다. 다만 AdSense 신청 또는 광고 코드 삽입 전에는 `privacy` 문서/route와 AdSense 쿠키 고지를 먼저 추가해야 한다. 또한 현재 공개 사이트에서 `/ads.txt`, `/privacy`, `/api/analytics/events`, `/api/rag/query`가 404이므로, 광고 실험 전에는 정책 문서와 실제 배포 surface를 맞추는 작업이 필요하다.

권장 판정:

- AdSense 계정/사이트 검토 신청: 보류. privacy/cookie 고지와 사이트 기본 UX 문구 정리 후 신청.
- 광고 코드 삽입: 보류. #75 저간섭 광고 실험 계획이 먼저 필요.
- 콘텐츠/SEO readiness: 부분 준비됨. `https://seojing.com`, `/robots.txt`, `/sitemap.xml`, RSS/llms surface는 존재한다.
- 개인정보/쿠키 readiness: 미충족. privacy route가 없다.
- 트래픽 readiness: 측정 계획은 설계되어 있으나, 공개 배포 collect route는 아직 연결되지 않았다.

## 확인한 정책 기준

Google AdSense 고객센터 기준으로 확인한 요구사항:

1. 자격 요건
   - 자체 콘텐츠가 있어야 하며, 콘텐츠는 품질이 높고 독창적이어야 한다.
   - 사이트 HTML 소스 코드에 접근 가능해야 한다.
   - Google 프로그램 정책을 준수해야 한다.
   - 만 19세 이상 계정이어야 한다.
   - Source: https://support.google.com/adsense/answer/9724?hl=ko

2. 프로그램 정책
   - 무효 클릭/노출을 인위적으로 만들면 안 된다.
   - 광고 클릭/조회 유도, 사용자를 현혹하는 배치, 광고 옆 오인 유도 이미지는 금지된다.
   - Source: https://support.google.com/adsense/answer/48182?hl=ko

3. 게시자 정책
   - 불법 콘텐츠, 저작권 침해, 위험하거나 악의적인 콘텐츠 등 정책 위반 콘텐츠에 광고를 붙이면 안 된다.
   - 행동 정책과 개인정보 보호 관련 정책도 함께 적용된다.
   - Source: https://support.google.com/adsense/answer/1348688?hl=ko

4. 필수 개인정보처리방침/쿠키 고지
   - Google 및 서드파티 공급업체가 쿠키를 사용해 사용자의 이전 방문 기록 기반 광고를 게재할 수 있음을 privacy policy에 명시해야 한다.
   - Google 광고 쿠키 사용과 개인 맞춤 광고 거부 방법을 안내해야 한다.
   - 서드파티 공급업체/광고 네트워크가 사이트 광고에 쿠키를 사용할 수 있음을 알리고, 가능한 경우 opt-out 방법을 안내해야 한다.
   - Source: https://support.google.com/adsense/answer/1348695?hl=ko

## 현재 SEOJing 상태 증거

### 공개 사이트

실행 증거:

```text
curl -I https://seojing.com/      -> HTTP/2 200
curl -I https://seojing.com/blog  -> HTTP/2 200
curl https://seojing.com/robots.txt
  User-Agent: *
  Allow: /
  Sitemap: https://seojing.com/sitemap.xml
  Host: https://seojing.com
curl https://seojing.com/sitemap.xml -> XML 반환, loc가 https://seojing.com 기반
```

현재 앱 설정:

- `apps/web/src/shared/config/site.ts`: canonical origin `https://seojing.com`
- `apps/web/src/app/robots.ts`: 전체 허용 + sitemap + host 제공
- `apps/web/src/app/sitemap.ts`, `rss.xml/route.ts`, `llms.txt/route.ts` 존재

### 콘텐츠

로컬 콘텐츠 수:

```text
total_mdx 132
by_root {'SEOJing': 35, 'kd-team': 6, 'okayJing': 48, 'resume.mdx': 1, 'spot': 7, 'study': 35}
```

AdSense 관점에서는 “빈 사이트” 리스크는 낮다. 다만 루트 홈의 소개 문구가 아직 `뭐 이런 저런 내용`처럼 임시 문구라서, 신청 전에는 사이트 목적/운영자/블로그 성격을 명확히 드러내는 문구로 정리하는 편이 안전하다.

### privacy / cookie / ads.txt route

실행 증거:

```text
https://seojing.com/privacy        -> 404
https://seojing.com/privacy-policy -> 404
https://seojing.com/terms          -> 404
https://seojing.com/ads.txt        -> 404
```

판정:

- AdSense 신청 전 blocking risk.
- 특히 SEOJing은 article analytics, Q&A log UX, 향후 광고 쿠키가 결합될 수 있으므로 privacy 문서가 반드시 필요하다.
- `ads.txt`는 승인 전 필수는 아니지만, 승인/게시자 ID 확보 직후 추가할 수 있도록 route 또는 public asset 전략을 준비해야 한다.

### analytics / Q&A 수집면

관련 구현/문서:

- `docs/seojing-analytics-event-taxonomy-privacy.md`
- `docs/seojing-analytics-ingestion-storage-api.md`
- `apps/web/src/widgets/article-analytics/useArticleAnalytics.ts`
- `apps/web/src/shared/analytics/analytics-ingestion.ts`
- `apps/web/src/shared/analytics/analytics-collect-api.ts`
- `apps/web/scripts/analytics-origin-server.ts`
- `apps/web/src/app/api/rag/query/route.ts`

긍정적 요소:

- `sessionStorage` 기반 익명 세션 id, 24시간 회전.
- Do Not Track 또는 `seojing_analytics_opt_out=true`면 collect 호출 중단.
- payload allowlist와 forbidden field reject가 있음: `ip`, `user_agent`, `email`, `name`, `token`, `secret`, `question`, `answer`, `copied_code` 등.
- Q&A analytics는 raw question/answer 대신 `question_length_bucket`, action만 이벤트화.

리스크:

```text
https://seojing.com/api/analytics/events -> 404
https://seojing.com/api/rag/query        -> 404
```

- 클라이언트는 `/api/analytics/events`로 이벤트를 보내도록 되어 있지만, 공개 배포 route는 아직 없다.
- `apps/web/src/app/api/rag/query/route.ts`는 로컬 tree에 있으나 공개 사이트에서는 404였다. Vinext/Cloudflare 배포 surface 또는 route support가 실제 배포와 다를 수 있다.
- AdSense 자체 리스크라기보다, #75 광고 실험에서 “광고 전후 체류/이탈 비교”를 하려면 먼저 수집 경로가 실제 배포에서 동작해야 한다.

## AdSense readiness checklist

| 항목                    | 상태         | 근거/메모                                                                             |
| ----------------------- | ------------ | ------------------------------------------------------------------------------------- |
| 소유 도메인/canonical   | Pass         | `https://seojing.com` 200, `siteConfig.origin` 일치                                   |
| robots/sitemap          | Pass         | `/robots.txt`, `/sitemap.xml` 정상 응답                                               |
| 콘텐츠 양               | Pass         | MDX 132개, study/okayJing/SEOJing 등 다수                                             |
| 독창 콘텐츠             | Mostly pass  | 자체 학습/운영 글 중심. 다만 외부/팀 자료의 저작권 문맥은 광고 적용 전 샘플 검토 권장 |
| 사이트 소개/운영자 신뢰 | Needs polish | 홈에 임시 문구 존재. 운영자/블로그 목적/연락 경로 강화 필요                           |
| 개인정보처리방침        | Fail         | `/privacy`, `/privacy-policy` 404                                                     |
| 광고 쿠키 고지          | Fail         | AdSense 필수 콘텐츠 문구 미반영                                                       |
| opt-out 설명            | Partial      | 코드에는 DNT/opt-out 처리 존재, 사용자가 조작할 UI/문서 route는 없음                  |
| ads.txt                 | Not ready    | `/ads.txt` 404. 게시자 ID 확보 후 추가 필요                                           |
| 무효 클릭 방지 UX       | Needs plan   | 광고 코드 없음. #75에서 광고 위치/간격/라벨/자체 클릭 방지 기준 필요                  |
| 트래픽 측정             | Partial      | taxonomy/storage 설계와 코드 일부 있음, 공개 collect route 404                        |

## 신청 전 최소 조치

1. `/privacy` route 추가
   - analytics 수집 항목: 익명 session id, content slug, section id, event type, coarse viewport/referrer/device class.
   - 저장하지 않는 값: raw IP, raw UA, email/name/token/secret, raw Q&A question/answer, copied code.
   - DNT와 opt-out key 설명.
   - 향후 AdSense 활성화 시 Google/서드파티 쿠키와 개인 맞춤 광고 opt-out 안내.

2. footer/header에 privacy 링크 추가
   - AdSense reviewer와 방문자가 쉽게 접근 가능해야 한다.

3. 홈/소개 문구 정리
   - `SEOJing에 오신 것을 환영합니다!`, `뭐 이런 저런 내용`을 운영 목적/대상 독자/콘텐츠 범위 설명으로 교체.

4. 광고 배치 전 UX 원칙 문서화
   - 광고 클릭 유도 금지.
   - 콘텐츠와 광고가 구분되는 간격/라벨.
   - 코드블록, Q&A 입력창, 목차/툴바 근처에는 오클릭 위험이 있으므로 초기 실험에서 제외.
   - 모바일 첫 화면 상단 과밀 배치 금지.

5. #75 실험 전에 측정 경로를 실제 배포 기준으로 확정
   - `/api/analytics/events` 또는 Worker/Mac mini proxy가 공개 도메인에서 2xx/202를 반환해야 한다.
   - 광고 전 baseline: post_view, scroll_depth, section_engagement, QA/button interaction 정도.
   - 광고 후 비교: scroll depth 50/75/90, section heartbeat, Q&A submit, code_copy, bounce proxy.

6. 승인 후 `ads.txt` 추가
   - AdSense에서 제공하는 정확한 publisher id 확보 후 `google.com, pub-..., DIRECT, f08c47fec0942fa0` 형식으로 추가.
   - publisher id를 모르는 상태에서는 placeholder `ads.txt`를 배포하지 않는다.

## #75 저간섭 광고 실험에 넘길 기준

초기 광고 실험은 “수익 최적화”보다 “학습 경험 손상 방지”를 우선한다.

권장 초기 후보:

- 데스크톱: 글 본문 시작 전이 아니라 첫 번째 의미 섹션 이후 또는 글 하단 부근 1개.
- 모바일: viewport 내 CTA/입력/코드복사 버튼 주변 제외, 글 하단 1개부터.
- 제외 위치: Q&A textarea/button 주변, 코드블록 copy button 주변, sticky header 바로 아래, 목차 점프 링크 사이.
- 라벨: 광고 영역임을 명확히 표시.
- kill switch: env/config flag로 전체 광고 비활성화 가능해야 함.

실험 지표:

- 광고 전/후 `scroll_depth` 50/75/90 도달률.
- `section_engagement` heartbeat/leave 비율.
- Q&A submit 또는 answer_shown 비율.
- code_copy 이벤트 비율.
- Core Web Vitals/LCP/CLS 수동 확인. 광고 placeholder가 레이아웃 shift를 만들면 실패.

## 최종 판정

H1 readiness 검토 결과, SEOJing은 AdSense 신청을 위한 콘텐츠/도메인 기반은 갖췄지만 privacy/cookie 고지와 배포된 수집면 정리가 먼저다. 즉시 광고 코드 삽입 또는 신청으로 가지 말고, privacy route + footer link + 홈 소개 정리 + 공개 analytics route 결정 후 #75에서 저간섭 광고 실험 계획을 세우는 순서가 맞다.
