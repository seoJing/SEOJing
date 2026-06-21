import Link from "next/link";
import type { PostInfo } from "@/widgets/new-posts-carousel/new-posts-carousel.utils";

const PALETTES = [
  {
    name: "signal-orange",
    background: "#ff5a00",
    foreground: "#050505",
    muted: "rgba(5,5,5,0.58)",
    accent: "#050505",
    soft: "rgba(255,255,255,0.18)",
  },
  {
    name: "clear-sky",
    background: "#2f9ae8",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.76)",
    accent: "#07304c",
    soft: "rgba(255,255,255,0.25)",
  },
  {
    name: "editor-red",
    background: "#c90013",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.72)",
    accent: "#ffffff",
    soft: "rgba(255,255,255,0.18)",
  },
  {
    name: "paper-white",
    background: "#f7f4ec",
    foreground: "#050505",
    muted: "rgba(5,5,5,0.55)",
    accent: "#e50019",
    soft: "rgba(5,5,5,0.08)",
  },
  {
    name: "archive-dark",
    background: "#071017",
    foreground: "#ffffff",
    muted: "rgba(255,255,255,0.68)",
    accent: "#ffcf33",
    soft: "rgba(255,255,255,0.12)",
  },
  {
    name: "calm-blue",
    background: "#c3dcff",
    foreground: "#050505",
    muted: "rgba(5,5,5,0.58)",
    accent: "#245bff",
    soft: "rgba(255,255,255,0.55)",
  },
];

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function formatDate(date: string) {
  if (!date) return "No date";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function splitTitle(title: string) {
  const normalized = title.replace(/\s+/g, " ").trim();
  const words = normalized.split(" ");
  if (normalized.length <= 15 || words.length <= 2) return normalized;

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 12 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3).join("\n");
}

function PatternDiagram({ seed, color }: { seed: number; color: string }) {
  const variant = seed % 4;

  if (variant === 0) {
    return (
      <div className="absolute inset-0 opacity-35">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${color}22 1px, transparent 1px), linear-gradient(90deg, ${color}22 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div
          className="absolute bottom-[13%] left-[18%] h-px w-[64%]"
          style={{ background: color }}
        />
        <div
          className="absolute bottom-[13%] left-[18%] size-2 rounded-full"
          style={{ background: color }}
        />
        <div
          className="absolute bottom-[25%] right-[18%] size-2 rounded-full"
          style={{ background: color }}
        />
        <div
          className="absolute bottom-[25%] right-[18%] h-[26%] w-px"
          style={{ background: color }}
        />
      </div>
    );
  }

  if (variant === 1) {
    return (
      <div className="absolute inset-0 opacity-35">
        <div
          className="absolute left-[12%] top-[18%] h-[42%] w-[24%] rounded-[1.4rem] border"
          style={{ borderColor: color }}
        />
        <div
          className="absolute right-[14%] top-[28%] h-[20%] w-[30%] rounded-full border"
          style={{ borderColor: color }}
        />
        <div
          className="absolute bottom-[18%] left-[18%] h-px w-[58%]"
          style={{ background: color }}
        />
        <div
          className="absolute bottom-[18%] right-[20%] size-3 rounded-full"
          style={{ background: color }}
        />
      </div>
    );
  }

  if (variant === 2) {
    return (
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute -left-[16%] top-[13%] size-[62%] rounded-full border"
          style={{ borderColor: color }}
        />
        <div
          className="absolute right-[8%] top-[18%] size-[34%] rounded-full border"
          style={{ borderColor: color }}
        />
        <div className="absolute bottom-[18%] left-[14%] flex gap-2">
          {[0, 1, 2, 3].map((item) => (
            <span
              key={item}
              className="block size-2 rounded-full"
              style={{ background: color }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 opacity-30">
      <div
        className="absolute right-[12%] top-[12%] h-[72%] w-px"
        style={{ background: color }}
      />
      <div
        className="absolute bottom-[18%] left-[12%] h-px w-[76%]"
        style={{ background: color }}
      />
      <div
        className="absolute right-[10%] top-[22%] size-3 rounded-sm"
        style={{ background: color }}
      />
      <div
        className="absolute right-[26%] bottom-[16%] size-3 rounded-sm"
        style={{ background: color }}
      />
      <div
        className="absolute left-[18%] top-[30%] h-[16%] w-[34%] rounded-xl border"
        style={{ borderColor: color }}
      />
    </div>
  );
}

interface PostCoverCardProps {
  post: PostInfo;
  priority?: boolean;
}

export function PostCoverCard({ post, priority = false }: PostCoverCardProps) {
  const seed = hashText(`${post.href}:${post.title}`);
  const palette = PALETTES[seed % PALETTES.length]!;
  const title = splitTitle(post.title);
  const hasImage = Boolean(post.cover?.src);

  return (
    <Link
      href={post.href}
      className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gray-900 dark:focus-visible:outline-gray-100"
      aria-label={`${post.title} 글로 이동`}
    >
      <article
        className="relative aspect-square overflow-hidden border border-white/70 bg-gray-100 shadow-sm transition duration-300 group-hover:-translate-y-1 group-hover:shadow-xl dark:border-gray-900/70"
        style={{
          backgroundColor: palette.background,
          color: palette.foreground,
        }}
      >
        {hasImage ? (
          <img
            src={post.cover!.src}
            alt={post.cover?.alt ?? ""}
            className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading={priority ? "eager" : "lazy"}
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: hasImage
              ? "linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.74))"
              : `radial-gradient(circle at ${20 + (seed % 50)}% ${20 + (seed % 50)}%, ${palette.soft}, transparent 38%)`,
          }}
        />
        {!hasImage ? (
          <PatternDiagram seed={seed} color={palette.foreground} />
        ) : null}

        <div
          className="absolute left-[8%] right-[8%] top-[10%] flex items-center justify-between text-[0.62rem] font-bold uppercase tracking-[0.18em]"
          style={{ color: hasImage ? "rgba(255,255,255,0.78)" : palette.muted }}
        >
          <span>{post.category}</span>
          <time>{formatDate(post.date)}</time>
        </div>

        <div className="absolute inset-x-[8%] bottom-[9%]">
          <h3 className="whitespace-pre-line font-heading text-[clamp(1.3rem,4.7vw,2.55rem)] font-black leading-[1.02] tracking-[-0.06em] sm:text-[clamp(1.25rem,2.45vw,2.2rem)]">
            {title}
            <span style={{ color: hasImage ? "#ff2a35" : palette.accent }}>
              .
            </span>
          </h3>
          <div className="mt-5 flex items-end justify-between gap-3">
            <p
              className="line-clamp-2 max-w-[72%] text-xs font-semibold leading-relaxed"
              style={{
                color: hasImage ? "rgba(255,255,255,0.78)" : palette.muted,
              }}
            >
              {post.description || post.tags.slice(0, 2).join(" · ")}
            </p>
            <img
              src="/logo.ico"
              alt="SEOJing"
              className="size-10 shrink-0 object-contain drop-shadow-[0_1px_6px_rgba(0,0,0,0.35)] transition group-hover:scale-105"
              loading="lazy"
            />
          </div>
        </div>
      </article>
    </Link>
  );
}
