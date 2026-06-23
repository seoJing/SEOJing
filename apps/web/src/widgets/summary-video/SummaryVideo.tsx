import type { ContentSummaryVideo } from "@app/utils";

interface SummaryVideoProps {
  video?: ContentSummaryVideo;
  title: string;
}

function isUsableSummaryVideo(
  video: ContentSummaryVideo | undefined,
): video is ContentSummaryVideo & { src: string } {
  return Boolean(video?.src);
}

export function SummaryVideo({ video, title }: SummaryVideoProps) {
  if (!isUsableSummaryVideo(video)) return null;

  const label = video.title || `${title} 요약 쇼츠`;
  const caption =
    video.caption ||
    "포스트의 핵심만 짧게 먼저 보고, 자세한 판단과 근거는 본문에서 이어집니다.";

  return (
    <section
      className="not-prose my-8 rounded-[2rem] border border-black/10 bg-(--color-cloud-dancer)/80 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-black/40"
      aria-labelledby="summary-video-title"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_1fr] lg:items-center">
        <div className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-black shadow-2xl dark:border-white/10">
          <video
            src={video.src}
            poster={video.poster}
            controls
            playsInline
            preload="metadata"
            className="mx-auto aspect-[9/16] max-h-[78vh] w-full bg-black object-contain"
            aria-label={label}
          >
            {video.subtitles ? (
              <track
                kind="captions"
                src={video.subtitles}
                srcLang="ko"
                label="한국어 자막"
                default
              />
            ) : null}
          </video>
        </div>
        <div className="px-1 py-2 sm:px-3">
          <p className="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase dark:text-slate-400">
            SEOJing post brief
          </p>
          <h2
            id="summary-video-title"
            className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl dark:text-white"
          >
            {label}
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-700 sm:text-base dark:text-slate-300">
            {caption}
          </p>
          <p className="mt-5 rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            이 영상은 글의 대체물이 아니라 입구입니다. 더 긴 맥락, 판단 근거,
            실제 운영 기준은 아래 본문에서 이어집니다.
          </p>
        </div>
      </div>
    </section>
  );
}
