# SEOJing PPTX export spike + TTS script bridge

## 결론

PPTX export는 `pptxgenjs` 기반의 lightweight scene deck으로 가능하다. 기존 웹 프레젠테이션 DOM을 픽셀 단위로 캡처하는 방식이 아니라, MDX의 H1/H2/H3 구간을 발표 scene으로 재구성하고 각 scene을 PPTX slide + speaker notes로 내보내는 방식이 현실적이다.

## 현재 구현

- `apps/web/src/shared/presentation/presentation-export.ts`
  - MDX 본문을 H1/H2/H3 scene 단위로 나눈다.
  - 각 scene에 `summary`, `bullets`, `speakerScript`, `pptx.layoutHint`를 만든다.
  - 기존 TTS manifest와 연결해 slide별 `transcriptPath`/`audioPath` bridge를 제공한다.
- `apps/web/scripts/export-presentation-pptx.ts`
  - `pnpm --filter @app/web run export:presentation -- --slug <slug>`로 실행한다.
  - `manifest.json`과 `.pptx`를 생성한다.
  - speaker notes에 scene별 발표 스크립트를 넣고, slide footer에 TTS transcript path를 남긴다.

## Smoke result

실행 명령:

```bash
pnpm --filter @app/web run export:presentation -- --slug study/backend/day1 --out-dir /tmp/seojing-presentation-export-smoke
```

검증 결과:

- manifest: `/tmp/seojing-presentation-export-smoke/study/backend/day1/manifest.json`
- pptx: `/tmp/seojing-presentation-export-smoke/study/backend/day1/study__backend__day1.pptx`
- manifest scenes: 43
- pptx slides: 43
- pptx notes: 43

## 제한과 다음 단계

- 웹 deck의 DOM/애니메이션을 그대로 복제하지 않는다. 발표용 정적 요약 deck으로 취급한다.
- 코드/이미지는 현재 텍스트 요약과 `layoutHint`까지만 반영한다. 이미지 삽입, 코드 시각화, scene별 디자인 템플릿은 다음 단계에서 별도 확장해야 한다.
- MP3 파일은 PPTX에 직접 임베드하지 않는다. 현재는 TTS artifact path와 speaker notes bridge를 제공한다. 실제 음성 삽입은 Mac mini TTS cache/API와 export 시점의 파일 존재 여부를 확인한 뒤 opt-in으로 붙이는 편이 안전하다.
- 모든 글 자동 export보다, `featured`/presentation 가치가 있는 글만 opt-in manifest로 묶는 방향이 맞다.
