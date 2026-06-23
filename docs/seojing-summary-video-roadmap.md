# SEOJing 요약 쇼츠 고도화 계획

## 현재 기준

요약 쇼츠는 범용 관심 유도 영상이 아니라 SEOJing 포스트의 상단 요약/소셜 유입 포탈이다. 훅은 강해도 되지만 반드시 해당 포스트의 실제 주제, 판단, 근거에서 나와야 한다. 영상은 글을 대체하지 않고 본문으로 들어가는 입구 역할을 한다.

현재 구현 기준은 다음 구조다.

- 포스트 frontmatter `summaryVideo`로 mp4 연결
- `/summary-videos/<slug>/summary-short.mp4` 정적 자산
- Supertonic3 오케이징 튜닝 TTS
- SEOJing Paper 토큰 기반 FFmpeg/Pillow 카드형 9:16 렌더
- scene JSON의 `diagram` 필드로 장면별 도식 렌더
- scene JSON의 `motion` 필드는 보존하되, Motion Canvas는 소셜 업로드용 선택 렌더러로 후순위

## 1단계: SEOJing 디자인 시스템 완전 반영

먼저 렌더러의 색/타입/간격을 앱 UI와 맞춘다. Motion Canvas보다 먼저 해야 한다. 영상 퀄리티가 올라가도 SEOJing 글과 시각 언어가 다르면 포스트 상단에서 이질감이 생긴다.

### 적용 방식

1. `packages/design-system/DESIGN.md`의 SEOJing Paper 색/타입/간격을 영상 토큰 JSON으로 분리했다.
2. 렌더러는 하드코딩 색 대신 `summary-video-theme.json`을 읽는다.
3. 카드 프레임은 어두운 네온 카드가 아니라 SEOJing의 paper/card 톤을 따른다.
4. `kind`별 accent/tint만 바꿔 장면 성격을 표시한다.
   - `hook`: danger 계열
   - `point`: anchor 계열
   - `process`: warning 계열
   - `cta`: success 계열

### 산출물

```text
apps/web/public/summary-videos/theme/seojing-summary-video-theme.json
/Users/seojing/.hermes/scripts/summary_video_maker.py --theme <theme.json>
```

이 토큰 파일은 FFmpeg/Pillow 렌더러의 기본 입력이고, 나중의 Motion Canvas 렌더러도 같은 파일을 읽는 구조로 둔다.

## 2단계: 장면별 도식 자동 생성

장면마다 단순 텍스트 카드만 쓰지 않고, 포스트 주제에 맞는 도식을 같이 만든다. 다만 무조건 그림을 넣지 않는다. 도식은 포스트의 이해를 빠르게 돕는 장면에만 넣는다.

### 도식 타입

- `comparison`: 후보 A/B 비교. 예: Qwen3-TTS vs Supertonic3
- `criteria`: 평가 기준 체크리스트. 예: RAM, 말끝, 지연, 조정 가능성
- `pipeline`: 과정. 예: 포스트 → 장면 → TTS → 영상 → 블로그 유입
- `boundary`: 책임 분리. 예: 로컬 TTS vs 정적 블로그 자산
- `timeline`: 결정 흐름. 예: 후보 검토 → 테스트 → 기본값 결정

### Scene JSON 확장

```json
{
  "kind": "point",
  "title": "첫 기준은 RAM이었습니다",
  "caption": "로컬에서 돌릴 수 있어도 기본값은 다릅니다.",
  "narration": "...",
  "diagram": {
    "type": "criteria",
    "items": ["RAM", "지연", "말끝", "조정 가능성"],
    "highlight": "RAM"
  }
}
```

### 구현 경로

1. Python/Pillow 도식 렌더부터 붙였다.
2. 각 scene card는 `diagram`이 있을 때 전용 도식 영역을 그리고, 없으면 기존 텍스트 카드로 내려간다.
3. 지원 타입은 `comparison`, `criteria`, `pipeline`, `boundary`, `timeline`이다.
4. `motion` 필드는 렌더하지 않고 `scenes.normalized.json`에 보존한다. 나중에 같은 scene JSON을 Motion Canvas renderer가 재사용한다.

이렇게 하면 FFmpeg MVP와 Motion Canvas 고도화가 같은 스크립트/장면 데이터를 공유한다.

## 3단계: Motion Canvas식 복잡한 모션그래픽

Motion Canvas는 바로 기본 렌더러로 바꾸지 않는다. 먼저 `scene JSON -> Motion Canvas project` 변환기로 붙인다. 현재 FFmpeg 렌더러는 빠른 기본값으로 유지한다.

### 이유

- FFmpeg/Pillow는 빠르고 안정적이다.
- Motion Canvas는 품질은 좋지만 의존성, 렌더 시간, 디버깅 비용이 높다.
- 모든 포스트에 복잡한 모션이 필요한 것은 아니다.

### 구조

```text
SEOJing post
  ↓
summary scenes.json
  ↓
renderer 선택
  ├─ ffmpeg-card: 빠른 포스트 상단 요약
  └─ motion-canvas: 소셜 업로드용 고품질 쇼츠
```

### Motion Canvas scene contract

Motion Canvas로 갈 장면은 `motion` 필드를 추가한다.

```json
{
  "motion": {
    "preset": "criteria-reveal",
    "beats": [
      { "at": 0.2, "action": "show-title" },
      { "at": 1.8, "action": "reveal-item", "target": "RAM" },
      { "at": 4.0, "action": "highlight", "target": "Supertonic3" }
    ]
  }
}
```

처음 지원할 preset:

- `title-punch`
- `criteria-reveal`
- `comparison-split`
- `pipeline-slide`
- `quote-emphasis`
- `cta-blog-card`

### 구현 순서

1. `apps/web/summary-video-motion/` 또는 별도 workspace에 Motion Canvas 템플릿 생성
2. `scenes.normalized.json`을 읽는 Motion Canvas scene 작성
3. preset 2개만 구현: `title-punch`, `criteria-reveal`
4. 같은 Qwen3/Supertonic 포스트로 15~30초 프리뷰 렌더
5. FFmpeg 버전과 비교해 비용/품질 판단

## 운영 판단

- 블로그 상단 기본값: FFmpeg/Pillow 카드형
- 소셜 업로드 고품질 버전: Motion Canvas 선택 렌더
- 도식 자동 생성: 두 렌더러가 공유하는 scene JSON 필드로 설계
- 디자인 시스템: 먼저 토큰화해서 둘 다 같은 색/타입 기준을 쓰게 한다

이 순서가 맞다. Motion Canvas부터 가면 멋있지만 실제 포스트 삽입과 운영 루프가 늦어진다. SEOJing에는 먼저 일관된 포스트 상단 요약 영상이 필요하고, 그 다음에 소셜용 고품질 렌더러를 붙이는 게 맞다.
