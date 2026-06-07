import { blogUrl } from "@/shared/config/site";

export type TtsArtifactKind = "summary-2m" | "core-5m" | "section";
export type TtsArtifactStatus = "pending" | "ready" | "failed";

export interface TtsSection {
  id: string;
  title: string;
  level: number;
  text: string;
  order: number;
}

export interface TtsArtifact {
  id: string;
  kind: TtsArtifactKind;
  slug: string;
  canonicalUrl: string;
  sectionId: string | null;
  chunkId: string;
  title: string;
  locale: "ko-KR";
  targetDurationSeconds: number | null;
  text: string;
  audioPath: string;
  transcriptPath: string;
  status: TtsArtifactStatus;
  degradedReason: string | null;
}

export interface TtsArticleManifest {
  version: 1;
  slug: string;
  canonicalUrl: string;
  title: string;
  generatedAt: string;
  cacheKey: string;
  artifacts: TtsArtifact[];
  sections: TtsSection[];
}

export interface BuildTtsManifestInput {
  slug: string;
  title: string;
  source: string;
  generatedAt?: string;
}

const TWO_MINUTE_MAX_WORDS = 360;
const FIVE_MINUTE_MAX_WORDS = 900;
const SECTION_MAX_WORDS = 520;

export function buildTtsArticleManifest({
  slug,
  title,
  source,
  generatedAt = new Date().toISOString(),
}: BuildTtsManifestInput): TtsArticleManifest {
  const canonicalUrl = blogUrl(slug.split("/"));
  const bodyText = normalizeText(stripMdx(source));
  const sections = extractTtsSections(source);
  const cacheKey = `tts:v1:${slug}`;

  const artifacts: TtsArtifact[] = [
    createArtifact({
      slug,
      canonicalUrl,
      kind: "summary-2m",
      sectionId: null,
      orderKey: "summary-2m",
      title: `${title} — 2분 요약`,
      targetDurationSeconds: 120,
      text: firstWords(bodyText, TWO_MINUTE_MAX_WORDS),
    }),
    createArtifact({
      slug,
      canonicalUrl,
      kind: "core-5m",
      sectionId: null,
      orderKey: "core-5m",
      title: `${title} — 5분 핵심`,
      targetDurationSeconds: 300,
      text: firstWords(bodyText, FIVE_MINUTE_MAX_WORDS),
    }),
  ];

  for (const section of sections) {
    artifacts.push(
      createArtifact({
        slug,
        canonicalUrl,
        kind: "section",
        sectionId: section.id,
        orderKey: `section-${section.order.toString().padStart(3, "0")}`,
        title: `${title} — ${section.title}`,
        targetDurationSeconds: null,
        text: firstWords(section.text, SECTION_MAX_WORDS),
      }),
    );
  }

  return {
    version: 1,
    slug,
    canonicalUrl,
    title,
    generatedAt,
    cacheKey,
    artifacts,
    sections,
  };
}

export function extractTtsSections(source: string): TtsSection[] {
  const lines = source.split(/\r?\n/);
  const sections: TtsSection[] = [];
  let current: TtsSection | null = null;
  const seenIds = new Map<string, number>();

  for (const line of lines) {
    const heading = /^(#{2,4})\s+(.+?)\s*$/.exec(line.trim());
    if (heading) {
      if (current) current.text = normalizeText(stripMdx(current.text));
      const title = stripInlineMdx(heading[2] ?? "섹션");
      const baseId = slugify(title) || `section-${sections.length + 1}`;
      const count = seenIds.get(baseId) ?? 0;
      seenIds.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
      current = {
        id,
        title,
        level: heading[1]?.length ?? 2,
        text: "",
        order: sections.length + 1,
      };
      sections.push(current);
      continue;
    }

    if (current) {
      current.text += `${line}\n`;
    }
  }

  if (current) current.text = normalizeText(stripMdx(current.text));
  return sections.filter((section) => section.text.length > 0);
}

export function stripMdx(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^---\s*\n[\s\S]*?\n---\s*(?:\n|$)/, " ")
    .replace(/^import\s+.+$/gm, " ")
    .replace(/^export\s+.+$/gm, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[~*_{}]/g, " ");
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function createArtifact(input: {
  slug: string;
  canonicalUrl: string;
  kind: TtsArtifactKind;
  sectionId: string | null;
  orderKey: string;
  title: string;
  targetDurationSeconds: number | null;
  text: string;
}): TtsArtifact {
  const safeSlug = input.slug
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const artifactId = `${safeSlug.replace(/\//g, "__")}__${input.orderKey}`;
  const basePath = `/tts-artifacts/${safeSlug}/${input.orderKey}`;
  return {
    id: artifactId,
    kind: input.kind,
    slug: input.slug,
    canonicalUrl: input.canonicalUrl,
    sectionId: input.sectionId,
    chunkId: input.sectionId ?? input.orderKey,
    title: input.title,
    locale: "ko-KR",
    targetDurationSeconds: input.targetDurationSeconds,
    text: input.text,
    audioPath: `${basePath}.mp3`,
    transcriptPath: `${basePath}.txt`,
    status: input.text ? "pending" : "failed",
    degradedReason: input.text ? null : "empty-source-text",
  };
}

function firstWords(text: string, maxWords: number): string {
  const words = normalizeText(text).split(" ").filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ")} …`;
}

function stripInlineMdx(value: string): string {
  return normalizeText(
    value
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[~*_{}]/g, ""),
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
