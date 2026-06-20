---
version: alpha
name: SEOJing Paper
description: SEOJing의 종이 질감과 OkayJing 로컬 워크스페이스를 함께 쓰는 공유 디자인 시스템.
colors:
  primary: "#25231F"
  secondary: "#777167"
  tertiary: "#2F4F64"
  neutral: "#F0EEE9"
  surface: "#FFFDF8"
  raised: "#FBF6EA"
  success: "#5F7F68"
  warning: "#A66F38"
  danger: "#9D4D55"
typography:
  h1:
    fontFamily: Paperlogy
    fontSize: 2.25rem
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  h2:
    fontFamily: Paperlogy
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body-md:
    fontFamily: A2z
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: A2z
    fontSize: 0.875rem
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: 12px
  md: 16px
  lg: 22px
  xl: 28px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "#FFFDF8"
    rounded: "{rounded.full}"
    padding: 16px
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: 16px
  input-default:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 12px
  card-paper:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    padding: 24px
  select-default:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 12px
  switch-on:
    backgroundColor: "{colors.tertiary}"
    textColor: "#FFFDF8"
    rounded: "{rounded.full}"
  dialog-paper:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.xl}"
    padding: 24px
  file-list-item-active:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 12px
  diff-panel:
    backgroundColor: "#1F211D"
    textColor: "#E8E4D9"
    rounded: "{rounded.lg}"
    padding: 12px
  attachment-card:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 8px
---

## Overview

SEOJing Paper는 SEOJing 블로그의 `cloud-dancer`/`paper-light` 계열을 제품 UI에서도 재사용하기 위한 공유 디자인 시스템이다. 목적은 블로그, OkayJing Local, 실험용 PWA가 같은 종이 질감과 같은 기본 primitive를 쓰게 만드는 것이다.

## Colors

- **Primary / Ink (`#25231F`)**: 제목, 본문, 선택된 tab의 배경처럼 가장 확실한 정보에 쓴다.
- **Secondary / Muted Ink (`#777167`)**: 메타 정보, 보조 설명, 비활성 버튼에 쓴다.
- **Tertiary / Anchor (`#2F4F64`)**: 주요 액션, 링크, 실행 버튼에 쓴다. 기존 SaaS식 파란색을 대체한다.
- **Neutral / Cloud Dancer (`#F0EEE9`)**: 전체 배경. 종이 바탕 역할이다.
- **Surface / Paper (`#FFFDF8`)**: 카드와 대화 bubble.
- **Raised (`#FBF6EA`)**: 입력창, 선택된 목록, 살짝 떠 있는 패널.
- **Success/Warning/Danger**: 상태 pill, 승인 대기, 실패/차단 표시에만 절제해서 쓴다.

## Typography

제목은 Paperlogy, 본문은 A2z를 기본으로 한다. 제품 UI에서는 장문 가독성을 위해 본문 weight를 과하게 올리지 않는다. 작은 label은 A2z 600으로 처리하고, 큰 제목만 Paperlogy를 쓴다.

## Layout

기본 제품 레이아웃은 종이 카드가 겹쳐 있는 느낌을 쓴다.

- 화면 배경은 `cloud-dancer` 기반 radial gradient.
- 패널은 `paper-surface` 80~90% + blur + 얇은 border.
- 주요 앱 화면은 3패널 구조를 기본으로 한다.
- 모바일에서는 rail → content → context 순서로 접힌다.

## Elevation & Depth

그림자는 어둡게 누르지 않고 갈색 기운의 낮은 shadow를 쓴다. 코드/diff panel은 예외적으로 어두운 ink surface를 사용해 편집 맥락을 분리한다.

## Shapes

모든 주요 표면은 둥글다. 버튼과 badge는 full radius, 패널은 22~28px radius를 쓴다. 사각형 sharp card는 SEOJing Paper에 맞지 않는다.

## Components

기본 primitive는 `Button`, `Input`, `Textarea`, `Select`, `Switch`, `Dialog`, `Card`, `Badge`, `Tabs`, `CodePanel`, `FileList`, `DiffView`, `AttachmentStrip`이다. 새로운 제품 UI는 임의 Tailwind class 조합으로 버튼/입력창/파일 목록/diff/첨부 UI를 만들지 말고 이 primitive를 먼저 확장한다.

- `Select`: 프로필, 세션 필터, 런타임 선택처럼 선택지가 제한된 설정에 쓴다.
- `Switch`: 승인 캐시, 자동 실행, 알림 on/off처럼 즉시 토글되는 설정에 쓴다.
- `Dialog`: 파일 쓰기 승인, 위험 액션 확인, 프로필 생성/삭제 확인에 쓴다.
- `FileList`: Happy-style 파일 사이드바와 changed files list의 기본이다.
- `DiffView`: 코드 변경 확인의 기본 표면이다. 코드/diff 영역만 어두운 ink surface를 허용한다.
- `AttachmentStrip`: composer 위 파일 첨부 preview의 기본이다.

## Do's and Don'ts

Do:

- 종이 바탕, 얇은 경계, muted ink를 우선한다.
- 주요 액션은 anchor 색 하나로 통일한다.
- 코드/diff 영역만 어두운 surface를 허용한다.
- 새 UI primitive가 필요하면 이 패키지에 추가한 뒤 사용한다.

Don't:

- 과한 cyan/blue SaaS dashboard 색을 기본으로 쓰지 않는다.
- feature마다 버튼 스타일을 새로 만들지 않는다.
- 입력창/승인 카드/탭을 앱마다 따로 구현하지 않는다.
- 종이 질감 위에 강한 glassmorphism을 과하게 겹치지 않는다.
