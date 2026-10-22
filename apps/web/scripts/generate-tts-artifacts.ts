import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildNativeTtsArticleManifest,
  type NativeTtsDocument,
  type NativeTtsNode,
  type TtsArticleManifest,
} from "../src/shared/tts/tts-artifacts";

const DEFAULT_OUTPUT_DIR = path.resolve(
  import.meta.dirname,
  "../public/tts-artifacts",
);

interface NativeArticleInput {
  slug: string;
  title: string;
  document: NativeTtsDocument;
}

interface TtsIndexEntry {
  slug: string;
  title: string;
  canonicalUrl: string;
  manifestPath: string;
  artifactCount: number;
  sectionCount: number;
  generatedAt: string;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validateNode(
  value: unknown,
  location: string,
  state: { count: number },
): NativeTtsNode {
  const node = object(value);
  if (!node || typeof node.type !== "string" || !node.type.trim())
    throw new Error(
      location + ": native DOCUMENT node requires a nonblank type",
    );
  state.count++;
  if (state.count > 100_000)
    throw new Error(
      "native DOCUMENT export exceeds the 100000-node safety limit",
    );
  if (node.text !== undefined && typeof node.text !== "string")
    throw new Error(location + ".text: expected string");
  if (node.attrs !== undefined && !object(node.attrs))
    throw new Error(location + ".attrs: expected object");
  if (node.content !== undefined && !Array.isArray(node.content))
    throw new Error(location + ".content: expected array");
  return {
    type: node.type,
    ...(node.text === undefined ? {} : { text: node.text as string }),
    ...(node.attrs === undefined
      ? {}
      : { attrs: node.attrs as Record<string, unknown> }),
    ...(node.content === undefined
      ? {}
      : {
          content: node.content.map((child, index) =>
            validateNode(child, location + ".content[" + index + "]", state),
          ),
        }),
  };
}

export function validateNativeArticleExport(
  input: unknown,
): NativeArticleInput[] {
  if (!Array.isArray(input) || input.length === 0)
    throw new Error("native DOCUMENT export must be a non-empty array");
  const slugs = new Set<string>();
  return input.map((value, index) => {
    const article = object(value);
    const location = "articles[" + index + "]";
    if (!article) throw new Error(location + ": expected object");
    if (typeof article.slug !== "string" || !article.slug.trim())
      throw new Error(location + ".slug: expected nonblank string");
    const slug = article.slug;
    const segments = slug.split("/");
    if (
      slug.startsWith("/") ||
      slug.endsWith("/") ||
      segments.some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          segment.includes("\\") ||
          segment.includes("%2f") ||
          segment.includes("%2F"),
      )
    )
      throw new Error(location + ".slug: unsafe artifact path");
    if (slugs.has(slug)) throw new Error(location + ".slug: duplicate slug");
    slugs.add(slug);
    if (typeof article.title !== "string" || !article.title.trim())
      throw new Error(location + ".title: expected nonblank string");
    if (article.status !== undefined && article.status !== "PUBLISHED")
      throw new Error(
        location + ".status: only PUBLISHED articles are accepted",
      );
    const body = object(article.body);
    const rawDocument = object(body?.document ?? article.document);
    if (
      !rawDocument ||
      rawDocument.type !== "doc" ||
      !Array.isArray(rawDocument.content) ||
      rawDocument.content.length === 0
    )
      throw new Error(location + ": native DOCUMENT body is required");
    const state = { count: 0 };
    const document: NativeTtsDocument = {
      type: "doc",
      content: rawDocument.content.map((node, nodeIndex) =>
        validateNode(
          node,
          location + ".document.content[" + nodeIndex + "]",
          state,
        ),
      ),
    };
    return { slug, title: article.title, document };
  });
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(
    filePath + ".tmp",
    JSON.stringify(value, null, 2) + "\n",
    "utf8",
  );
  fs.renameSync(filePath + ".tmp", filePath);
}

function writeTranscript(filePath: string, text: string) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath + ".tmp", text + "\n", "utf8");
  fs.renameSync(filePath + ".tmp", filePath);
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

export function generateNativeTtsArtifacts(options: {
  inputPath: string;
  outputDir?: string;
  generatedAt?: string;
}): TtsIndexEntry[] {
  const parsed: unknown = JSON.parse(
    fs.readFileSync(options.inputPath, "utf8"),
  );
  const articles = validateNativeArticleExport(parsed);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(generatedAt)))
    throw new Error("generatedAt must be an ISO-compatible timestamp");
  const manifests = articles
    .map((article) =>
      buildNativeTtsArticleManifest({ ...article, generatedAt }),
    )
    .sort((a, b) => a.slug.localeCompare(b.slug, "ko", { numeric: true }));
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);

  // No existing artifact is touched until the complete input and all manifests validate.
  cleanGeneratedArtifacts(outputDir);
  const entries = manifests.map((manifest: TtsArticleManifest) => {
    writeJson(path.join(outputDir, manifest.slug, "manifest.json"), manifest);
    for (const artifact of manifest.artifacts) {
      const relativePath = artifact.transcriptPath.replace(
        /^\/tts-artifacts\//,
        "",
      );
      writeTranscript(path.join(outputDir, relativePath), artifact.text);
    }
    return {
      slug: manifest.slug,
      title: manifest.title,
      canonicalUrl: manifest.canonicalUrl,
      manifestPath: "/tts-artifacts/" + manifest.slug + "/manifest.json",
      artifactCount: manifest.artifacts.length,
      sectionCount: manifest.sections.length,
      generatedAt,
    };
  });
  writeJson(path.join(outputDir, "index.json"), {
    version: 1,
    generatedAt,
    entries,
  });
  return entries;
}

function readArgs(argv: string[]) {
  argv = argv.filter((arg) => arg !== "--");
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (
      !key ||
      !["--input", "--output", "--generated-at"].includes(key) ||
      !value
    )
      throw new Error(
        "Usage: generate:tts --input native-articles.json [--output DIR] [--generated-at ISO]",
      );
    values.set(key, value);
  }
  const inputPath = values.get("--input");
  if (!inputPath)
    throw new Error(
      "Usage: generate:tts --input native-articles.json [--output DIR] [--generated-at ISO]",
    );
  return {
    inputPath: path.resolve(inputPath),
    outputDir: values.get("--output"),
    generatedAt: values.get("--generated-at"),
  };
}

function main() {
  const entries = generateNativeTtsArtifacts(readArgs(process.argv.slice(2)));
  console.log(
    "tts artifact manifest 생성 완료: 글 " +
      entries.length +
      "개, artifact " +
      entries.reduce((sum, entry) => sum + entry.artifactCount, 0) +
      "개",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
