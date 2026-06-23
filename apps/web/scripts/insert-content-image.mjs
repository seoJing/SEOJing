#!/usr/bin/env node
/* global console */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const webRoot = path.join(repoRoot, "apps/web");
const contentRoot = path.join(webRoot, "content");
const publicRoot = path.join(webRoot, "public");
const contentImageRoot = path.join(publicRoot, "images/content");

const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const sectionRules = [
  { prefix: "okayJing/", section: "okayjing" },
  { prefix: "study/backend/", section: "study-backend" },
  { prefix: "study/clab-26-1/", section: "study-clab-26-1" },
  { prefix: "study/", section: "study" },
  { prefix: "SEOJing/", section: "seojing" },
  { prefix: "spot/", section: "spot" },
  { prefix: "kd-team/", section: "kd-team" },
];

function usage(exitCode = 0) {
  const message = `Usage:
  pnpm --filter @app/web run asset:insert -- --mdx <content.mdx> --source <image> --alt <text> [options]

Copies an image into apps/web/public/images/content/<section>/<post-slug>/ and inserts an MDX snippet that references the generated public path.

Required:
  --mdx <path>           MDX file under apps/web/content
  --source <path>        Local image file to copy into public/images/content
  --alt <text>           Accessible alt text. Use --decorative only for decorative images.

Options:
  --name <semantic>      Semantic filename base. Defaults to the source filename stem.
  --caption <text>       Caption for ArticleImage. Recommended for non-decorative images.
  --after-heading <text> Insert after the first Markdown heading containing this text.
  --after-line <number>  Insert after this 1-based line number.
  --marker <text>        Insert at marker text and keep the marker. Defaults to "<!-- asset:insert -->".
  --markdown             Insert Markdown image syntax instead of ArticleImage.
  --decorative           Allow empty alt and add data-decorative="true" to ArticleImage.
  --dry-run              Print the generated paths/snippet without writing files.
  --help                 Show this help.

Examples:
  pnpm --filter @app/web run asset:insert -- \
    --mdx apps/web/content/okayJing/workflow/forum-tickets-hermes-gateway.mdx \
    --source ~/Desktop/forum-map.png \
    --name forum-thread-map \
    --alt "Forum thread와 hermes-ticket이 같은 작업 단위를 가리키는 구조" \
    --caption "Forum thread는 사람이 읽는 작업 단위, hermes-ticket은 실행 상태를 남기는 단위로 둔다."
`;
  console.log(message.trimEnd());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    marker: "<!-- asset:insert -->",
    markdown: false,
    decorative: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--markdown") {
      args.markdown = true;
      continue;
    }
    if (arg === "--decorative") {
      args.decorative = true;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);

    const key = arg
      .slice(2)
      .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    args[key] = value;
    index += 1;
  }

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

function resolveMdx(mdxArg) {
  if (!mdxArg) throw new Error("--mdx is required");
  const mdxPath = path.resolve(repoRoot, mdxArg);
  assertInside(mdxPath, contentRoot, "--mdx");
  if (!/\.mdx?$/.test(mdxPath))
    throw new Error("--mdx must point to an .mdx or .md file");
  if (!fs.existsSync(mdxPath))
    throw new Error(`MDX file does not exist: ${mdxArg}`);
  return mdxPath;
}

function contentSectionFor(mdxPath) {
  const relative = toPosixPath(path.relative(contentRoot, mdxPath));
  const rule = sectionRules.find((entry) => relative.startsWith(entry.prefix));
  if (!rule) {
    throw new Error(
      `Cannot infer content image section for ${relative}. Add a section rule before using this CLI for that content area.`,
    );
  }
  return rule.section;
}

function slugFor(mdxPath) {
  const base = path.basename(mdxPath).replace(/\.mdx?$/, "");
  if (base !== "index") return base;
  return path.basename(path.dirname(mdxPath));
}

function kebab(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function nextFilename(targetDir, semanticName, extension) {
  const base = kebab(semanticName);
  if (!base)
    throw new Error(
      "--name/source filename must contain at least one ASCII letter or number after kebab-case normalization",
    );

  const numberedMatch = base.match(/^(.*)-(\d{2})$/);
  if (numberedMatch) return `${base}${extension}`;

  let number = 1;
  while (number < 100) {
    const candidate = `${base}-${String(number).padStart(2, "0")}${extension}`;
    if (!fs.existsSync(path.join(targetDir, candidate))) return candidate;
    number += 1;
  }
  throw new Error(`No available filename slots for ${base}-NN${extension}`);
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeMarkdownText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, " ")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll(")", "\\)")
    .trim();
}

function buildSnippet(args, publicPath) {
  const alt = args.decorative ? (args.alt ?? "") : args.alt;
  if (!args.decorative && (!alt || !alt.trim())) {
    throw new Error("--alt is required unless --decorative is set");
  }

  if (args.markdown) {
    const title = args.caption ? ` "${escapeMarkdownText(args.caption)}"` : "";
    return `![${escapeMarkdownText(alt)}](${publicPath}${title})`;
  }

  const attrs = [`src="${publicPath}"`, `alt="${escapeAttr(alt)}"`];
  if (args.caption) attrs.push(`caption="${escapeAttr(args.caption)}"`);
  if (args.decorative) attrs.push('data-decorative="true"');

  return `<ArticleImage\n  ${attrs.join("\n  ")}\n/>`;
}

function insertSnippet(source, snippet, args) {
  if (args.marker && source.includes(args.marker)) {
    return source.replace(args.marker, `${args.marker}\n\n${snippet}`);
  }

  if (args.afterHeading) {
    const lines = source.split("\n");
    const index = lines.findIndex(
      (line) => /^#{1,6}\s+/.test(line) && line.includes(args.afterHeading),
    );
    if (index === -1)
      throw new Error(
        `No heading contains --after-heading text: ${args.afterHeading}`,
      );
    lines.splice(index + 1, 0, "", snippet);
    return lines.join("\n");
  }

  if (args.afterLine) {
    const lineNumber = Number(args.afterLine);
    if (!Number.isInteger(lineNumber) || lineNumber < 1) {
      throw new Error("--after-line must be a positive integer");
    }
    const lines = source.split("\n");
    if (lineNumber > lines.length)
      throw new Error(`--after-line exceeds file length (${lines.length})`);
    lines.splice(lineNumber, 0, "", snippet);
    return lines.join("\n");
  }

  return `${source.replace(/\s*$/, "")}\n\n${snippet}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const mdxPath = resolveMdx(args.mdx);
  const sourcePath = path.resolve(process.cwd(), args.source ?? "");
  if (!args.source) throw new Error("--source is required");
  if (!fs.existsSync(sourcePath))
    throw new Error(`Source image does not exist: ${args.source}`);
  if (!fs.statSync(sourcePath).isFile())
    throw new Error(`Source image is not a file: ${args.source}`);

  const extension = path.extname(sourcePath).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    throw new Error(
      `Unsupported image extension ${extension}. Allowed: ${[...allowedExtensions].join(", ")}`,
    );
  }

  const section = contentSectionFor(mdxPath);
  const slug = slugFor(mdxPath);
  const targetDir = path.join(contentImageRoot, section, slug);
  const filename = nextFilename(
    targetDir,
    args.name ?? path.basename(sourcePath),
    extension,
  );
  const targetPath = path.join(targetDir, filename);
  const publicPath = `/${toPosixPath(path.relative(publicRoot, targetPath))}`;
  const snippet = buildSnippet(args, publicPath);
  const originalMdx = fs.readFileSync(mdxPath, "utf8");
  const nextMdx = insertSnippet(originalMdx, snippet, args);

  console.log(`MDX: ${path.relative(repoRoot, mdxPath)}`);
  console.log(`image: ${path.relative(repoRoot, targetPath)}`);
  console.log(`public src: ${publicPath}`);
  console.log("snippet:");
  console.log(snippet);

  if (args.dryRun) {
    console.log("dry run: no files written");
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(mdxPath, nextMdx);
  console.log("done: copied image and updated MDX");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error("Run with --help for usage.");
  process.exit(1);
}
