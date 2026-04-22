# week9 대면 "바이브코더가 모르는 웹 보안" — 사전 조사 자료

> 용도: week9 대면 자료 작성 시 `study-curriculum-planner` 에이전트와 `post-writer`가 참조.
> 독자 전제: React 미경험자, JS는 week9 시점 5주차째 학습 중. 씨앗 심기 톤.
> week5 대면 복선: "친구가 AI로 만든 웹 게임이 5분 만에 뚫림" 사례.

---

## 0. 오프닝 훅 재료 (숫자 3개)

- **Veracode 2025 GenAI Code Security Report** — AI 생성 코드의 **45%가 OWASP Top 10 취약점**. XSS는 **12~13%만 안전**. JS 38~45% 실패.
- **Stanford (Perry et al., 2022)** — AI 도구 사용자가 **보안 정답률 67% vs 대조군 79%**, 그런데 자기가 더 안전하다고 믿음 (자신감 역설).
- **Lovable 사고 (2025~2026)** — 단일 앱 16개 취약점, 18,697명 레코드 노출. 1,645개 샘플 중 **170개가 개인정보 공개 접근 가능, 70% RLS 비활성화**.

---

## 1. XSS (크로스 사이트 스크립팅)

**한 줄**: 남의 브라우저에서 내가 원하는 JS가 실행되게 만드는 공격. HTML에 문자열을 꽂을 때 발생.

**바이브코더 포인트**

- AI가 만든 React 코드에서 `dangerouslySetInnerHTML` 아무렇지 않게 등장.
- "내 앱은 혼자 쓰니까 괜찮아"의 허구 — 저장형 XSS는 한 명의 입력이 모든 방문자에서 실행.
- Snyk Labs 실험: 프롬프트에 "sanitize" 안 쓰면 Copilot이 기본으로 취약 코드 생성.

**사례**

- **Samy Worm (MySpace, 2005)** — 19살 Samy Kamkar가 프로필에 XSS, 20시간 만에 **100만+ 계정 감염**. OWASP AntiSamy 탄생.
- **360XSS Campaign (2024)** — Krpano 취약점으로 **미 주정부·대학·Fortune 500 포함 350+ 사이트** 감염.
- **LiteSpeed Cache WordPress (2024.09)** — 수백만 사이트 영향.
- **GitLab 고-심각도 XSS (2024)** — 미인증 공격자가 계정 탈취.

**방어 감각**

- React `dangerouslySetInnerHTML` 즉시 경계.
- DOMPurify가 사실상 표준 — 주당 **2,400만~3,700만 다운로드**.
- `innerHTML = userInput` 금지, `textContent` 사용.
- React 기본은 XSS 안전. 예외 3가지: `dangerouslySetInnerHTML`, `href={userUrl}` (javascript: 스킴), `eval`/`Function`.

**출처**

- https://owasp.org/www-community/attacks/xss/
- https://snyk.io/blog/github-copilot-xss-react/
- https://arxiv.org/html/2310.02059v3
- https://en.wikipedia.org/wiki/Samy_(computer_worm)
- https://github.com/cure53/DOMPurify
- https://pragmaticwebsecurity.com/articles/spasecurity/react-xss-part2.html

---

## 2. CSRF

**한 줄**: 로그인된 채로 악성 사이트를 열면, 브라우저가 쿠키를 싣고 내 계좌로 요청을 쏘는 공격.

**바이브코더 포인트**

- "API는 내 프론트만 호출할 거"라는 믿음 — 브라우저는 요청 출처를 기본적으로 구분 안 함.
- Chrome 80(2020)부터 쿠키 기본 `SameSite=Lax`로 장벽 ↑. 하지만 `SameSite=None` 명시하면 다시 취약.
- GET으로 상태 변경하는 API(`/delete?id=...`)는 즉사 패턴.

**사례**

- **ING Direct (2008)** — CSRF로 SSL 로그인 사용자 계좌에서 타행 이체.
- **YouTube (2008)** — 거의 모든 유저 액션을 공격자가 대신 수행 가능.
- **Twitter CSRF 웜 (2010)** — anti-CSRF 미비로 수만 명 감염.
- **Zimbra (CVE-2025-32354)** — GraphQL CSRF, **20만+ 조직 위험**.
- **Jenkins (CVE-2025-27624)** — 프로필 임의 식별자 주입.

**방어 감각**

- 쿠키 `SameSite=Lax`(기본) 또는 `Strict`.
- 상태 변경은 POST/PUT/DELETE.
- CSRF 토큰 또는 double-submit cookie.
- CORS는 CSRF 방어가 **아님**.

**출처**

- https://en.wikipedia.org/wiki/Cross-site_request_forgery
- https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/CSRF
- https://developers.google.com/search/blog/2020/01/get-ready-for-new-samesitenone-secure

---

## 3. 토큰/세션 보관 (localStorage vs HttpOnly 쿠키)

**한 줄**: 토큰을 어디 두느냐로 "XSS 한 방에 끝"이냐 "한 단계 더 버티냐"가 갈린다.

**바이브코더 포인트**

- AI 인증 코드 90%가 `localStorage.setItem('token', …)` — 입문 튜토리얼 문법이 학습됐기 때문.
- localStorage는 **모든 JS가 읽을 수 있음**. XSS 1줄 = 토큰 탈취 = 계정 장악.
- HttpOnly 쿠키는 JS에서 못 읽음.
- 모범답: **access token = 메모리(React state), refresh token = HttpOnly·Secure·SameSite 쿠키**.

**사례**

- **ua-parser-js (2021.10)** — 공급망 공격으로 **Chrome 쿠키·패스워드** 탈취, Facebook도 영향. 주당 700만 다운로드.
- **Moltbook** — Supabase RLS 미설정으로 **API 토큰 150만 개, 이메일 3만 개** 유출.

**방어 감각**

- "localStorage에 토큰 = XSS = Game Over" 한 줄 공포.
- 세션 쿠키 3종 세트: `HttpOnly`, `Secure`, `SameSite=Lax|Strict`.

**출처**

- https://dev.to/cotter/localstorage-vs-cookies-all-you-need-to-know-about-storing-jwt-tokens-securely-in-the-front-end-15id
- https://pragmaticwebsecurity.com/articles/oauthoidc/localstorage-xss.html
- https://snyk.io/blog/a-post-mortem-of-the-malicious-event-stream-backdoor/

---

## 4. 클라이언트 사이드 로직 노출 (week5 복선 회수)

**한 줄**: 브라우저에 내려간 JS는 **전부 사용자의 것**. 신뢰할 수 있는 경계선은 서버뿐.

**바이브코더 포인트**

- AI가 짜준 게임/쇼핑 로직이 클라에서 "점수 계산"·"할인 적용"·"결제 금액" 다 함.
- 소스맵(.map) 배포 실수로 원본 TS/TSX 복원.
- 전역 노출: `window.gameState`, `window.submitScore` 같은 디버깅용 함수를 배포.
- Next.js에서 `NEXT_PUBLIC_` 접두사로 서버 시크릿을 잘못 넣으면 번들에 박제.

**사례**

- **Cookie Clicker** — `Game.cookies = Infinity` 한 줄 치트. 입문 교재로 완벽.
- **Claude Code 소스맵 유출 (2026.03)** — Anthropic이 npm v2.1.88에 **59.7MB 소스맵** 포함 배포. TS 1,884개·64,464줄 원본 노출. 원인: Bun 기본값이 소스맵 ON.
- **Apple App Store 웹 (2025.11)** — 런칭 몇 시간 만에 sourcemap으로 프론트엔드 전체 코드 추출. Escape DAST 조사 기업의 **70%에서 동일 이슈**.
- **Prodefense 사례** — 소스맵 복원 번들에서 **하드코딩된 Stripe 시크릿 키** 발견.
- **xAI GitHub 커밋 API 키 노출 (2025.05)** — 비공개 SpaceX/Tesla LLM 접근 키가 공개 레포에.
- **$3,000 청구서 사례** — 프론트 번들의 AWS 키로 5만 유저 호출.

**방어 감각**

- "서버가 검증 안 하는 것은 검증 안 된 것이다."
- 배포 빌드에서 소스맵 public 노출 금지. `productionBrowserSourceMaps: false`(Next.js 기본).
- 시크릿은 **프론트에 오면 이미 시크릿이 아님**.
- `window.x = …` 디버깅용 전역 노출은 커밋 전 삭제.

**출처**

- https://blog.sentry.security/abusing-exposed-sourcemaps/
- https://breached.company/claude-code-source-map-leak-anthropic-2026/
- https://escape.tech/blog/apple-app-store-source-map-leak/
- https://krebsonsecurity.com/2025/05/xai-dev-leaks-api-key-for-private-spacex-tesla-llms/
- https://cookieclicker.fandom.com/wiki/Cheating
- https://dev.to/trulyfurqan/how-i-hacked-cookie-clicker-game-with-inspect-element-cd8

---

## 5. 의존성 공급망 보안

**한 줄**: `npm install` 한 번에 내 앱은 수백 명 낯선 사람의 코드를 실행한다.

**바이브코더 포인트**

- AI가 "이 라이브러리 써보세요"에 검증 없이 설치.
- 평균 프로젝트: 직접 의존성 79개 / 취약점 49개 (Snyk 2024).
- 2023→2024 보안 도구 도입 **11.3% ↓**, 교육 투자 **17.8% ↓** (역주행).

**사례 (타임라인)**

- **event-stream (2018.11)** — 새 메인테이너가 악성 의존성 추가. **Copay 비트코인 지갑** 대상, 2.5개월 미탐지, 주당 800만 다운로드.
- **ua-parser-js (2021.10)** — 주당 700만 다운로드. XMRig 채굴기 + 크롬 쿠키·패스워드 스틸러.
- **Polyfill.io (2024.06)** — 중국 Funnull이 도메인/GitHub 인수 후 악성 JS 주입. **10만+ 사이트**, 38만+ 호스트. 북한 연계 보도.
- **CosmicSting / Magento (2024)** — Magecart 대규모 악용, 패치 1주 후에도 75% 미패치. Cisco 굿즈 스토어 피해.
- **Qix 피싱 (2025.09)** — `debug`, `chalk` 등 18개 패키지, **주당 26억+ 다운로드 영향**. 브라우저 크립토 지갑 드레이너.
- **Shai-Hulud 웜 (2025.09)** — npm 최초 자가 복제 웜, 500+ 패키지. 11월 2.0은 **GitHub 25,000+ 리포** 확산.
- **axios 공급망 공격 (2026.03)** — 북한 UNC1069 연결, 크로스플랫폼 RAT 주입.
- **CISA Alert (2025.09)** — 공식 경보: npm 생태계 광범위 침해.

**방어 감각**

- `npm audit`, GitHub Dependabot 기본 ON.
- 설치 전: 주간 다운로드·마지막 커밋·메인테이너 수 확인.
- lockfile 커밋, 버전 핀.
- "누가 이걸 관리하는가"를 본다.

**출처**

- https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident
- https://arcticwolf.com/resources/blog/polyfill-supply-chain-attack-impacts-100k-sites/
- https://unit42.paloaltonetworks.com/npm-supply-chain-attack/
- https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem
- https://snyk.io/blog/2024-open-source-security-report-slowing-progress-and-new-challenges-for/

---

## 6. 바이브 코딩 최신 동향

**한 줄**: "vibe coding" = 2025.02 Andrej Karpathy가 만든 용어. "코드가 존재한다는 사실을 잊고 LLM 출력에 몸을 맡기는 개발 방식."

**바이브코더 포인트**

- AI는 "작동"으로 reward된 모델. 보안은 프롬프트에 명시 안 하면 기본값 없음.
- 입문자일수록 리뷰 단계에서 취약점 못 잡음 (Stanford 자신감 역설).
- GitHub Copilot 코드 리뷰가 XSS 파일 9개 중 6개에 아무 지적 안 함.
- **프롬프트 인젝션의 새 차원**: Cursor + Supabase MCP에서 고객지원 티켓에 숨긴 명령으로 `integration_tokens` 테이블 유출 가능.

**사례**

- **Karpathy 트윗(2025.02)** — 용어 탄생.
- **Lovable 연쇄 사고** — 2025.02 18,697명 노출 → 2025.05 170개 앱 RLS 없음 → 2026.02~04 BOLA로 2025.11 이전 프로젝트 모두 접근 가능. Uber·Zendesk·Deutsche Telekom도 사용.
- **Stanford (Perry et al., 2022, NeurIPS/CCS)** — AI 사용자 67% vs 대조 79%, 자신감 역설.
- **Copilot 실증 (arXiv 2310.02059)** — 733 스니펫 중 JS 24.2%, XSS 86%.
- **Veracode (2025.07)** — 45% 실패율. GPT-5 Mini 72%.
- **Supabase MCP 프롬프트 인젝션** — 공격 경로가 "코드"가 아니라 "티켓 본문".

**방어 감각**

- "AI 코드는 시니어 코드가 아니라 **낯선 인턴 코드**로 리뷰한다."
- 인증/인가·입력 sanitize·시크릿 위치 3가지는 사람이 반드시 확인.
- RLS·정책은 AI가 기본값으로 안 넣음. 체크리스트화.

**출처**

- https://en.wikipedia.org/wiki/Vibe_coding
- https://www.veracode.com/resources/analyst-reports/2025-genai-code-security-report/
- https://ee.stanford.edu/dan-boneh-and-team-find-relying-ai-more-likely-make-your-code-buggier
- https://arxiv.org/html/2310.02059v3
- https://www.theregister.com/2026/02/27/lovable_app_vulnerabilities/
- https://generalanalysis.com/blog/supabase-mcp-blog

---

## 7. 브라우저 개발자 도구 5분 투어 (대면 시연 재료)

**한 줄**: F12는 "사이트 주인 권한"이 아니라 "내 브라우저 안에서 뭐든 할 수 있는 권한."

**시연 5가지 (입문자용)**

1. **Elements → "Edit as HTML"** — 쇼핑몰 가격 `$1` 바꾸기 (스크린샷 밈). "서버 검증 안 하면 진짜 그 가격" 감각.
2. **Console → 전역 변수** — `Game.cookies = Infinity`, week5 게임 `submitScore(99999)`.
3. **Application → Local Storage** — 토큰이 날것으로. 복사 → Postman에 붙이면 남의 계정 API 호출.
4. **Network 탭** — 요청 URL·헤더·페이로드 전부 보임. "프론트에 숨긴" 로직은 없음.
5. **Sources 탭 → .map 파일** — 소스맵 있으면 난독화 번들이 원본으로 펼쳐짐.

**악용 사례 고리**

- Cookie Clicker 콘솔 치트 (대면에서 실제 시연).
- Prodefense Stripe 시크릿 복원.
- 학원비/쿠폰 사이트 `disabled` 속성 삭제 케이스.

**출처**

- https://developer.chrome.com/docs/devtools
- https://dev.to/trulyfurqan/how-i-hacked-cookie-clicker-game-with-inspect-element-cd8
- https://cookieclicker.fandom.com/wiki/Cheating

---

## 8. CSP (Content Security Policy)

**한 줄**: "이 페이지에선 이 도메인의 스크립트만 실행해라"를 브라우저에 선언.

**바이브코더 포인트**

- AI 빌더 앱은 CSP 헤더 자체가 없거나, 있어도 `unsafe-inline`으로 무효.
- **Web Almanac 2024**: CSP 쓴 사이트의 **91~92%가 `unsafe-inline` 허용**. `nonce` 20%, `strict-dynamic` 9~10%.
- 전체 도입률: 2024 18.5% → 2025 21.9%. **"완벽한" CSP는 2%에 불과**, 실제 배포된 CSP의 **94.72%가 우회 가능**.

**방어 감각**

- 최소 시작점: `default-src 'self'; script-src 'self'`.
- 점진 도입은 `Content-Security-Policy-Report-Only`.
- Google Strict CSP: `strict-dynamic` + `nonce`.

**출처**

- https://almanac.httparchive.org/en/2024/security
- https://almanac.httparchive.org/en/2025/security
- https://csp.withgoogle.com/docs/strict-csp.html

---

## 9. 2024~2026 최신 사고·리포트

### OWASP Top 10 2021 → 2025

- **2021**: A01 Broken Access Control, A02 Crypto, A03 Injection(+XSS), A04 Insecure Design, A05 Security Misconfig, A06 Vulnerable Components, A07 Auth, A08 S/W Integrity, A09 Logging, A10 SSRF.
- **2025**: A01 Broken Access Control(유지), **A02 Security Misconfig(5→2)**, A03 Supply Chain Failures(신설/강조), A04 Crypto, A05 Injection, A06 Insecure Design, A07 Auth, A08 S/W·Data Integrity, A09 Logging & Monitoring, **A10 Mishandling Exceptional Conditions(신설)**.
- 분석 CWE: 400 → 589개. **Supply Chain 명시적 카테고리 승격**이 핵심 변화.

### 국내

- **쿠팡 개인정보 유출 (2024.06 발생, 2025.11 공개)** — **3,370만 계정** 이름/이메일/전화/주소 유출. 활성 유저(2,470만)보다 많음. 공격자: 전 직원. 인증 취약점 악용. 공개 직후 주가 시간외 8%↓.

### Pwn2Own 2024 (브라우저 심각성)

- Vancouver 2024 총상금 **$1,132,500**, 29개 제로데이.
- Safari RCE **$102,500**.
- Chrome/Edge 동시 RCE **$42,500** (Seunghyun Lee — 한국 연구자, CVE-2024-2886).
- "브라우저 엔진도 매년 이 정도 비용으로 털린다."

**출처**

- https://owasp.org/Top10/2025/
- https://equixly.com/blog/2025/12/01/owasp-top-10-2025-vs-2021/
- https://namu.wiki/w/쿠팡%20개인정보%20대규모%20유출%20사건
- https://www.thezdi.com/blog/2024/5/2/cve-2024-2887-a-pwn2own-winning-bug-in-google-chrome

---

## 대면 자료 엮기 제안 (week5 복선 회수 경로)

1. **오프닝 (5분)**: "5주 전 그 게임 기억나?" → Cookie Clicker 실제 F12 시연. `Game.cookies = Infinity`. "이걸 막는 게 오늘 얘기다."
2. **숫자 한 장**: Veracode 45% / Stanford 자신감 역설 / Lovable 170개 앱 — "왜 지금 이걸 배우는가" 3개 숫자 증명.
3. **F12 5분 투어**: Elements 편집 → Console 전역 호출 → Application 토큰 → Network → Sources(.map).
4. **3대 실수**: (a) innerHTML/dangerouslySetInnerHTML, (b) localStorage 토큰, (c) 클라에서 점수 계산.
5. **공급망 스토리**: event-stream(2018) → ua-parser-js(2021) → Polyfill.io(2024) → Qix/Shai-Hulud(2025) 타임라인. "`npm install`은 낯선 사람 500명을 집에 들이는 일."
6. **AI 코딩 경고**: Lovable·Cursor·Supabase MCP 스토리. "AI는 '작동'은 맞추지만 '안전'은 프롬프트에 써야만."
7. **방어 감각 3줄**: 서버가 진실, 입력은 sanitize, 시크릿은 절대 프론트로 내려오지 않는다.
8. **체크리스트**: Dependabot ON · `SameSite=Lax` · HttpOnly 쿠키 · CSP 기본값 · `.map` 배포 제외 · `window.*` 전역 노출 제거.

---

## 우선순위 추천 (대면에서 "꼭 이건 빼놓지 말라")

1. **클라 로직 노출** — week5 복선과 직결, 가장 임팩트 큼
2. **localStorage vs HttpOnly** — 한 줄로 충격 주기 좋음 ("XSS = Game Over")
3. **공급망 타임라인** — 스토리텔링 쉬움, 실무 감각 최강
4. **F12 5분 투어** — 체험 학습 강도
5. **바이브 코딩 숫자 3개** — 오프닝 훅
