# SEOJing TTS public-working gate — Ticket 180

Date: 2026-06-29

## Scope

Verify whether the article-level TTS UI is truthfully public-working after the TTS API moved to `seojing-backend` in ticket #174.

Representative article route:

- `https://seojing.com/blog/study/backend/day1`

## Audit result

| Surface                                          | Status                           | Evidence                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static TTS manifest                              | public-working for manifest only | `GET https://seojing.com/tts-artifacts/study/backend/day1/manifest.json` returned `200 application/json`.                                                                                                                                                                                                                                                                             |
| Static MP3 path in current public UI             | not public-working               | Browser readback showed the current deployed article audio `src` points to `https://seojing.com/tts-artifacts/study/backend/day1/summary-2m.mp3`; `Range: bytes=0-15` returned `404 Not Found`.                                                                                                                                                                                       |
| Public backend TTS API                           | public-working for job/audio API | 2026-07-01 launchd backend now runs with `PYTHON_WORKER_ENABLED=true` and a persistent Python worker on `127.0.0.1:4037`; `GET https://api.seojing.com/tts/summary` returned `configured:true`. Public smoke created a job, reached `done`, and `GET https://api.seojing.com/tts/audio/:jobId` with `Range: bytes=0-15` returned `206 audio/mpeg`, `Content-Range: bytes 0-15/29952`. |
| Local backend Node → Python worker → Range audio | implemented-local                | Local smoke with `PYTHON_WORKER_ENABLED=true` created a TTS job, reached `done`, and `GET /tts/audio/:jobId` with `Range: bytes=0-15` returned `206 audio/mpeg` with `Content-Range: bytes 0-15/33408`.                                                                                                                                                                               |
| Article UI → backend audio API                   | implemented-local                | `BlogAudioPlayer` now creates backend `/tts/jobs` from the selected manifest artifact, polls `/tts/jobs/:jobId`, and switches the `<audio>` source to backend `/tts/audio/:jobId` when the job is `done`. Vitest covers this path.                                                                                                                                                    |

## Code change summary

- `apps/web/src/widgets/blog-audio-player/BlogAudioPlayer.tsx`
  - Keeps the existing manifest as the text/chunk source.
  - Lazily creates a backend TTS job for the selected artifact with an idempotency key based on `manifest.cacheKey + artifact.id`.
  - Polls job status and uses backend audio URL only after `done`.
  - Shows pending/done/error copy instead of implying static MP3 files are already playable.
  - Falls back to `http://127.0.0.1:4000` only for localhost browser readback; production defaults to `https://api.seojing.com` unless configured by `SEOJING_BACKEND_TTS_API_ORIGIN` or `SEOJING_BACKEND_API_ORIGIN`.
- `apps/web/src/widgets/blog-audio-player/BlogAudioPlayer.test.tsx`
  - Adds a behavior test for article UI → backend job creation → backend audio URL selection.

## Verification run

Frontend:

```text
pnpm --filter @app/web exec vitest run src/widgets/blog-audio-player/BlogAudioPlayer.test.tsx
# 7 passed

pnpm --filter @app/web run lint
# passed

pnpm --filter @app/web run build
# passed
```

Backend/local runtime:

```text
pnpm build
# tsc passed

GET http://127.0.0.1:4000/health/ready
# 200, pythonWorker.status=ok

POST http://127.0.0.1:4000/tts/jobs
GET  http://127.0.0.1:4000/tts/jobs/:jobId
GET  http://127.0.0.1:4000/tts/audio/:jobId Range: bytes=0-15
# job done; audio 206 audio/mpeg; Content-Range bytes 0-15/33408
```

Public readback:

```text
GET https://seojing.com/tts-artifacts/study/backend/day1/manifest.json
# 200 application/json

Browser DOM on https://seojing.com/blog/study/backend/day1
# current deployed article still renders <audio src="https://seojing.com/tts-artifacts/study/backend/day1/summary-2m.mp3">

GET https://api.seojing.com/tts/summary
# 200, configured:true

POST https://api.seojing.com/tts/jobs
GET  https://api.seojing.com/tts/jobs/:jobId
GET  https://api.seojing.com/tts/audio/:jobId Range: bytes=0-15
# job done; audio 206 audio/mpeg; Content-Range bytes 0-15/29952
```

## 2026-07-01 stabilization update

- Added persistent launchd worker unit `com.seojing.python-worker` for `workers/seojing_python_worker.py` on `127.0.0.1:4037`.
- Updated `com.seojing.backend` launchd environment to enable `PYTHON_WORKER_ENABLED`, point to the worker, and use an aligned persistent `TTS_AUDIO_ROOT`.
- Rebuilt and restarted the launchd-backed backend service.
- Removed the previous misalignment where the backend accepted the worker but rejected generated audio as outside the configured root.

Frontend deploy remains the blocker for the full article UI gate: the canonical article route still uses the already-deployed static audio path until the `BlogAudioPlayer` change is committed, pushed, and deployed.

## Postability decision

Do not describe SEOJing article TTS as a postable public audio feature yet.

Truthful current wording:

- `implemented-local`: article UI can call the backend audio API and use Range-streamed audio when the backend is configured with the local Python worker.
- `public-working`: manifest/status layer only, not audio playback.

Remaining gates before `postable`:

1. Commit/push/deploy the frontend UI change.
2. Configure/restart the production `api.seojing.com` backend with the Python worker enabled and the TTS audio root aligned.
3. Re-run canonical browser readback on `https://seojing.com/blog/study/backend/day1` and confirm the article `<audio>` source becomes `https://api.seojing.com/tts/audio/:jobId`.
4. Re-run Range readback on that job URL and confirm `206 audio/mpeg`.
