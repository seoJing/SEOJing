"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  TtsArticleManifest,
  TtsArtifact,
  TtsSection,
} from "@/shared/tts/tts-artifacts";

interface BlogAudioPlayerProps {
  slug: string;
}

type TtsAnalyticsAction =
  | "manifest_loaded"
  | "artifact_select"
  | "play"
  | "pause"
  | "ended"
  | "speed_change";

type TtsBackendJobStatus = "queued" | "running" | "done" | "failed";

interface TtsBackendJob {
  id: string;
  status: TtsBackendJobStatus;
  audioUrl?: string;
  error?: string;
}

interface TtsBackendJobState {
  status: TtsBackendJobStatus;
  jobId?: string;
  audioUrl?: string;
  error?: string;
}

const PLAYBACK_RATES = [1.2, 1.5, 1.8, 2.0] as const;
const DEFAULT_PLAYBACK_RATE = 1.5;
const STORAGE_PREFIX = "seojing_blog_audio_player_v1";
const DESKTOP_QUERY = "(min-width: 1280px)";
const TTS_JOB_POLL_INTERVAL_MS = 1_000;
const TTS_JOB_POLL_LIMIT = 60;

/**
 * 블로그별 TTS manifest가 있을 때만 노출되는 로컬 우선 오디오 플레이어.
 * 재생 속도, 섹션 단위 점프, 현재 위치 복원을 localStorage로 처리한다.
 */
export function BlogAudioPlayer({ slug }: BlogAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [manifest, setManifest] = useState<TtsArticleManifest | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    null,
  );
  const [playbackRate, setPlaybackRate] = useState<number>(
    DEFAULT_PLAYBACK_RATE,
  );
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [backendJobs, setBackendJobs] = useState<
    Record<string, TtsBackendJobState>
  >({});
  const backendJobsRef = useRef<Record<string, TtsBackendJobState>>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLElement>(null);
  const inFlightBackendJobs = useRef(new Map<string, AbortController>());
  const [isDocked, setIsDocked] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState<
    number | undefined
  >();
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(DESKTOP_QUERY).matches,
  );
  const lastPositionSaveRef = useRef(0);
  const storageBaseKey = `${STORAGE_PREFIX}:${slug}`;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const updateDesktop = () => {
      setIsDesktop(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setIsDocked(false);
        setPlaceholderHeight(undefined);
      }
    };
    mediaQuery.addEventListener("change", updateDesktop);
    return () => mediaQuery.removeEventListener("change", updateDesktop);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;

    const updateDocking = () => {
      const wrapper = wrapperRef.current;
      const player = playerRef.current;
      if (!wrapper || !player) return;
      const rect = wrapper.getBoundingClientRect();
      const nextDocked = rect.bottom < 96;
      setIsDocked(nextDocked);
      setPlaceholderHeight(player.offsetHeight || undefined);
    };

    updateDocking();
    window.addEventListener("scroll", updateDocking, { passive: true });
    window.addEventListener("resize", updateDocking);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => updateDocking());
    if (playerRef.current) resizeObserver?.observe(playerRef.current);

    return () => {
      window.removeEventListener("scroll", updateDocking);
      window.removeEventListener("resize", updateDocking);
      resizeObserver?.disconnect();
    };
  }, [isDesktop]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadManifest() {
      try {
        const response = await fetch(buildManifestPath(slug), {
          signal: controller.signal,
        });
        if (!response.ok) {
          setManifest(null);
          return;
        }
        const nextManifest = (await response.json()) as TtsArticleManifest;
        if (!Array.isArray(nextManifest.artifacts)) {
          setManifest(null);
          return;
        }
        setManifest(nextManifest);
        dispatchTtsAnalytics("manifest_loaded", {
          manifest: nextManifest,
          slug,
          playbackRate: DEFAULT_PLAYBACK_RATE,
        });
        setSelectedArtifactId(
          (current) =>
            current ?? readStoredString(`${storageBaseKey}:artifactId`),
        );
        const storedRate = readStoredNumber(`${storageBaseKey}:rate`);
        if (storedRate && PLAYBACK_RATES.includes(storedRate as never)) {
          setPlaybackRate(storedRate);
        }
      } catch {
        if (!controller.signal.aborted) setManifest(null);
      }
    }

    void loadManifest();
    return () => controller.abort();
  }, [slug, storageBaseKey]);

  const playableArtifacts = useMemo(
    () =>
      manifest?.artifacts.filter(
        (artifact) => artifact.status !== "failed" && artifact.text,
      ) ?? [],
    [manifest],
  );

  const selectedArtifact = useMemo(() => {
    if (playableArtifacts.length === 0) return null;
    return (
      playableArtifacts.find(
        (artifact) => artifact.id === selectedArtifactId,
      ) ??
      playableArtifacts[0] ??
      null
    );
  }, [playableArtifacts, selectedArtifactId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
    writeStoredString(`${storageBaseKey}:rate`, String(playbackRate));
  }, [playbackRate, storageBaseKey]);

  const handleLoadedMetadata = useCallback(() => {
    if (!selectedArtifact) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackRate;
    const savedTime = readStoredNumber(
      positionKey(storageBaseKey, selectedArtifact),
    );
    if (savedTime && savedTime > 3 && Number.isFinite(audio.duration)) {
      const safeTime = Math.min(savedTime, Math.max(0, audio.duration - 2));
      audio.currentTime = safeTime;
      setResumeNotice(`${formatTime(safeTime)}부터 이어듣기 준비됨`);
    } else {
      setResumeNotice(null);
    }
  }, [playbackRate, selectedArtifact, storageBaseKey]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !selectedArtifact) return;
    const currentSecond = Math.floor(audio.currentTime);
    if (Math.abs(currentSecond - lastPositionSaveRef.current) < 5) return;
    lastPositionSaveRef.current = currentSecond;
    writeStoredString(
      positionKey(storageBaseKey, selectedArtifact),
      String(currentSecond),
    );
  }, [selectedArtifact, storageBaseKey]);

  const emitAudioEvent = useCallback(
    (action: Extract<TtsAnalyticsAction, "play" | "pause" | "ended">) => {
      if (!selectedArtifact || !manifest) return;
      dispatchTtsAnalytics(action, {
        artifact: selectedArtifact,
        manifest,
        audio: audioRef.current,
        slug,
        playbackRate,
      });
    },
    [manifest, playbackRate, selectedArtifact, slug],
  );

  const selectArtifact = useCallback(
    (artifact: TtsArtifact) => {
      setSelectedArtifactId(artifact.id);
      writeStoredString(`${storageBaseKey}:artifactId`, artifact.id);
      if (manifest) {
        dispatchTtsAnalytics("artifact_select", {
          artifact,
          manifest,
          audio: audioRef.current,
          slug,
          playbackRate,
        });
      }
      if (artifact.sectionId && manifest) {
        scrollToSection(manifest.sections, artifact.sectionId);
      }
    },
    [manifest, playbackRate, slug, storageBaseKey],
  );

  const selectPlaybackRate = useCallback(
    (rate: number) => {
      setPlaybackRate(rate);
      if (selectedArtifact && manifest) {
        dispatchTtsAnalytics("speed_change", {
          artifact: selectedArtifact,
          manifest,
          audio: audioRef.current,
          slug,
          playbackRate: rate,
        });
      }
    },
    [manifest, selectedArtifact, slug],
  );

  const setBackendJobState = useCallback(
    (artifactId: string, state: TtsBackendJobState) => {
      backendJobsRef.current = {
        ...backendJobsRef.current,
        [artifactId]: state,
      };
      setBackendJobs(backendJobsRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!manifest || !selectedArtifact || !selectedArtifact.text) return;
    const currentManifest = manifest;
    const currentArtifact = selectedArtifact;
    const artifactId = currentArtifact.id;
    const existingState = backendJobsRef.current[artifactId];
    if (
      existingState?.status === "done" ||
      existingState?.status === "failed"
    ) {
      return;
    }
    const inFlightJobs = inFlightBackendJobs.current;
    const activeController = inFlightJobs.get(artifactId);
    if (activeController && !activeController.signal.aborted) return;

    const controller = new AbortController();
    inFlightJobs.set(artifactId, controller);

    async function createAndPollJob() {
      try {
        setBackendJobState(artifactId, { status: "queued" });
        const createdJob = await createTtsJob({
          artifact: currentArtifact,
          manifest: currentManifest,
          signal: controller.signal,
        });
        setBackendJobState(artifactId, jobToState(createdJob));

        let currentJob = createdJob;
        for (let attempt = 0; attempt < TTS_JOB_POLL_LIMIT; attempt += 1) {
          if (controller.signal.aborted) return;
          if (currentJob.status === "done" || currentJob.status === "failed") {
            return;
          }
          await wait(TTS_JOB_POLL_INTERVAL_MS, controller.signal);
          currentJob = await readTtsJob(createdJob.id, controller.signal);
          setBackendJobState(artifactId, jobToState(currentJob));
        }
        setBackendJobState(artifactId, {
          status: "failed",
          jobId: createdJob.id,
          error: "tts job timed out",
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setBackendJobState(artifactId, {
          status: "failed",
          error: error instanceof Error ? error.message : "tts request failed",
        });
      } finally {
        if (inFlightJobs.get(artifactId) === controller) {
          inFlightJobs.delete(artifactId);
        }
      }
    }

    void createAndPollJob();
    return () => {
      controller.abort();
      if (inFlightJobs.get(artifactId) === controller) {
        inFlightJobs.delete(artifactId);
      }
    };
  }, [manifest, selectedArtifact, setBackendJobState]);

  if (!manifest || playableArtifacts.length === 0 || !selectedArtifact) {
    return null;
  }

  const sectionArtifacts = playableArtifacts.filter(
    (artifact) => artifact.kind === "section",
  );

  const sectionClass = isDocked
    ? "fixed bottom-5 right-6 z-40 max-h-[calc(100vh-2.5rem)] w-[min(22rem,calc(100vw-2.5rem))] overflow-y-auto rounded-3xl border border-gray-200 bg-white/95 p-4 text-sm shadow-xl backdrop-blur dark:border-gray-800 dark:bg-gray-950/95"
    : "my-8 rounded-3xl border border-gray-200 bg-white/70 p-5 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-950/60";

  const selectedBackendJob = backendJobs[selectedArtifact.id];
  const audioSrc = resolveAudioSrc(selectedArtifact, selectedBackendJob);
  const ttsStatusMessage = ttsStatusText(selectedBackendJob, audioSrc);

  const player = (
    <section
      ref={playerRef}
      aria-label="블로그 오디오 플레이어"
      className={sectionClass}
      data-docked={isDocked ? "true" : "false"}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Listen
          </p>
          <h2 className="text-base font-bold text-gray-950 dark:text-gray-50">
            {selectedArtifact.title}
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            속도·구간·이어듣기는 이 브라우저에만 저장돼요.
            {ttsStatusMessage ? ` ${ttsStatusMessage}` : null}
          </p>
        </div>

        <audio
          ref={audioRef}
          className="w-full"
          controls
          preload="metadata"
          src={audioSrc}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => emitAudioEvent("play")}
          onPause={() => emitAudioEvent("pause")}
          onEnded={() => emitAudioEvent("ended")}
        />

        {selectedBackendJob?.status === "failed" ? (
          <p role="alert" className="text-xs text-red-600 dark:text-red-300">
            오디오 생성/API 연결에 실패했어요: {selectedBackendJob.error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            속도
          </span>
          {PLAYBACK_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              aria-pressed={playbackRate === rate}
              className={buttonClass(playbackRate === rate)}
              onClick={() => selectPlaybackRate(rate)}
            >
              {rate.toFixed(1)}x
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            듣기 모드
          </span>
          {playableArtifacts
            .filter((artifact) => artifact.kind !== "section")
            .map((artifact) => (
              <button
                key={artifact.id}
                type="button"
                aria-pressed={selectedArtifact.id === artifact.id}
                className={buttonClass(selectedArtifact.id === artifact.id)}
                onClick={() => selectArtifact(artifact)}
              >
                {artifact.kind === "summary-2m" ? "2분 요약" : "5분 핵심"}
              </button>
            ))}
        </div>

        {sectionArtifacts.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              섹션 점프
            </span>
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
              {sectionArtifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  type="button"
                  aria-label={`오디오 구간 이동: ${sectionTitle(artifact, manifest.sections)}`}
                  aria-pressed={selectedArtifact.id === artifact.id}
                  className={buttonClass(selectedArtifact.id === artifact.id)}
                  onClick={() => selectArtifact(artifact)}
                >
                  {sectionTitle(artifact, manifest.sections)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {resumeNotice ? (
          <p role="status" className="text-xs text-gray-600 dark:text-gray-300">
            {resumeNotice}
          </p>
        ) : null}
      </div>
    </section>
  );

  return (
    <div
      ref={wrapperRef}
      style={
        isDocked && placeholderHeight
          ? { minHeight: placeholderHeight }
          : undefined
      }
      className="relative"
    >
      {isDesktop && isDocked && typeof document !== "undefined"
        ? createPortal(player, document.body)
        : player}
    </div>
  );
}

function resolveAudioSrc(
  artifact: TtsArtifact,
  backendJob: TtsBackendJobState | undefined,
) {
  if (backendJob?.status === "done") {
    if (backendJob.audioUrl) {
      return buildTtsApiUrl(backendJob.audioUrl);
    }
    if (backendJob.jobId) {
      return buildTtsApiUrl(
        `/tts/audio/${encodeURIComponent(backendJob.jobId)}`,
      );
    }
  }
  return artifact.status === "ready" ? artifact.audioPath : undefined;
}

function ttsStatusText(
  backendJob: TtsBackendJobState | undefined,
  audioSrc: string | undefined,
) {
  if (backendJob?.status === "done" && audioSrc) {
    return "백엔드 오디오 API로 재생 준비가 끝났어요.";
  }
  if (backendJob?.status === "running" || backendJob?.status === "queued") {
    return "백엔드에서 오디오를 생성하는 중이에요.";
  }
  if (backendJob?.status === "failed") {
    return "현재 오디오 API를 사용할 수 없어요.";
  }
  if (audioSrc) return "정적 오디오 파일로 재생해요.";
  return "백엔드 오디오 API 연결을 준비하고 있어요.";
}

async function createTtsJob(options: {
  artifact: TtsArtifact;
  manifest: TtsArticleManifest;
  signal: AbortSignal;
}) {
  const response = await fetch(buildTtsApiUrl("/tts/jobs"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `${options.manifest.cacheKey}:${options.artifact.id}`,
    },
    body: JSON.stringify({
      text: options.artifact.text,
      article_id: options.manifest.slug,
      idempotency_key: `${options.manifest.cacheKey}:${options.artifact.id}`,
      metadata: {
        source: "seojing-article-ui",
        slug: options.manifest.slug,
        artifact_id: options.artifact.id,
        artifact_kind: options.artifact.kind,
        section_id: options.artifact.sectionId,
        canonical_url: options.manifest.canonicalUrl,
      },
    }),
    signal: options.signal,
  });
  const body = (await response.json().catch(() => null)) as {
    job?: TtsBackendJob;
    error?: { message?: string };
  } | null;
  if (!response.ok || !body?.job) {
    throw new Error(
      body?.error?.message ?? `tts job create failed: ${response.status}`,
    );
  }
  return body.job;
}

async function readTtsJob(jobId: string, signal: AbortSignal) {
  const response = await fetch(buildTtsApiUrl(`/tts/jobs/${jobId}`), {
    signal,
  });
  const body = (await response.json().catch(() => null)) as {
    job?: TtsBackendJob;
    error?: { message?: string };
  } | null;
  if (!response.ok || !body?.job) {
    throw new Error(
      body?.error?.message ?? `tts job read failed: ${response.status}`,
    );
  }
  return body.job;
}

function jobToState(job: TtsBackendJob): TtsBackendJobState {
  return {
    status: job.status,
    jobId: job.id,
    audioUrl: job.audioUrl,
    error: job.error,
  };
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function buildTtsApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return new URL(path, readTtsApiOrigin()).toString();
}

function readTtsApiOrigin() {
  const env = readRuntimeEnv();
  const configuredOrigin =
    env.VITE_SEOJING_BACKEND_TTS_API_ORIGIN?.trim() ||
    env.VITE_SEOJING_BACKEND_API_ORIGIN?.trim() ||
    env.SEOJING_BACKEND_TTS_API_ORIGIN?.trim() ||
    env.SEOJING_BACKEND_API_ORIGIN?.trim();
  if (configuredOrigin) return configuredOrigin;
  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    return "http://127.0.0.1:4000";
  }
  return "https://api.seojing.com";
}

function readRuntimeEnv(): Record<string, string | undefined> {
  const processEnv = typeof process === "undefined" ? undefined : process.env;
  const importMetaEnv = (
    import.meta as unknown as {
      env?: Record<string, string | undefined>;
    }
  ).env;
  return { ...importMetaEnv, ...processEnv };
}

function buildManifestPath(slug: string) {
  const safeSlug = slug
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/tts-artifacts/${safeSlug}/manifest.json`;
}

function buttonClass(active: boolean) {
  const base =
    "rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-gray-400";
  if (active) {
    return `${base} border-gray-900 bg-gray-900 text-white shadow-sm dark:border-gray-100 dark:bg-gray-100 dark:text-gray-950`;
  }
  return `${base} border-gray-300 bg-white text-gray-700 hover:border-gray-500 hover:text-gray-950 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-gray-100`;
}

function sectionTitle(artifact: TtsArtifact, sections: TtsSection[]) {
  return (
    sections.find((section) => section.id === artifact.sectionId)?.title ??
    artifact.title.split(" — ").at(-1) ??
    "섹션"
  );
}

function scrollToSection(sections: TtsSection[], sectionId: string) {
  const title = sections.find((section) => section.id === sectionId)?.title;
  if (!title) return;
  const headings = Array.from(
    document.querySelectorAll<HTMLHeadingElement>("h2, h3, h4"),
  );
  const target = headings.find(
    (heading) => heading.textContent?.trim() === title.trim(),
  );
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function positionKey(storageBaseKey: string, artifact: TtsArtifact) {
  return `${storageBaseKey}:position:${artifact.id}`;
}

function dispatchTtsAnalytics(
  action: TtsAnalyticsAction,
  options: {
    manifest: TtsArticleManifest;
    slug: string;
    playbackRate: number;
    artifact?: TtsArtifact;
    audio?: HTMLAudioElement | null;
  },
) {
  const { action: _action, ...detail } = {
    action,
    slug: options.slug,
    artifact_id: options.artifact?.id,
    artifact_kind: options.artifact?.kind,
    section_id: options.artifact?.sectionId ?? undefined,
    section_heading: options.artifact?.sectionId
      ? sectionTitle(options.artifact, options.manifest.sections)
      : undefined,
    playback_rate: options.playbackRate,
    audio_status: options.artifact?.status,
    available_artifact_kinds: Array.from(
      new Set(options.manifest.artifacts.map((artifact) => artifact.kind)),
    ),
    section_artifact_count: options.manifest.artifacts.filter(
      (artifact) => artifact.kind === "section" && artifact.audioPath,
    ).length,
    duration_seconds_bucket: secondsBucket(options.audio?.duration),
    position_seconds_bucket: secondsBucket(options.audio?.currentTime),
    progress_percent_bucket: progressBucket(options.audio),
  };

  window.dispatchEvent(
    new CustomEvent("seojing:tts-interaction", {
      detail: { action: _action, ...removeUndefined(detail) },
    }),
  );
}

function secondsBucket(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  if (value < 30) return "0-29";
  if (value < 60) return "30-59";
  if (value < 180) return "60-179";
  if (value < 300) return "180-299";
  if (value < 600) return "300-599";
  return "600+";
}

function progressBucket(audio: HTMLAudioElement | null | undefined) {
  if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) {
    return undefined;
  }
  const progress = Math.min(
    100,
    Math.max(0, Math.round((audio.currentTime / audio.duration) * 100)),
  );
  if (progress < 25) return "0-24";
  if (progress < 50) return "25-49";
  if (progress < 75) return "50-74";
  if (progress < 90) return "75-89";
  if (progress < 100) return "90-99";
  return "100";
}

function removeUndefined(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  );
}

function readStoredString(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readStoredNumber(key: string) {
  const value = readStoredString(key);
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function writeStoredString(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage may be blocked; the player should still work without resume.
  }
}

function formatTime(seconds: number) {
  const minute = Math.floor(seconds / 60);
  const second = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minute}:${second}`;
}
