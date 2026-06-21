#!/usr/bin/env node
/* global console, fetch */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { URL, URLSearchParams } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const webRoot = path.join(repoRoot, "apps/web");
const contentRoot = path.join(webRoot, "content");
const publicRoot = path.join(webRoot, "public");
const coverRoot = path.join(publicRoot, "images/content");

const allowedDownloadExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const sectionRules = [
  { prefix: "okayJing/", section: "okayjing" },
  { prefix: "study/backend/", section: "study-backend" },
  { prefix: "study/clab-26-1/", section: "study-clab-26-1" },
  { prefix: "study/", section: "study" },
  { prefix: "SEOJing/", section: "seojing" },
  { prefix: "spot/", section: "spot" },
  { prefix: "kd-team/", section: "kd-team" },
  { prefix: "clab/", section: "clab" },
];

const categoryHints = [
  {
    prefix: "okayJing/",
    query: "artificial intelligence workflow diagram",
    style: "AI workflow, operating room, abstract system map",
  },
  {
    prefix: "study/backend/",
    query: "server architecture API database",
    style: "backend architecture, API gateway, database, learning diagram",
  },
  {
    prefix: "study/",
    query: "software engineering study diagram",
    style: "software study notes, code blocks, concept map",
  },
  {
    prefix: "SEOJing/",
    query: "web portfolio editorial design",
    style: "web portfolio, editorial interface, personal site",
  },
  {
    prefix: "spot/",
    query: "map visualization city data",
    style: "city map, clustering, local community data",
  },
  {
    prefix: "kd-team/",
    query: "frontend team collaboration interface",
    style: "frontend team collaboration, UI system",
  },
];

function usage(exitCode = 0) {
  const message = `Usage:
  pnpm --filter @app/web run cover:auto -- [options]

Automatically writes cover frontmatter for MDX posts that do not have cover.src.
Images are copied into apps/web/public/images/content/<section>/<post-slug>/cover-NN.*.

Options:
  --path <path>             Content file or directory. Defaults to apps/web/content.
  --limit <number>          Max posts to process. Defaults to 10.
  --provider <name>         wikimedia | codex-image | codex-svg | openai | auto. Defaults to auto.
  --write                   Actually write images and MDX. Default is dry-run.
  --force                   Replace existing cover block.
  --query <text>            Override search query for all selected posts.
  --prompt <text>           Extra prompt guidance for explicit OpenAI API/Codex generation.
  --codex-model <model>     Optional Codex model override for Codex providers.
  --min-width <number>      Minimum searched image width. Defaults to 800.
  --min-height <number>     Minimum searched image height. Defaults to 600.
  --openai-model <model>    Explicit OpenAI API fallback only. Defaults to gpt-image-1.
  --size <size>             Explicit OpenAI API fallback only. Defaults to 1024x1024.
  --help                    Show this help.

Examples:
  pnpm --filter @app/web run cover:auto -- --path apps/web/content/okayJing --limit 5
  pnpm --filter @app/web run cover:auto -- --provider wikimedia --path apps/web/content/study/backend/day1.mdx --write
  pnpm --filter @app/web run cover:auto -- --provider codex-image --path apps/web/content/SEOJing/post.mdx --write
  pnpm --filter @app/web run cover:auto -- --provider codex-svg --path apps/web/content/SEOJing/post.mdx --write
  OPENAI_API_KEY=... pnpm --filter @app/web run cover:auto -- --provider openai --limit 3 --write

Notes:
  - auto uses Wikimedia search only. Generated covers can be produced explicitly with --provider codex-image, which invokes Codex CLI's ChatGPT-auth built-in raster image generation and imports the generated PNG, or --provider codex-svg, which validates a static SVG before inserting it.
  - --provider openai is an explicit API-key fallback for environments that intentionally accept separate API billing.
  - Dry-run is the default so a broad run cannot rewrite many posts by accident.`;
  console.log(message.trimEnd());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    path: contentRoot,
    limit: 10,
    provider: "auto",
    write: false,
    force: false,
    minWidth: 800,
    minHeight: 600,
    openaiModel: "gpt-image-1",
    size: "1024x1024",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--write") {
      args.write = true;
      continue;
    }
    if (arg === "--force") {
      args.force = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);

    const key = arg
      .slice(2)
      .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`Missing value for ${arg}`);
    args[key] = value;
    index += 1;
  }

  args.provider = String(args.provider).toLowerCase();
  if (
    !["auto", "wikimedia", "codex-image", "codex-svg", "openai"].includes(
      args.provider,
    )
  ) {
    throw new Error(
      "--provider must be one of: auto, wikimedia, codex-image, codex-svg, openai",
    );
  }
  args.limit = Number(args.limit);
  args.minWidth = Number(args.minWidth);
  args.minHeight = Number(args.minHeight);
  if (!Number.isInteger(args.limit) || args.limit < 1)
    throw new Error("--limit must be a positive integer");
  if (!Number.isFinite(args.minWidth) || !Number.isFinite(args.minHeight)) {
    throw new Error("--min-width and --min-height must be numbers");
  }
  args.path = path.resolve(repoRoot, String(args.path));
  assertInside(args.path, contentRoot, "--path");
  return args;
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function assertInside(child, parent, label) {
  const relative = path.relative(parent, child);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `${label} must stay inside ${path.relative(repoRoot, parent)}`,
    );
  }
}

function walkMdx(targetPath) {
  if (!fs.existsSync(targetPath))
    throw new Error(
      `Path does not exist: ${path.relative(repoRoot, targetPath)}`,
    );
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (!/\.mdx?$/.test(targetPath))
      throw new Error("--path file must be .md or .mdx");
    return [targetPath];
  }

  const files = [];
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) files.push(...walkMdx(fullPath));
    else if (/\.mdx?$/.test(entry.name)) files.push(fullPath);
  }
  return files.sort((a, b) => a.localeCompare(b, "ko", { numeric: true }));
}

function parseFrontmatter(source) {
  if (!source.startsWith("---\n"))
    throw new Error("MDX file must start with YAML frontmatter");
  const end = source.indexOf("\n---", 4);
  if (end === -1) throw new Error("MDX frontmatter closing fence not found");
  return {
    before: source.slice(0, 4),
    frontmatter: source.slice(4, end),
    after: source.slice(end),
  };
}

function readScalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return "";
  return unquoteYaml(match[1].trim());
}

function readTags(frontmatter) {
  const lines = frontmatter.split("\n");
  const tags = [];
  const start = lines.findIndex((line) => /^tags:\s*$/.test(line));
  if (start === -1) return tags;
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const match = line.match(/^\s*-\s*(.*)$/);
    if (match) tags.push(unquoteYaml(match[1].trim()));
  }
  return tags;
}

function unquoteYaml(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/''/g, "'");
  }
  return value;
}

function yamlQuote(value) {
  return `"${String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ")}"`;
}

function hasCover(frontmatter) {
  const inline = /^cover:\s*\{.*\}\s*$/m.test(frontmatter);
  const block = /^cover:\s*$/m.test(frontmatter);
  return inline || block;
}

function replaceOrAppendCover(frontmatter, cover, force) {
  const block = [
    "cover:",
    `  src: ${yamlQuote(cover.src)}`,
    `  alt: ${yamlQuote(cover.alt)}`,
  ];
  if (cover.caption) block.push(`  caption: ${yamlQuote(cover.caption)}`);
  block.push(`  kind: ${yamlQuote(cover.kind)}`);
  const coverBlock = block.join("\n");

  if (!hasCover(frontmatter))
    return `${frontmatter.replace(/\s*$/, "")}\n${coverBlock}\n`;
  if (!force)
    throw new Error("cover already exists; pass --force to replace it");

  const lines = frontmatter.split("\n");
  const start = lines.findIndex((line) =>
    /^cover:\s*(?:$|\{.*\}\s*$)/.test(line),
  );
  if (start === -1)
    return `${frontmatter.replace(/\s*$/, "")}\n${coverBlock}\n`;
  let end = start + 1;
  while (end < lines.length && !/^\S[^:]*:\s*/.test(lines[end])) end += 1;
  lines.splice(start, end - start, ...coverBlock.split("\n"));
  return `${lines.join("\n").replace(/\s*$/, "")}\n`;
}

function contentSectionFor(file) {
  const relative = toPosixPath(path.relative(contentRoot, file));
  const rule = sectionRules.find((entry) => relative.startsWith(entry.prefix));
  if (!rule) return "misc";
  return rule.section;
}

function categoryHintFor(file) {
  const relative = toPosixPath(path.relative(contentRoot, file));
  return (
    categoryHints.find((entry) => relative.startsWith(entry.prefix)) ?? {
      query: "technology editorial abstract",
      style: "technology editorial abstract image",
    }
  );
}

function slugFor(file) {
  const base = path.basename(file).replace(/\.mdx?$/, "");
  if (base !== "index") return base;
  return path.basename(path.dirname(file));
}

function kebab(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 90);
}

function nextFilename(targetDir, extension) {
  let number = 1;
  while (number < 100) {
    const candidate = `cover-${String(number).padStart(2, "0")}${extension}`;
    if (!fs.existsSync(path.join(targetDir, candidate))) return candidate;
    number += 1;
  }
  throw new Error(
    `No available cover-NN${extension} slot in ${path.relative(repoRoot, targetDir)}`,
  );
}

function postInfo(file) {
  const source = fs.readFileSync(file, "utf8");
  const parsed = parseFrontmatter(source);
  return {
    file,
    source,
    ...parsed,
    title: readScalar(parsed.frontmatter, "title") || slugFor(file),
    date: readScalar(parsed.frontmatter, "date"),
    description: readScalar(parsed.frontmatter, "description"),
    tags: readTags(parsed.frontmatter),
    existingCover: hasCover(parsed.frontmatter),
  };
}

function buildSearchQuery(info, args) {
  if (args.query) return String(args.query);
  const hint = categoryHintFor(info.file).query;
  return hint;
}

function buildOpenAiPrompt(info, args) {
  const hint = categoryHintFor(info.file).style;
  const extra = args.prompt ? `\nExtra direction: ${args.prompt}` : "";
  return `Create a square editorial cover image for a Korean technical blog post.\nTitle: ${info.title}\nDescription: ${info.description || "No description"}\nTags: ${info.tags.join(", ") || "none"}\nVisual direction: ${hint}.\nStyle: bold abstract photography mixed with interface/diagram elements, no readable text, no logos, no brand marks, modern editorial, high contrast, suitable for a blog grid thumbnail.${extra}`;
}

function buildCodexImagePrompt(info, args) {
  const hint = categoryHintFor(info.file).style;
  const extra = args.prompt ? `\nExtra direction: ${args.prompt}` : "";
  return `Use the built-in image generation tool image_gen.imagegen to generate exactly one raster blog cover image.

Do not create or write any image using shell, SVG, HTML, Python, Node, canvas, or other code. The image itself must come from the built-in image generation tool. Do not use the separate OpenAI API-key fallback.

Asset requirements:
- landscape blog cover, target aspect ratio about 1.9:1, suitable for a 1200x630 SEO/social card
- premium editorial raster image quality, not a vector placeholder
- no readable text
- no logos, brand marks, watermarks, or UI brand names
- abstract technical-blog visual, image-card automation / agent-workflow / software-system motif

Post context:
- Title: ${info.title}
- Description: ${info.description || "No description"}
- Tags: ${info.tags.join(", ") || "none"}
- Visual direction: ${hint}.${extra}

After generation, briefly report whether the image generation tool returned a visible file path, URL, attachment id, or cache location. Do not synthesize a local placeholder if no path is visible.`;
}

function codexCommand() {
  const appCodex = "/Applications/Codex.app/Contents/Resources/codex";
  if (fs.existsSync(appCodex)) return { command: appCodex, argsPrefix: [] };
  return { command: "npx", argsPrefix: ["-y", "@openai/codex"] };
}

function parseCodexThreadId(jsonl) {
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "thread.started" && event.thread_id) {
        return String(event.thread_id);
      }
    } catch {
      // Codex may print non-JSON diagnostics; ignore them here.
    }
  }
  return "";
}

function findCodexGeneratedImage(threadId, markerMs) {
  const generatedRoot = path.join(os.homedir(), ".codex/generated_images");
  const searchRoots = threadId
    ? [path.join(generatedRoot, threadId), generatedRoot]
    : [generatedRoot];
  const candidates = [];
  const visit = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) continue;
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs + 1000 < markerMs) continue;
      if (threadId && !fullPath.includes(`${path.sep}${threadId}${path.sep}`)) {
        continue;
      }
      candidates.push({
        path: fullPath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        ext,
      });
    }
  };
  for (const root of searchRoots) visit(root);
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || b.size - a.size);
  return candidates[0] ?? null;
}

function buildCodexSvgPrompt(info, args) {
  const hint = categoryHintFor(info.file).style;
  const extra = args.prompt ? `\nExtra direction: ${args.prompt}` : "";
  return `Create a static SVG cover illustration at ./cover.svg for a Korean technical blog post.

Canvas and file requirements:
- exactly 1200x630 canvas
- write only ./cover.svg
- no external assets
- no scripts
- no foreignObject
- no image tags
- no remote URLs other than the standard SVG xmlns namespace
- no data URLs
- no event handlers such as onload or onclick
- editorial technical-blog style
- abstract blog-card / image-placeholder / agent-workflow or software-system motif
- readable text should be minimal; use only the short title if it fits safely

Post context:
- Title: ${info.title}
- Description: ${info.description || "No description"}
- Tags: ${info.tags.join(", ") || "none"}
- Visual direction: ${hint}.${extra}

After writing the SVG, briefly report the path.`;
}

function assertSafeSvg(svg) {
  if (!/^\s*<svg\b/i.test(svg))
    throw new Error("Codex did not produce an SVG root");
  if (
    !/\bwidth=["']1200["']/i.test(svg) ||
    !/\bheight=["']630["']/i.test(svg)
  ) {
    throw new Error('Codex SVG must declare width="1200" and height="630"');
  }
  if (!/\bviewBox=["']0\s+0\s+1200\s+630["']/i.test(svg)) {
    throw new Error('Codex SVG must declare viewBox="0 0 1200 630"');
  }

  const bodyWithoutXmlns = svg.replace(
    /\sxmlns(?::[A-Za-z0-9_-]+)?=["'][^"']+["']/g,
    "",
  );
  const forbiddenPatterns = [
    {
      pattern:
        /<\s*(script|foreignObject|iframe|object|embed|canvas|audio|video|image)\b/i,
      label: "scriptable or external-capable SVG element",
    },
    { pattern: /\son[a-z]+\s*=/i, label: "event handler attribute" },
    { pattern: /\b(?:href|xlink:href)\s*=/i, label: "href attribute" },
    { pattern: /(?:https?:)?\/\//i, label: "remote URL" },
    { pattern: /data:/i, label: "data URL" },
    { pattern: /@import/i, label: "CSS import" },
  ];
  for (const { pattern, label } of forbiddenPatterns) {
    if (pattern.test(bodyWithoutXmlns))
      throw new Error(`Unsafe Codex SVG: ${label}`);
  }
}

async function generateCodexSvg(info, args) {
  const workdir = fs.mkdtempSync(
    path.join(os.tmpdir(), "seojing-codex-cover-"),
  );
  const promptPath = path.join(workdir, "prompt.txt");
  const lastMessagePath = path.join(workdir, "last.txt");
  const svgPath = path.join(workdir, "cover.svg");
  fs.writeFileSync(promptPath, buildCodexSvgPrompt(info, args));

  const codexArgs = [
    "-y",
    "@openai/codex",
    "exec",
    "--cd",
    workdir,
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "--output-last-message",
    lastMessagePath,
  ];
  if (args.codexModel) codexArgs.push("--model", String(args.codexModel));
  codexArgs.push("-");

  try {
    execFileSync("npx", codexArgs, {
      cwd: workdir,
      input: fs.readFileSync(promptPath),
      encoding: "utf8",
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    const stdout = error?.stdout ? String(error.stdout).trim() : "";
    throw new Error(
      ["Codex SVG generation failed", stderr, stdout]
        .filter(Boolean)
        .join(": "),
    );
  }

  if (!fs.existsSync(svgPath)) {
    const lastMessage = fs.existsSync(lastMessagePath)
      ? fs.readFileSync(lastMessagePath, "utf8").trim()
      : "";
    throw new Error(
      `Codex SVG generation did not create cover.svg${lastMessage ? `: ${lastMessage}` : ""}`,
    );
  }
  let svg = fs.readFileSync(svgPath, "utf8");
  if (!/\sxmlns=/.test(svg.split(">", 1)[0] ?? "")) {
    svg = svg.replace(/^\s*<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  assertSafeSvg(svg);
  return {
    provider: "codex-svg",
    buffer: Buffer.from(svg, "utf8"),
    extension: ".svg",
    alt: `${info.title} 글의 Codex 생성 대표 이미지`,
    caption: `Generated cover · Codex CLI static SVG${args.codexModel ? ` · ${args.codexModel}` : ""}`,
  };
}

async function generateCodexImage(info, args) {
  const workdir = fs.mkdtempSync(
    path.join(os.tmpdir(), "seojing-codex-image-cover-"),
  );
  const promptPath = path.join(workdir, "prompt.txt");
  const lastMessagePath = path.join(workdir, "last.txt");
  const markerPath = path.join(workdir, ".marker");
  fs.writeFileSync(promptPath, buildCodexImagePrompt(info, args));
  fs.writeFileSync(markerPath, new Date().toISOString());
  const markerMs = fs.statSync(markerPath).mtimeMs;

  const codex = codexCommand();
  const codexArgs = [
    ...codex.argsPrefix,
    "exec",
    "--json",
    "--ephemeral",
    "--cd",
    workdir,
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "--output-last-message",
    lastMessagePath,
  ];
  if (args.codexModel) codexArgs.push("--model", String(args.codexModel));
  codexArgs.push("-");

  let stdout = "";
  try {
    stdout = execFileSync(codex.command, codexArgs, {
      cwd: workdir,
      input: fs.readFileSync(promptPath),
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 30 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    stdout = error?.stdout ? String(error.stdout).trim() : stdout;
    throw new Error(
      ["Codex raster generation failed", stderr, stdout]
        .filter(Boolean)
        .join(": "),
    );
  }

  const threadId = parseCodexThreadId(stdout);
  const generated = findCodexGeneratedImage(threadId, markerMs);
  if (!generated) {
    const lastMessage = fs.existsSync(lastMessagePath)
      ? fs.readFileSync(lastMessagePath, "utf8").trim()
      : "";
    throw new Error(
      `Codex raster generation did not expose a generated image file${threadId ? ` for thread ${threadId}` : ""}${lastMessage ? `: ${lastMessage}` : ""}`,
    );
  }

  return {
    provider: "codex-image",
    buffer: fs.readFileSync(generated.path),
    extension: generated.ext === ".jpeg" ? ".jpg" : generated.ext,
    alt: `${info.title} 글의 Codex 생성 대표 이미지`,
    caption: `Generated cover · Codex image generation${args.codexModel ? ` · ${args.codexModel}` : ""}`,
    sourcePath: generated.path,
  };
}

function inferExtensionFromUrl(url, contentType = "") {
  const clean = url.split(/[?#]/, 1)[0];
  const ext = path.extname(clean).toLowerCase();
  if (allowedDownloadExtensions.has(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  if (contentType.includes("jpeg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  throw new Error(`Unsupported image type: ${contentType || ext || "unknown"}`);
}

function attributionFromMetadata(metadata, fallbackTitle) {
  const title = metadata.ObjectName?.value || fallbackTitle;
  const artist = metadata.Artist?.value?.replace(/<[^>]+>/g, "").trim();
  const license =
    metadata.LicenseShortName?.value || metadata.UsageTerms?.value;
  const source = metadata.Credit?.value?.replace(/<[^>]+>/g, "").trim();
  return [title, artist, license, source].filter(Boolean).join(" · ");
}

async function searchWikimedia(info, args) {
  const query = buildSearchQuery(info, args);
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "12",
    gsrsearch: query,
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
  }).toString();

  const response = await fetch(url, {
    headers: { "User-Agent": "SEOJingCoverBot/1.0 (https://seojing.com)" },
  });
  if (!response.ok)
    throw new Error(`Wikimedia search failed: HTTP ${response.status}`);
  const data = await response.json();
  const pages = Object.values(data.query?.pages ?? {});
  for (const page of pages) {
    const image = page.imageinfo?.[0];
    if (!image?.url) continue;
    if (image.mime === "image/svg+xml") continue;
    if (
      (image.width ?? 0) < args.minWidth ||
      (image.height ?? 0) < args.minHeight
    )
      continue;
    const license = image.extmetadata?.LicenseShortName?.value ?? "";
    if (license && !/(cc|public domain|pd|gfdl)/i.test(license)) continue;
    let extension;
    try {
      extension = inferExtensionFromUrl(image.url, image.mime);
    } catch {
      continue;
    }
    return {
      provider: "wikimedia",
      url: image.url,
      extension,
      alt: `${info.title} 글의 대표 이미지`,
      caption: `Wikimedia Commons · ${attributionFromMetadata(image.extmetadata ?? {}, page.title)}`,
      query,
    };
  }
  throw new Error(`No suitable Wikimedia image for query: ${query}`);
}

async function generateOpenAi(info, args) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new Error("OPENAI_API_KEY is required for --provider openai");
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.openaiModel,
      prompt: buildOpenAiPrompt(info, args),
      size: args.size,
      n: 1,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `OpenAI image generation failed: HTTP ${response.status} ${data.error?.message ?? ""}`.trim(),
    );
  }
  const item = data.data?.[0];
  if (item?.b64_json) {
    return {
      provider: "openai",
      buffer: Buffer.from(item.b64_json, "base64"),
      extension: ".png",
      alt: `${info.title} 글의 생성 대표 이미지`,
      caption: `Generated image · ${args.openaiModel}`,
    };
  }
  if (item?.url) {
    return {
      provider: "openai",
      url: item.url,
      extension: inferExtensionFromUrl(item.url, "image/png"),
      alt: `${info.title} 글의 생성 대표 이미지`,
      caption: `Generated image · ${args.openaiModel}`,
    };
  }
  throw new Error("OpenAI response did not include image data");
}

async function resolveCandidate(info, args) {
  const errors = [];
  if (args.provider === "wikimedia" || args.provider === "auto") {
    try {
      return await searchWikimedia(info, args);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      if (args.provider === "wikimedia") throw error;
    }
  }
  if (args.provider === "openai") {
    try {
      return await generateOpenAi(info, args);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  if (args.provider === "codex-image") {
    try {
      return await generateCodexImage(info, args);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  if (args.provider === "codex-svg") {
    try {
      return await generateCodexSvg(info, args);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
  throw new Error(errors.join(" | ") || "No provider could produce a cover");
}

async function materializeCandidate(candidate, targetPath) {
  if (candidate.buffer) {
    fs.writeFileSync(targetPath, candidate.buffer);
    return;
  }
  if (!candidate.url) throw new Error("Candidate has neither buffer nor url");
  const response = await fetch(candidate.url, {
    headers: { "User-Agent": "SEOJingCoverBot/1.0 (https://seojing.com)" },
  });
  if (!response.ok)
    throw new Error(`Image download failed: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(targetPath, buffer);
}

async function processFile(info, args) {
  if (info.existingCover && !args.force) {
    return { status: "skipped", file: info.file, reason: "cover exists" };
  }

  const candidate = await resolveCandidate(info, args);
  const section = contentSectionFor(info.file);
  const slug = kebab(slugFor(info.file)) || "post";
  const targetDir = path.join(coverRoot, section, slug);
  const filename = nextFilename(targetDir, candidate.extension);
  const targetPath = path.join(targetDir, filename);
  const publicPath = `/${toPosixPath(path.relative(publicRoot, targetPath))}`;
  const cover = {
    src: publicPath,
    alt: candidate.alt,
    caption: candidate.caption,
    kind: candidate.provider === "wikimedia" ? "searched" : "generated",
  };

  const nextFrontmatter = replaceOrAppendCover(
    info.frontmatter,
    cover,
    args.force,
  );
  const nextSource = `${info.before}${nextFrontmatter}${info.after}`;
  const result = {
    status: args.write ? "written" : "dry-run",
    file: info.file,
    title: info.title,
    provider: candidate.provider,
    query: candidate.query,
    image: candidate.url,
    target: targetPath,
    publicPath,
    cover,
  };

  if (!args.write) return result;

  fs.mkdirSync(targetDir, { recursive: true });
  await materializeCandidate(candidate, targetPath);
  fs.writeFileSync(info.file, nextSource);
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const infos = walkMdx(args.path)
    .map(postInfo)
    .filter((info) => args.force || !info.existingCover)
    .slice(0, args.limit);

  console.log(
    `${args.write ? "write" : "dry-run"}: ${infos.length} file(s), provider=${args.provider}`,
  );
  if (!infos.length) return;

  const results = [];
  for (const info of infos) {
    try {
      const result = await processFile(info, args);
      results.push(result);
      console.log(
        `OK ${path.relative(repoRoot, info.file)} -> ${result.publicPath} (${result.provider})`,
      );
      if (result.query) console.log(`   query: ${result.query}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ status: "error", file: info.file, reason: message });
      console.log(`ERROR ${path.relative(repoRoot, info.file)}: ${message}`);
    }
  }

  const written = results.filter(
    (result) => result.status === "written",
  ).length;
  const dryRun = results.filter((result) => result.status === "dry-run").length;
  const skipped = results.filter(
    (result) => result.status === "skipped",
  ).length;
  const errors = results.filter((result) => result.status === "error").length;
  console.log(
    `summary: ${written} written, ${dryRun} dry-run, ${skipped} skipped, ${errors} error(s)`,
  );
  if (errors) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("Run with --help for usage.");
  process.exit(1);
}
