import fs from "node:fs";
import path from "node:path";
import { getContentBySlug } from "@app/utils/content";
import type { ContentFrontmatter } from "@app/utils";
import { buildTtsArticleManifest } from "../src/shared/tts/tts-artifacts";

const CONTENT_DIR = path.resolve(import.meta.dirname, "../content");
const OUTPUT_DIR = path.resolve(import.meta.dirname, "../public/tts-artifacts");

interface TtsIndexEntry {
  slug: string;
  title: string;
  canonicalUrl: string;
  manifestPath: string;
  artifactCount: number;
  sectionCount: number;
  generatedAt: string;
}

function collectSlugs(contentDir: string, basePath: string = ""): string[] {
  const dirPath = path.join(contentDir, basePath);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const slugs: string[] = [];

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      slugs.push(...collectSlugs(contentDir, relativePath));
    } else if (entry.isFile() && /\.(mdx|md)$/i.test(entry.name)) {
      slugs.push(relativePath.replace(/\.(mdx|md)$/i, ""));
    }
  }

  return slugs.sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
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

function writeTranscript(filePath: string, text: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(`${filePath}.tmp`, `${text}\n`, "utf-8");
  fs.renameSync(`${filePath}.tmp`, filePath);
}

function cleanGeneratedArtifacts(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      cleanGeneratedArtifacts(fullPath);
      if (fs.readdirSync(fullPath).length === 0) fs.rmdirSync(fullPath);
    } else if (/\.(json|txt)$/i.test(entry.name)) {
      fs.unlinkSync(fullPath);
    }
  }
}

function titleOf(frontmatter: ContentFrontmatter, slug: string): string {
  return frontmatter.title || slug.split("/").at(-1) || slug;
}

function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`content 디렉토리가 없습니다: ${CONTENT_DIR}`);
    process.exit(1);
  }

  cleanGeneratedArtifacts(OUTPUT_DIR);

  const generatedAt = new Date().toISOString();
  const entries: TtsIndexEntry[] = [];

  for (const slug of collectSlugs(CONTENT_DIR)) {
    const content = getContentBySlug(CONTENT_DIR, slug.split("/"));
    if (!content) continue;

    const manifest = buildTtsArticleManifest({
      slug,
      title: titleOf(content.frontmatter, slug),
      source: content.source,
      generatedAt,
    });

    const manifestPath = path.join(OUTPUT_DIR, slug, "manifest.json");
    writeJson(manifestPath, manifest);

    for (const artifact of manifest.artifacts) {
      const transcriptPath = path.join(
        OUTPUT_DIR,
        artifact.transcriptPath.replace(/^\/tts-artifacts\//, ""),
      );
      writeTranscript(transcriptPath, artifact.text);
    }

    entries.push({
      slug,
      title: manifest.title,
      canonicalUrl: manifest.canonicalUrl,
      manifestPath: `/tts-artifacts/${slug}/manifest.json`,
      artifactCount: manifest.artifacts.length,
      sectionCount: manifest.sections.length,
      generatedAt,
    });
  }

  writeJson(path.join(OUTPUT_DIR, "index.json"), {
    version: 1,
    generatedAt,
    entries,
  });

  console.log(
    `tts artifact manifest 생성 완료: 글 ${entries.length}개, artifact ${entries.reduce(
      (sum, entry) => sum + entry.artifactCount,
      0,
    )}개`,
  );
}

main();
