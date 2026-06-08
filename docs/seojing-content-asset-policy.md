# SEOJing content image asset policy

작성일: 2026-06-08
관련 티켓: local #63 / kanban t_4e165272
상태: Phase 2+ 적용 기준

## 1. 결정 요약

SEOJing 글 본문에서 직접 관리하는 이미지는 Cloudflare public front가 그대로 서빙할 수 있는 정적 파일로 둔다. 원본 MDX 경로와 canonical post URL은 바꾸지 않고, 이미지만 `apps/web/public/images/content/**` 아래에 둔다.

- 새 블로그/스터디/okayJing 본문 이미지는 `apps/web/public/images/content/<content-section>/<post-slug>/`에 저장한다.
- MDX에서는 항상 절대 public path인 `/images/content/<content-section>/<post-slug>/<file>`로 참조한다.
- 파일명은 ASCII kebab-case와 역할 suffix를 사용한다.
- 모든 본문 이미지는 `alt`를 필수로 두고, 장식 이미지가 아니라면 `caption` 또는 markdown image title을 함께 둔다.
- OG/RSS/sitemap 대표 이미지는 본문 이미지와 구분해서 frontmatter `image` object로 선언할 수 있게 한다. 기존 `ContentFrontmatter` 타입에는 아직 반영하지 않고, D1은 정책/검증 스크립트까지 확정한다.
- `/_vinext/image` 같은 런타임 최적화 URL은 산출물/캐시 경로로만 보고, MDX 원본에는 쓰지 않는다.

## 2. 저장 위치

### 2.1 새 기본 경로

```text
apps/web/public/images/content/<content-section>/<post-slug>/<file>
```

예시:

```text
apps/web/content/okayJing/workflow/forum-tickets-hermes-gateway.mdx
apps/web/public/images/content/okayjing/forum-tickets-hermes-gateway/forum-thread-map-01.png

apps/web/content/study/backend/day8.mdx
apps/web/public/images/content/study-backend/day8/request-flow-01.png

apps/web/content/SEOJing/cloudflare-workers-fs-issue.mdx
apps/web/public/images/content/seojing/cloudflare-workers-fs-issue/workerd-error-01.png
```

### 2.2 `content-section` 값

| MDX 위치                     | image section     |
| ---------------------------- | ----------------- |
| `content/okayJing/**`        | `okayjing`        |
| `content/study/backend/**`   | `study-backend`   |
| `content/study/clab-26-1/**` | `study-clab-26-1` |
| `content/SEOJing/**`         | `seojing`         |
| `content/spot/**`            | `spot`            |
| `content/kd-team/**`         | `kd-team`         |

기존 `/images/study/**`, `/images/profile.jpg` 같은 legacy asset은 즉시 이동하지 않는다. 새 글과 큰 수정이 들어가는 글부터 위 경로를 적용한다.

## 3. 파일명 규칙

형식:

```text
<semantic-name>-<nn>.<ext>
<semantic-name>-<variant>-<nn>.<ext>
```

규칙:

- 허용 문자: `a-z`, `0-9`, hyphen(`-`)만 사용한다.
- 공백, 한글, 대문자, underscore, 날짜 dump 이름, 메신저 원본 이름은 금지한다.
- `nn`은 같은 글 안에서 의미 단위별 순번이며 `01`, `02`처럼 2자리로 쓴다.
- 확장자는 `png`, `jpg`, `jpeg`, `webp`, `svg`, `gif` 중 하나만 허용한다.
- 스크린샷/다이어그램은 기본 `png` 또는 `webp`, 사진은 `jpg`/`webp`, 벡터 다이어그램은 `svg`를 우선한다.
- 원본 보관이 필요하면 repo public asset에 넣지 말고 별도 작업 폴더나 source archive에 둔다. public에는 웹에 노출할 최종본만 둔다.

좋은 예:

```text
request-flow-01.png
worker-proxy-boundary-01.svg
admin-dashboard-empty-state-01.webp
```

나쁜 예:

```text
KakaoTalk_20260321_152754728.png
스크린샷 2026-06-08 오후 3.12.00.png
image_final_FINAL.png
```

## 4. MDX 사용 규칙

### 4.1 기본: `ArticleImage`

캡션이 필요한 본문 이미지는 `ArticleImage`를 기본으로 쓴다.

```mdx
<ArticleImage
  src="/images/content/okayjing/forum-tickets-hermes-gateway/forum-thread-map-01.png"
  alt="Discord Forum thread와 hermes-ticket이 같은 작업 단위를 가리키는 구조"
  caption="Forum thread는 사람이 읽는 작업 단위, hermes-ticket은 로컬 실행 상태를 남기는 단위로 둔다."
/>
```

`alt` 작성 기준:

- 이미지를 보지 못해도 본문 논리를 따라갈 수 있게 쓴다.
- `이미지`, `스크린샷`, `그림`만 쓰지 않는다.
- 코드/터미널 스크린샷은 핵심 상태나 에러 메시지를 요약한다.
- 장식용 이미지는 가능하면 본문 MDX에 넣지 않는다. 꼭 필요하면 `alt=""`를 허용하되 `data-decorative="true"`를 같이 둔다.

`caption` 작성 기준:

- 본문이 이미 설명한 내용을 반복하지 말고, 이미지가 증거/맥락으로 하는 역할을 쓴다.
- 출처가 외부이면 caption 끝에 출처를 명시한다.
- UI 캡처는 시점이나 화면 상태가 중요하면 함께 적는다.

다이어그램/설명용 이미지 추천 템플릿:

```mdx
<ArticleImage
  src="/images/content/<section>/<post-slug>/<semantic-name>-01.svg"
  alt="핵심 객체 A가 중간 단계 B를 거쳐 결과 C로 이어지는 구조를 보여주는 다이어그램"
  caption="이 그림은 본문에서 설명한 판단 기준을 한 화면에 묶어, 독자가 다음 절의 코드/흐름을 따라가기 전에 전체 구조를 먼저 잡게 한다."
/>
```

`alt`에는 이미지 안의 모든 글자를 옮기기보다 “무엇이 어떻게 연결되는지”를 쓰고,
`caption`에는 그 그림을 왜 그 위치에서 봐야 하는지를 쓴다.

### 4.2 Markdown image 허용 범위

간단한 이미지에는 markdown image도 허용한다. 이때 title을 caption 후보로 취급한다.

```mdx
![Worker proxy가 허용된 API만 Mac mini origin으로 넘기는 구조](/images/content/seojing/macmini-boundary/proxy-flow-01.svg "Worker proxy allowlist")
```

caption이 필요한 글에서는 `ArticleImage`가 더 명확하다.

## 5. Frontmatter 대표 이미지 convention

현재 런타임 `ContentFrontmatter`는 `title`, `date`, `tags`, `description`만 공식 필드로 읽는다. Phase 2 이후 대표 이미지/OG 이미지를 글별로 지정해야 하면 아래 object 형태로 확장한다.

```yaml
---
title: "예시 글"
date: "2026-06-08"
tags: ["SEOJing", "assets"]
description: "이미지 asset 규칙 예시"
image:
  src: "/images/content/seojing/example/og-01.png"
  alt: "예시 글의 대표 다이어그램"
  caption: "선택: 본문에서 같은 이미지를 사용할 때 표시할 설명"
  width: 1200
  height: 630
---
```

규칙:

- `image.src`는 `/images/content/**` 또는 전역 브랜드 asset(`/logo.png` 등)만 허용한다.
- `image.alt`는 필수다. OG 이미지만 쓰더라도 접근성/메타데이터 fallback을 위해 비워두지 않는다.
- `image.width`/`image.height`는 대표 이미지/OG용으로 가능하면 명시한다.
- 대표 이미지가 없으면 기존 site-level OG fallback을 사용한다. 빈 문자열이나 깨진 경로를 넣지 않는다.

이 convention은 sitemap/RSS/canonical URL을 바꾸지 않는다. RSS/OG가 이미지를 사용하게 되는 후속 구현에서도 `absoluteUrl(image.src)`처럼 현재 site origin에서만 파생해야 한다.

## 6. Cloudflare Images / Vinext image 경로 구분

| 구분                 | 원본 MDX에서 사용 | 역할                                                 |
| -------------------- | ----------------- | ---------------------------------------------------- |
| `/images/content/**` | 예                | 사람이 관리하는 정적 본문/대표 이미지 canonical path |
| `/images/study/**`   | legacy만          | 기존 스터디 이미지. 새 글에서는 content 경로로 이동  |
| `/logo.png` 등 전역  | 제한적 예         | 브랜드/프로필처럼 글 소유가 아닌 전역 asset          |
| `/_vinext/image/**`  | 아니오            | 런타임/빌드 산출 최적화 URL. MDX 원본에 쓰지 않음    |
| 외부 URL             | 예외              | 외부 출처가 필요한 경우 caption에 출처를 명시        |

정적 asset path는 Cloudflare Worker가 Mac mini 없이도 응답해야 한다. 이미지 워크플로우는 글 slug, canonical post URL, sitemap/RSS URL을 바꾸지 않는다.

## 7. 검증 규칙

`pnpm --filter @app/web run check:content-assets`는 다음을 확인한다.

- MDX의 new-convention local image path(`/images/content/**`)가 `apps/web/public` 아래 실제 파일을 가리키는지
- legacy local image path의 파일 누락/경로 이탈은 warning으로 남기는지
- local image path가 `/_vinext/image` 같은 런타임 산출 경로를 쓰지 않는지
- `ArticleImage`와 markdown image의 `alt`가 비어 있지 않은지
- `ArticleImage`에 caption이 없으면 warning으로 남기는지
- frontmatter `image` object가 생겼을 때 `src`/`alt`/파일 존재 여부를 확인할 수 있는지
- 새 convention 경로가 아닌 legacy local image path는 warning으로 남겨 점진 이동 대상으로 볼 수 있는지

D1에서는 warning을 실패로 처리하지 않는다. Phase 2에서 신규 글 생성/수정 자동화가 안정화되면 `--strict` 모드를 추가해 새/변경 파일에만 warning을 실패로 승격한다.

## 8. D2 이미지 삽입 CLI

이미지를 수동으로 복사하고 MDX 경로를 직접 맞추는 대신 `asset:insert` CLI를 쓴다.

```bash
pnpm --filter @app/web run asset:insert -- \
  --mdx apps/web/content/okayJing/workflow/forum-tickets-hermes-gateway.mdx \
  --source ~/Desktop/forum-map.png \
  --name forum-thread-map \
  --alt "Forum thread와 hermes-ticket이 같은 작업 단위를 가리키는 구조" \
  --caption "Forum thread는 사람이 읽는 작업 단위, hermes-ticket은 실행 상태를 남기는 단위로 둔다."
```

동작:

- MDX 파일 위치에서 `content-section`을 추론한다.
- 이미지를 `apps/web/public/images/content/<section>/<post-slug>/<semantic-name>-NN.<ext>`로 복사한다.
- MDX에는 `/images/content/<section>/<post-slug>/<file>` public path를 쓰는 `ArticleImage`를 삽입한다.
- `<!-- asset:insert -->` marker가 있으면 그 위치에 삽입하고, 없으면 `--after-heading`, `--after-line`, 또는 파일 끝에 삽입한다.
- 실제 반영 전에는 `--dry-run`으로 생성 경로와 MDX snippet을 확인할 수 있다.

지원 옵션은 다음 명령으로 확인한다.

```bash
pnpm --filter @app/web run asset:insert -- --help
```

## 9. 작업 체크리스트

새 글에 이미지를 추가할 때:

- [ ] post slug를 먼저 정한다.
- [ ] `apps/web/public/images/content/<section>/<post-slug>/`를 만든다.
- [ ] 원본 파일명을 semantic kebab-case + 2자리 순번으로 바꾼다.
- [ ] MDX에서는 `/images/content/<section>/<post-slug>/<file>`로 참조한다.
- [ ] `alt`를 먼저 쓰고, 본문 설명이 부족하면 `caption`을 추가한다.
- [ ] 대표 이미지가 필요한 경우 frontmatter `image` object convention을 따른다.
- [ ] `pnpm --filter @app/web run check:content-assets`를 실행한다.
- [ ] content-only 변경이면 `pnpm exec prettier --check <touched-files>` 또는 `pnpm format:check`로 포맷을 확인한다.
