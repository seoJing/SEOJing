# SEOJing TTS local audio API MVP

작성일: 2026-06-08
관련 티켓: local #66
상태: MVP direction

## 1. 결정 요약

SEOJing TTS 오디오는 당장 Cloudflare R2에 저장하지 않는다. 수요와 사용자 유치 효과가 검증되기 전까지는 Mac mini 로컬 저장소와 Supertonic CPU 생성기를 기본으로 둔다.

- JSON manifest와 transcript는 SEOJing 정적 artifact로 유지한다.
- 실제 MP3는 repo/public assets에 넣지 않는다.
- Supertonic MP3 생성은 Mac mini에서 수행한다.
- 생성된 MP3는 Mac mini 로컬 캐시에 저장한다.
- SEOJing 프론트는 오디오 API로 상태를 조회하고, 준비된 오디오만 스트리밍한다.
- Cloudflare R2는 비용이 정당화될 때 붙일 수 있는 optional storage backend로 남긴다.

이 결정은 “최종적으로 가장 안정적인 CDN 구조”가 아니라 “현재 트래픽과 비용 구조에서 검증 가능한 MVP”를 우선한 것이다.

## 2. 배경

현재 TTS artifact generator는 실제 MP3를 만들지 않는다. MDX를 읽어 다음 산출물을 만든다.

```text
apps/web/public/tts-artifacts/
  index.json
  <content-slug>/
    manifest.json
    summary-2m.txt
    core-5m.txt
    section-001.txt
```

각 manifest의 `audioPath`는 실제 파일이 아니라, 나중에 오디오가 붙을 위치를 나타내는 계약에 가깝다. 현재 생성되는 파일 수와 크기는 다음 수준이다.

- 글 수: 131개
- TTS artifact: 461개
- 전체 대본 문자 수: 약 623,160자
- 현재 JSON/TXT artifact 총량: 약 4.3MB
- 현재 실제 MP3: 0개

96kbps MP3 기준으로 전체 오디오를 만든다고 가정하면 현재 131개 글은 약 1.16GB, 1,000개 글은 약 8.9GB 정도로 추정된다. 용량 자체는 Mac mini 로컬 저장소에서 충분히 감당 가능하다.

## 3. 왜 R2를 보류하는가

R2는 서비스형 공개 오디오 저장소로는 좋은 선택이다. 그러나 현재 단계에서는 다음 이유로 보류한다.

- SEOJing TTS가 사용자 유치에 결정적인 기능인지 아직 검증되지 않았다.
- 수익이 없는 상태에서 기능별 월 과금 구조를 추가하는 것은 운영 부담이다.
- 현재 트래픽은 Mac mini 로컬 API로도 감당 가능한 수준이다.
- Supertonic은 GPU 없이 CPU 생성이 가능하므로 Mac mini가 생성 워커 역할을 할 수 있다.

따라서 R2는 “처음부터 도입해야 하는 필수 인프라”가 아니라 “트래픽과 기능 가치가 확인된 뒤 켤 수 있는 배포 계층”으로 본다.

## 4. 채택 구조

```text
SEOJing MDX
  -> generate-tts-artifacts
  -> static manifest/transcript
  -> SEOJing page loads manifest
  -> browser asks audio API for artifact status
  -> Mac mini checks local cache
  -> if ready: stream MP3
  -> if missing: enqueue Supertonic generation
  -> if generating: return job status
```

역할 분리는 다음과 같다.

| 구성 요소                | 역할                                                       |
| ------------------------ | ---------------------------------------------------------- |
| SEOJing Cloudflare front | 글, SEO, manifest/transcript 정적 제공                     |
| Mac mini TTS API         | 상태 조회, 생성 큐 등록, 오디오 스트리밍                   |
| Supertonic local worker  | transcript를 MP3로 변환                                    |
| Mac mini local cache     | 생성된 MP3 원본 저장                                       |
| R2                       | 현재 보류. 나중에 공개 CDN/storage backend로 optional 도입 |

## 5. 로컬 저장소 layout

Mac mini의 오디오 캐시는 repo 밖에 둔다.

```text
~/.hermes/seojing-tts/
  audio/
    study/backend/day1/summary-2m.mp3
    study/backend/day1/core-5m.mp3
    study/backend/day1/section-001.mp3
  jobs.sqlite3
  logs/
  tmp/
```

원칙:

- repo에는 MP3를 커밋하지 않는다.
- `audio/<slug>/<chunk>.mp3`는 manifest의 artifact id와 안정적으로 매핑되어야 한다.
- 생성 중 임시 파일은 `tmp/`에 쓰고 완료 후 atomic rename으로 `audio/`에 배치한다.
- 실패한 job은 `jobs.sqlite3`에 실패 원인과 재시도 가능 여부를 남긴다.

## 6. API contract 초안

### 6.1 상태 조회

```http
GET /tts/status?artifactId=study__backend__day1__summary-2m
```

ready 응답:

```json
{
  "status": "ready",
  "artifactId": "study__backend__day1__summary-2m",
  "audioUrl": "https://api.seojing.com/tts/audio/study__backend__day1__summary-2m",
  "durationSeconds": 121,
  "provider": "supertonic3",
  "voice": "supertonic3-f1-human",
  "generatedAt": "2026-06-08T00:00:00Z"
}
```

missing 응답:

```json
{
  "status": "missing",
  "artifactId": "study__backend__day1__summary-2m",
  "canGenerate": true
}
```

generating 응답:

```json
{
  "status": "generating",
  "artifactId": "study__backend__day1__summary-2m",
  "jobId": "tts_20260608_000000_day1_summary",
  "position": 2
}
```

### 6.2 생성 요청

```http
POST /tts/generate
```

```json
{
  "artifactId": "study__backend__day1__summary-2m"
}
```

응답:

```json
{
  "status": "queued",
  "jobId": "tts_20260608_000000_day1_summary"
}
```

생성 요청은 오래 붙잡지 않는다. API는 job을 등록하고 빠르게 반환한다.

### 6.3 오디오 스트리밍

```http
GET /tts/audio/study__backend__day1__summary-2m
```

필수 요구사항:

- `Content-Type: audio/mpeg`
- `Accept-Ranges: bytes`
- `206 Partial Content` 지원
- `Cache-Control` 지정
- canonical site origin CORS allowlist

HTML `<audio>`는 seek와 부분 재생 때문에 Range 요청을 사용한다. 이 기능이 없으면 “파일 다운로드는 되지만 재생 UX가 나쁜 API”가 된다.

## 7. 생성 우선순위

처음부터 모든 섹션 오디오를 선생성하지 않는다. MVP는 온디맨드 생성과 일부 선생성을 섞는다.

1. `summary-2m`: 우선 제공
2. `core-5m`: 글 체류/학습 수요가 보이면 제공
3. `section-*`: 섹션 단위 재생 UX가 필요해질 때 제공

글 페이지는 오디오가 없다고 실패하면 안 된다. 오디오 위젯만 `missing`, `generating`, `ready`, `failed` 상태를 보여준다.

## 8. 운영 가드레일

Mac mini 공개 API는 비용은 낮지만 운영 리스크가 있다. MVP에서도 다음 가드레일은 필요하다.

- per-IP/session rate limit
- 동시 생성 job 수 제한
- artifact id allowlist: manifest에 존재하는 artifact만 생성
- raw text를 public API body로 받지 않기
- 생성 실패 재시도 횟수 제한
- request id 로그
- health endpoint 분리
- Cloudflare Tunnel 또는 동등한 안전한 public ingress 사용

## 9. R2 전환 기준

다음 조건 중 일부가 충족되면 R2 또는 다른 object storage 도입을 다시 검토한다.

- 월 오디오 재생 트래픽이 Mac mini 업로드 대역폭을 눈에 띄게 압박한다.
- SEOJing TTS가 사용자 유치/체류에 의미 있는 기능임이 analytics로 확인된다.
- Mac mini API 장애가 공개 사용자 경험에 반복적으로 영향을 준다.
- 모바일/해외 사용자 오디오 latency가 문제가 된다.
- generated audio를 public CDN cache에 올려야 할 만큼 요청이 반복된다.

전환을 쉽게 하기 위해 프론트는 local file path가 아니라 `audioUrl`과 status API만 의존해야 한다.

## 10. 블로그 포스트 후보 메모

이 결정 과정은 나중에 okayJing 또는 SEOJing 운영 글로 정리할 가치가 있다.

후보 주제:

- 수익 없는 개인 블로그 기능에 월 과금 인프라를 붙일 것인가
- R2/CDN이 기술적으로 맞아도 MVP에서는 보류할 수 있는 이유
- Mac mini를 공개 서비스의 “생성기”로 쓰되 “프론트 전체 origin”으로 쓰지 않는 경계
- TTS 기능을 제품 가치 검증 전까지 온디맨드/로컬 캐시로 유지하는 방식

## 11. 수용 기준

- MP3는 repo/public artifact에 추가하지 않는다.
- TTS manifest/transcript 생성은 정적 Cloudflare front와 호환된다.
- 프론트는 오디오 API 실패 시 글 렌더링을 깨지 않는다.
- Mac mini API는 Range streaming과 generation queue를 분리한다.
- storage backend는 local-first로 시작하되 R2 전환을 막지 않는다.
