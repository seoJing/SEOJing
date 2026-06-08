import fs from "node:fs";
import path from "node:path";
import { getContentBySlug } from "@app/utils/content";
import type { ContentFrontmatter } from "@app/utils";
import PptxGenJS from "pptxgenjs";
import {
  buildPresentationExportManifest,
  type PresentationExportManifest,
  type PresentationExportScene,
} from "../src/shared/presentation/presentation-export";

const CONTENT_DIR = path.resolve(import.meta.dirname, "../content");
const OUTPUT_DIR = path.resolve(
  import.meta.dirname,
  "../public/presentation-artifacts",
);

interface CliOptions {
  slug: string | null;
  outDir: string;
  pptx: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    slug: null,
    outDir: OUTPUT_DIR,
    pptx: true,
    json: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--slug") {
      options.slug = readOptionValue(argv, index, "--slug");
      index += 1;
    } else if (arg === "--out-dir") {
      options.outDir = path.resolve(readOptionValue(argv, index, "--out-dir"));
      index += 1;
    } else if (arg === "--json-only") {
      options.pptx = false;
      options.json = true;
    } else if (arg === "--pptx-only") {
      options.pptx = true;
      options.json = false;
    }
  }

  return options;
}

function readOptionValue(
  argv: string[],
  index: number,
  option: string,
): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} 옵션에는 값이 필요합니다.`);
  }

  return value;
}

function titleOf(frontmatter: ContentFrontmatter, slug: string): string {
  return frontmatter.title || slug.split("/").at(-1) || slug;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(
    `${filePath}.tmp`,
    `${JSON.stringify(value, null, 2)}\n`,
    "utf-8",
  );
  fs.renameSync(`${filePath}.tmp`, filePath);
}

function slugOutputDir(baseOutDir: string, slug: string): string {
  const segments = slug.split("/");
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes(path.sep) ||
        (path.win32.sep !== path.sep && segment.includes(path.win32.sep)),
    )
  ) {
    throw new Error(`잘못된 content slug입니다: ${slug}`);
  }

  const resolvedBase = path.resolve(baseOutDir);
  const resolvedOutputDir = path.resolve(
    resolvedBase,
    ...segments.map(encodeURIComponent),
  );

  if (
    resolvedOutputDir !== resolvedBase &&
    !resolvedOutputDir.startsWith(`${resolvedBase}${path.sep}`)
  ) {
    throw new Error(`출력 경로가 out-dir 범위를 벗어났습니다: ${slug}`);
  }

  return resolvedOutputDir;
}

function createManifest(slug: string): PresentationExportManifest {
  const content = getContentBySlug(CONTENT_DIR, slug.split("/"));
  if (!content) {
    throw new Error(`content slug를 찾을 수 없습니다: ${slug}`);
  }

  return buildPresentationExportManifest({
    slug,
    title: titleOf(content.frontmatter, slug),
    source: content.source,
  });
}

function sanitizePptxText(value: string): string {
  return value
    .replace(/[\t\r]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function addSceneSlide(
  pptx: PptxGenJS,
  scene: PresentationExportScene,
  totalSlides: number,
) {
  const slide = pptx.addSlide();
  const isTitle = scene.kind === "title" || scene.order === 1;
  const bgColor = isTitle ? "111827" : "FFFBF2";
  const fgColor = isTitle ? "FFFFFF" : "111827";
  const accentColor = isTitle ? "F4D35E" : "6B4EFF";

  slide.background = { color: bgColor };
  slide.addText(scene.title, {
    x: 0.55,
    y: isTitle ? 1.25 : 0.45,
    w: 8.9,
    h: isTitle ? 1.25 : 0.72,
    fontFace: "Apple SD Gothic Neo",
    fontSize: isTitle ? 30 : 22,
    bold: true,
    color: fgColor,
    margin: 0,
    fit: "shrink",
  });

  if (scene.summary) {
    slide.addText(scene.summary, {
      x: 0.58,
      y: isTitle ? 2.58 : 1.25,
      w: 8.4,
      h: isTitle ? 1.05 : 0.82,
      fontFace: "Apple SD Gothic Neo",
      fontSize: isTitle ? 15 : 12.5,
      color: isTitle ? "E5E7EB" : "374151",
      margin: 0,
      breakLine: false,
      fit: "shrink",
    });
  }

  const bulletY = isTitle ? 3.78 : 2.25;
  const bulletH = isTitle ? 1.45 : 2.55;
  const bulletText = scene.bullets.map((bullet) => `• ${bullet}`).join("\n");
  if (bulletText) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.55,
      y: bulletY - 0.18,
      w: 8.3,
      h: bulletH,
      rectRadius: 0.08,
      fill: { color: isTitle ? "1F2937" : "FFFFFF", transparency: 6 },
      line: { color: isTitle ? "374151" : "E5E7EB", transparency: 30 },
    });
    slide.addText(bulletText, {
      x: 0.85,
      y: bulletY,
      w: 7.75,
      h: bulletH - 0.25,
      fontFace: "Apple SD Gothic Neo",
      fontSize: 12.5,
      color: fgColor,
      breakLine: false,
      fit: "shrink",
      margin: 0.05,
      valign: "middle",
    });
  }

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.55,
    y: 5.02,
    w: 0.42,
    h: 0.05,
    fill: { color: accentColor },
    line: { color: accentColor },
  });
  slide.addText(`${scene.order}/${totalSlides} · ${scene.pptx.layoutHint}`, {
    x: 1.1,
    y: 4.88,
    w: 3.3,
    h: 0.3,
    fontFace: "Apple SD Gothic Neo",
    fontSize: 8.5,
    color: isTitle ? "D1D5DB" : "6B7280",
    margin: 0,
  });

  if (scene.tts) {
    slide.addText(`TTS ${scene.tts.kind}: ${scene.tts.transcriptPath}`, {
      x: 5.15,
      y: 4.86,
      w: 3.75,
      h: 0.34,
      fontFace: "Menlo",
      fontSize: 7.2,
      color: isTitle ? "D1D5DB" : "6B7280",
      margin: 0,
      fit: "shrink",
      align: "right",
    });
  }

  slide.addNotes(sanitizePptxText(scene.pptx.notes));
}

async function writePptx(
  manifest: PresentationExportManifest,
  filePath: string,
) {
  const PptxCtor = ((PptxGenJS as unknown as { default?: typeof PptxGenJS })
    .default ?? PptxGenJS) as typeof PptxGenJS;
  const pptx = new PptxCtor();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "SEOJing / Hermes";
  pptx.subject = "SEOJing presentation export spike";
  pptx.title = manifest.title;
  pptx.company = "SEOJing";
  pptx.theme = {
    headFontFace: "Apple SD Gothic Neo",
    bodyFontFace: "Apple SD Gothic Neo",
  };

  for (const scene of manifest.scenes) {
    addSceneSlide(pptx, scene, manifest.scenes.length);
  }

  ensureDir(path.dirname(filePath));
  await pptx.writeFile({ fileName: filePath });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.slug) {
    console.error(
      "사용법: pnpm --filter @app/web run export:presentation -- --slug <content/slug> [--out-dir <dir>] [--json-only|--pptx-only]",
    );
    process.exit(1);
  }

  const manifest = createManifest(options.slug);
  const outDir = slugOutputDir(options.outDir, options.slug);
  const manifestPath = path.join(outDir, "manifest.json");
  const pptxPath = path.join(outDir, manifest.pptx.fileName);

  if (options.json) writeJson(manifestPath, manifest);
  if (options.pptx) await writePptx(manifest, pptxPath);

  console.log(
    `presentation export 완료: ${manifest.slug} · scenes ${manifest.scenes.length}`,
  );
  if (options.json) console.log(`manifest: ${manifestPath}`);
  if (options.pptx) console.log(`pptx: ${pptxPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
