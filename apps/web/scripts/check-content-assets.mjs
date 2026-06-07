#!/usr/bin/env node
/* global console */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const webRoot = path.join(repoRoot, "apps/web");
const contentRoot = path.join(webRoot, "content");
const publicRoot = path.join(webRoot, "public");

const strict = process.argv.includes("--strict");
const allowedExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".svg",
  ".gif",
]);

/** @type {{level: 'error' | 'warning', file: string, message: string}[]} */
const findings = [];

function add(level, file, message) {
  findings.push({ level, file: path.relative(repoRoot, file), message });
}

function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (/\.mdx?$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function getQuotedAttr(attrs, name) {
  const match = attrs.match(new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "s"));
  return match?.[2];
}

function parseFrontmatter(source) {
  if (!source.startsWith("---\n")) return undefined;
  const end = source.indexOf("\n---", 4);
  if (end === -1) return undefined;
  return source.slice(4, end);
}

function parseFrontmatterImage(frontmatter) {
  if (!frontmatter) return undefined;
  const lines = frontmatter.split("\n");
  const imageIndex = lines.findIndex((line) => /^image:\s*$/.test(line));
  if (imageIndex === -1) return undefined;

  /** @type {Record<string, string>} */
  const image = {};
  for (const line of lines.slice(imageIndex + 1)) {
    if (/^\S/.test(line)) break;
    const match = line.match(/^\s{2,}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    image[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return image;
}

function isExternal(src) {
  return (
    /^(https?:)?\/\//.test(src) ||
    src.startsWith("data:") ||
    src.startsWith("mailto:")
  );
}

function checkPublicSrc(file, src, context) {
  if (!src || isExternal(src) || src.startsWith("#")) return;

  if (!src.startsWith("/")) {
    add(
      "error",
      file,
      `${context}: local image path must be absolute from public root: ${src}`,
    );
    return;
  }

  if (src.startsWith("/_vinext/image")) {
    add(
      "error",
      file,
      `${context}: do not use generated Vinext image URLs in MDX source: ${src}`,
    );
    return;
  }

  const normalizedSrc = src.split(/[?#]/, 1)[0];
  const extension = path.extname(normalizedSrc).toLowerCase();
  if (extension && !allowedExtensions.has(extension)) {
    add(
      "warning",
      file,
      `${context}: unusual image extension ${extension}: ${src}`,
    );
  }

  if (normalizedSrc.split("/").includes("..")) {
    add(
      "error",
      file,
      `${context}: local image path must not contain traversal segments: ${src}`,
    );
    return;
  }

  const publicPath = path.resolve(publicRoot, normalizedSrc.replace(/^\//, ""));
  const relativePublicPath = path.relative(publicRoot, publicPath);
  if (
    relativePublicPath.startsWith("..") ||
    path.isAbsolute(relativePublicPath)
  ) {
    add(
      "error",
      file,
      `${context}: local image path must stay inside apps/web/public: ${src}`,
    );
    return;
  }

  if (!fs.existsSync(publicPath)) {
    const level = normalizedSrc.startsWith("/images/content/")
      ? "error"
      : "warning";
    add(
      level,
      file,
      `${context}: image file does not exist under apps/web/public: ${src}`,
    );
  }

  const isLegacyAllowed =
    normalizedSrc.startsWith("/images/content/") ||
    normalizedSrc.startsWith("/images/study/") ||
    normalizedSrc.startsWith("/logo") ||
    normalizedSrc === "/images/profile.jpg" ||
    normalizedSrc === "/redSilling.png" ||
    normalizedSrc === "/purpleSilling.png";

  if (normalizedSrc.startsWith("/images/") && !isLegacyAllowed) {
    add(
      "warning",
      file,
      `${context}: local image path is outside the new /images/content/** convention: ${src}`,
    );
  }
}

function checkFile(file) {
  const source = fs.readFileSync(file, "utf8");
  const frontmatterImage = parseFrontmatterImage(parseFrontmatter(source));

  if (frontmatterImage) {
    if (!frontmatterImage.src)
      add("error", file, "frontmatter image: missing src");
    if (!frontmatterImage.alt)
      add("error", file, "frontmatter image: missing alt");
    if (frontmatterImage.src)
      checkPublicSrc(file, frontmatterImage.src, "frontmatter image");
  }

  const articleImageRegex = /<ArticleImage\b([\s\S]*?)(?:\/>|>)/g;
  for (const match of source.matchAll(articleImageRegex)) {
    const attrs = match[1];
    const src = getQuotedAttr(attrs, "src");
    const alt = getQuotedAttr(attrs, "alt");
    const caption = getQuotedAttr(attrs, "caption");
    const decorative = getQuotedAttr(attrs, "data-decorative") === "true";
    const context = `ArticleImage line ${lineOf(source, match.index ?? 0)}`;

    if (!src) add("error", file, `${context}: missing src`);
    if (!decorative && !alt) add("error", file, `${context}: missing alt`);
    if (src) checkPublicSrc(file, src, context);
    if (!caption && !decorative)
      add(
        "warning",
        file,
        `${context}: missing caption; add one unless the surrounding prose already explains the image`,
      );
  }

  const markdownImageRegex =
    /!\[([^\]]*)\]\(([^\s)]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of source.matchAll(markdownImageRegex)) {
    const alt = match[1];
    const src = match[2];
    const context = `markdown image line ${lineOf(source, match.index ?? 0)}`;
    if (!alt) add("error", file, `${context}: missing alt text`);
    checkPublicSrc(file, src, context);
  }
}

for (const file of walk(contentRoot)) {
  checkFile(file);
}

const errors = findings.filter((finding) => finding.level === "error");
const warnings = findings.filter((finding) => finding.level === "warning");
const shouldFail = errors.length > 0 || (strict && warnings.length > 0);

if (findings.length) {
  for (const finding of findings) {
    const prefix = finding.level === "error" ? "ERROR" : "WARN";
    console.log(`${prefix} ${finding.file}: ${finding.message}`);
  }
}

console.log(
  `content asset check: ${errors.length} error(s), ${warnings.length} warning(s)${strict ? " (strict)" : ""}`,
);

process.exit(shouldFail ? 1 : 0);
