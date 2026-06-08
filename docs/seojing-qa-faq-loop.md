# SEOJing Q&A/FAQ 운영 루프

포스트 하단 Q&A 패널은 원문 질문을 서버 분석 이벤트로 보내지 않는다. 원문 질문은 브라우저 `localStorage`의 `seojing_post_qa_log_v1`에 client-only 최근 로그로 남기고, analytics에는 `qa_interaction`의 action/bucket만 보낸다.

## 수집/내보내기

브라우저 콘솔에서 필요할 때만 로컬 질문 로그를 파일로 복사한다.

```js
copy(localStorage.getItem("seojing_post_qa_log_v1") ?? "[]");
```

복사한 JSON을 예를 들어 `tmp/qa-log.json`에 저장한다.

## 리포트 생성

```bash
pnpm --filter @app/web qa:insights tmp/qa-log.json tmp/qa-insights.md
```

출력은 다음 세 블록으로 구성된다.

1. FAQ 후보: 동일 포스트에 반복 질문이 쌓인 경우 대표 질문과 핵심어를 보여준다.
2. 콘텐츠 개선 액션: `insufficient_context` 질문은 기존 글 보강 후보로, 반복 질문은 후속 글 후보로 분류한다.
3. 슬러그별 요약: 질문 수, 근거 부족 수, top terms를 빠르게 확인한다.

## 운영 기준

- `revise_existing_post`: 근거 부족 질문이 있으면 우선 기존 포스트의 섹션/예시/링크를 보강한다.
- `draft_followup_post`: 한 슬러그에 반복 질문이 3개 이상 쌓이면 FAQ 섹션 또는 후속 글 후보로 승격한다.
- analytics에는 원문 질문을 저장하지 않는다. 운영 리포트 입력 JSON은 사용자가 명시적으로 내보낸 로컬 로그만 사용한다.
