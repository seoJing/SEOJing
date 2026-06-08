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

const PLAYBACK_RATES = [1.2, 1.5, 1.8, 2.0] as const;
const DEFAULT_PLAYBACK_RATE = 1.5;
const STORAGE_PREFIX = "seojing_blog_audio_player_v1";

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLElement>(null);
  const [isDocked, setIsDocked] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState<
    number | undefined
  >();
  const lastPositionSaveRef = useRef(0);
  const storageBaseKey = `${STORAGE_PREFIX}:${slug}`;

  useEffect(() => {
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
  }, []);

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
        (artifact) => artifact.status !== "failed" && artifact.audioPath,
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

  if (!manifest || playableArtifacts.length === 0 || !selectedArtifact) {
    return null;
  }

  const sectionArtifacts = playableArtifacts.filter(
    (artifact) => artifact.kind === "section",
  );

  const sectionClass = isDocked
    ? "fixed bottom-5 right-5 z-40 max-h-[calc(100vh-2.5rem)] w-[min(26rem,calc(100vw-2.5rem))] overflow-y-auto rounded-3xl border border-gray-200 bg-white/95 p-4 text-sm shadow-xl backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 xl:right-[max(1.25rem,calc((100vw-68rem)/2-22rem))]"
    : "mt-4 rounded-3xl border border-gray-200 bg-transparent p-4 text-sm shadow-sm dark:border-gray-800";

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
            {selectedArtifact.status === "pending"
              ? " 오디오 파일이 아직 생성 중이면 재생이 지연될 수 있어요."
              : null}
          </p>
        </div>

        <audio
          ref={audioRef}
          className="w-full"
          controls
          preload="metadata"
          src={selectedArtifact.audioPath}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => emitAudioEvent("play")}
          onPause={() => emitAudioEvent("pause")}
          onEnded={() => emitAudioEvent("ended")}
        />

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
      {isDocked && typeof document !== "undefined"
        ? createPortal(player, document.body)
        : player}
    </div>
  );
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
