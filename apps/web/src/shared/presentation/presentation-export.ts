import {
  nextCodeFenceState,
  type CodeFenceState,
} from "@/shared/lib/code-fence";
import {
  buildTtsArticleManifest,
  normalizeText,
  stripMdx,
  type TtsArticleManifest,
  type TtsArtifact,
} from "@/shared/tts/tts-artifacts";

export type PresentationExportVersion = 1;
export type PresentationSceneKind = "title" | "section" | "content";
export type PresentationPptxLayoutHint =
  | "title"
  | "section"
  | "code"
  | "image"
  | "bullets";

export interface PresentationTtsBridge {
  artifactId: string;
  kind: TtsArtifact["kind"];
  sectionId: string | null;
  transcriptPath: string;
  audioPath: string;
  status: TtsArtifact["status"];
}

export interface PresentationExportScene {
  id: string;
  order: number;
  kind: PresentationSceneKind;
  title: string;
  level: number;
  sourceHeadingId: string | null;
  summary: string;
  bullets: string[];
  speakerScript: string;
  tts: PresentationTtsBridge | null;
  pptx: {
    layoutHint: PresentationPptxLayoutHint;
    notes: string;
  };
}

export interface PresentationExportManifest {
  version: PresentationExportVersion;
  slug: string;
  canonicalUrl: string;
  title: string;
  generatedAt: string;
  exportStrategy: "pptxgenjs-spike";
  ttsCacheKey: string;
  pptx: {
    fileName: string;
    slideCount: number;
    supported: true;
    limitations: string[];
  };
  scenes: PresentationExportScene[];
}

export interface BuildPresentationExportManifestInput {
  slug: string;
  title: string;
  source: string;
  generatedAt?: string;
  ttsManifest?: TtsArticleManifest;
}

interface RawScene {
  kind: PresentationSceneKind;
  title: string;
  level: number;
  headingId: string | null;
  body: string;
  raw: string;
}

const MAX_SUMMARY_WORDS = 34;
const MAX_BULLETS = 4;
const MAX_BULLET_WORDS = 18;
const MAX_SCRIPT_WORDS = 95;

export function buildPresentationExportManifest({
  slug,
  title,
  source,
  generatedAt = new Date().toISOString(),
  ttsManifest = buildTtsArticleManifest({
    slug,
    title,
    source,
    generatedAt,
  }),
}: BuildPresentationExportManifestInput): PresentationExportManifest {
  const rawScenes = extractPresentationScenes(source, title);
  const scenes = rawScenes.map((scene, index) => {
    const tts = findTtsBridgeForScene(scene, ttsManifest);
    const cleanBody = normalizeText(stripMdx(scene.body));
    const speakerScript = buildSpeakerScript(scene.title, cleanBody);
    const bullets = extractSceneBullets(scene.raw, cleanBody);
    const layoutHint = inferLayoutHint(scene.raw, scene.kind);

    return {
      id: `${String(index + 1).padStart(2, "0")}-${slugify(scene.title) || "scene"}`,
      order: index + 1,
      kind: scene.kind,
      title: scene.title,
      level: scene.level,
      sourceHeadingId: scene.headingId,
      summary: firstWords(cleanBody || scene.title, MAX_SUMMARY_WORDS),
      bullets,
      speakerScript,
      tts,
      pptx: {
        layoutHint,
        notes: speakerScript,
      },
    } satisfies PresentationExportScene;
  });

  return {
    version: 1,
    slug,
    canonicalUrl: ttsManifest.canonicalUrl,
    title,
    generatedAt,
    exportStrategy: "pptxgenjs-spike",
    ttsCacheKey: ttsManifest.cacheKey,
    pptx: {
      fileName: `${slug.split("/").map(slugify).filter(Boolean).join("__") || "presentation"}.pptx`,
      slideCount: scenes.length,
      supported: true,
      limitations: [
        "브라우저 프레젠테이션의 DOM/애니메이션을 그대로 캡처하지 않고 H1/H2/H3 scene 기반 정적 deck으로 변환한다.",
        "코드·이미지는 현재 layoutHint와 텍스트 요약까지만 전달하며, 원본 시각 요소의 픽셀 완전성은 별도 렌더러가 필요하다.",
        "MP3는 PPTX에 임베드하지 않고 speaker notes와 TTS transcript/audio path bridge로 연결한다.",
      ],
    },
    scenes,
  };
}

export function extractPresentationScenes(
  source: string,
  title: string,
): RawScene[] {
  const lines = source.split(/\r?\n/);
  const scenes: RawScene[] = [];
  let current: RawScene | null = null;
  let preface = "";
  const seenIds = new Map<string, number>();
  let codeFence: CodeFenceState | null = null;

  const pushCurrent = () => {
    if (!current) return;
    const body = normalizeText(stripMdx(current.body));
    if (body || current.title) scenes.push(current);
    current = null;
  };

  for (const line of lines) {
    codeFence = nextCodeFenceState(codeFence, line);

    const heading = codeFence
      ? null
      : /^(#{1,3})\s+(.+?)\s*$/.exec(line.trim());
    if (heading) {
      pushCurrent();
      const headingTitle = stripInlineMdx(heading[2] ?? "섹션");
      const headingLevel = heading[1]?.length ?? 1;
      const sectionCount = scenes.filter(
        (candidate) => candidate.level > 1,
      ).length;
      const baseId = slugify(headingTitle) || `section-${sectionCount + 1}`;
      const duplicateCount = seenIds.get(baseId) ?? 0;
      seenIds.set(baseId, duplicateCount + 1);
      current = {
        kind: headingLevel === 1 ? "title" : "section",
        title: headingTitle,
        level: headingLevel,
        headingId:
          duplicateCount === 0 ? baseId : `${baseId}-${duplicateCount + 1}`,
        body: "",
        raw: `${line}\n`,
      };
      continue;
    }

    if (current) {
      current.body += `${line}\n`;
      current.raw += `${line}\n`;
    } else {
      preface += `${line}\n`;
    }
  }

  pushCurrent();

  const cleanPreface = normalizeText(stripMdx(preface));
  if (cleanPreface) {
    scenes.unshift({
      kind: "title",
      title,
      level: 1,
      headingId: null,
      body: preface,
      raw: preface,
    });
  }

  if (scenes.length === 0) {
    scenes.push({
      kind: "title",
      title,
      level: 1,
      headingId: null,
      body: source,
      raw: source,
    });
  }

  return scenes;
}

function findTtsBridgeForScene(
  scene: RawScene,
  ttsManifest: TtsArticleManifest,
): PresentationTtsBridge | null {
  let artifact: TtsArtifact | undefined;

  if (scene.kind === "section" && scene.headingId) {
    artifact = ttsManifest.artifacts.find(
      (candidate) =>
        candidate.kind === "section" && candidate.sectionId === scene.headingId,
    );
  }

  if (!artifact && scene.kind === "title") {
    artifact = ttsManifest.artifacts.find(
      (candidate) => candidate.kind === "summary-2m",
    );
  }

  if (!artifact) return null;

  return {
    artifactId: artifact.id,
    kind: artifact.kind,
    sectionId: artifact.sectionId,
    transcriptPath: artifact.transcriptPath,
    audioPath: artifact.audioPath,
    status: artifact.status,
  };
}

function buildSpeakerScript(title: string, cleanBody: string): string {
  const body = firstWords(cleanBody, MAX_SCRIPT_WORDS);
  return body ? `${title}. ${body}` : title;
}

function inferLayoutHint(
  rawScene: string,
  kind: PresentationSceneKind,
): PresentationPptxLayoutHint {
  if (kind === "title") return "title";
  if (/(?:`{3,}|~{3,})|<pre\b|\bdata-code-block\b/.test(rawScene))
    return "code";
  if (/!\[[^\]]*\]\([^)]+\)|<img|<figure/.test(rawScene)) return "image";
  if (/^\s*(?:[-*+]\s+|\d+\.\s+)/m.test(rawScene)) return "bullets";
  return "section";
}

function extractSceneBullets(rawScene: string, cleanBody: string): string[] {
  const markdownBullets: string[] = [];
  let codeFence: CodeFenceState | null = null;

  for (const line of rawScene.split(/\r?\n/)) {
    const nextFence = nextCodeFenceState(codeFence, line);
    if (nextFence !== codeFence) {
      codeFence = nextFence;
      continue;
    }
    if (codeFence) continue;

    const bullet = /^\s*(?:[-*+]\s+|\d+\.\s+)(.+)$/.exec(line)?.[1];
    if (!bullet) continue;

    const cleanBullet = firstWords(
      normalizeText(stripMdx(bullet)),
      MAX_BULLET_WORDS,
    );
    if (cleanBullet) markdownBullets.push(cleanBullet);
    if (markdownBullets.length >= MAX_BULLETS) break;
  }

  if (markdownBullets.length > 0) return markdownBullets;

  return splitSentences(cleanBody)
    .map((sentence) => firstWords(sentence, MAX_BULLET_WORDS))
    .filter(Boolean)
    .slice(0, MAX_BULLETS);
}

function splitSentences(value: string): string[] {
  return normalizeText(value)
    .split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
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
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
