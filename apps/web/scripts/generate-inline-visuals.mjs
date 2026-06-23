#!/usr/bin/env node
/* global console, fetch */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";
import { URL, URLSearchParams } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const webRoot = path.join(repoRoot, "apps/web");
const contentRoot = path.join(webRoot, "content");
const publicRoot = path.join(webRoot, "public");
const inlineRoot = path.join(publicRoot, "images/content");

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

const visualSignals = [
  {
    pattern:
      /(경계|boundary|interface|contract|계약|권한|permission|scope|capability|card)/i,
    kind: "boundary",
    label: "경계/계약 구조",
    query: "software architecture boundary interface diagram",
  },
  {
    pattern:
      /(흐름|flow|pipeline|orchestration|워크플로|workflow|routing|handoff|넘겨|요청|응답)/i,
    kind: "flow",
    label: "작업 흐름",
    query: "workflow pipeline software diagram",
  },
  {
    pattern:
      /(상태|state|lifecycle|라이프사이클|전이|transition|queue|대기|실행|완료|실패)/i,
    kind: "state",
    label: "상태 전이",
    query: "state machine lifecycle diagram",
  },
  {
    pattern:
      /(비교|versus|vs\.?|차이|trade-?off|대안|instead|rather than|보다)/i,
    kind: "comparison",
    label: "비교 구조",
    query: "comparison matrix technical diagram",
  },
  {
    pattern:
      /(stack|스택|layer|계층|runtime|런타임|server|client|database|데이터베이스|API|MCP|A2A)/i,
    kind: "stack",
    label: "시스템 스택",
    query: "software system stack architecture",
  },
  {
    pattern:
      /(UI|interface|화면|dashboard|대시보드|console|콘솔|browser|브라우저|tool|도구)/i,
    kind: "interface",
    label: "도구/인터페이스",
    query: "software interface workspace screen",
  },
];

function usage(exitCode = 0) {
  const message = `Usage:
  pnpm --filter @app/web run visual:auto -- [options]

Analyzes MDX posts and optionally inserts one inline ArticleImage near the section that most needs a visual anchor.
The default provider is diagram, which creates a simple authored SVG for abstract software concepts.
Images are written to apps/web/public/images/content/<section>/<post-slug>/inline-NN.*.

Options:
  --path <path>             Content file or directory. Defaults to apps/web/content.
  --limit <number>          Max posts to process. Defaults to 10.
  --provider <name>         diagram | wikimedia | auto. Defaults to auto.
  --write                   Actually write images and MDX. Default is dry-run.
  --force                   Allow inserting even when the post already has ArticleImage/markdown images.
  --query <text>            Override Wikimedia query for all selected posts.
  --min-score <number>      Minimum visual-need score. Defaults to 3.
  --min-section-words <n>   Minimum words in a section before considering it. Defaults to 80.
  --min-width <number>      Minimum searched image width. Defaults to 640.
  --min-height <number>     Minimum searched image height. Defaults to 360.
  --help                    Show this help.

Examples:
  pnpm --filter @app/web run visual:auto -- --path apps/web/content/study/agent-framework/day12.mdx
  pnpm --filter @app/web run visual:auto -- --provider diagram --path apps/web/content/study/agent-framework/day12.mdx --write
  pnpm --filter @app/web run visual:auto -- --provider wikimedia --query "OAuth authorization server" --path apps/web/content/study/backend/day8.mdx --write

Notes:
  - Dry-run is the default.
  - This is suitability-first. If no section needs a visual anchor, or no searched image is suitable, the script reports a skip instead of inserting filler.`;
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
    minScore: 3,
    minSectionWords: 80,
    minWidth: 640,
    minHeight: 360,
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
  if (!["auto", "diagram", "wikimedia"].includes(args.provider)) {
    throw new Error("--provider must be one of: auto, diagram, wikimedia");
  }
  args.limit = Number(args.limit);
  args.minScore = Number(args.minScore);
  args.minSectionWords = Number(args.minSectionWords);
  args.minWidth = Number(args.minWidth);
  args.minHeight = Number(args.minHeight);
  if (!Number.isInteger(args.limit) || args.limit < 1) {
    throw new Error("--limit must be a positive integer");
  }
  if (!Number.isFinite(args.minScore))
    throw new Error("--min-score must be a number");
  if (!Number.isInteger(args.minSectionWords) || args.minSectionWords < 1) {
    throw new Error("--min-section-words must be a positive integer");
  }
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
  if (!fs.existsSync(targetPath)) {
    throw new Error(
      `Path does not exist: ${path.relative(repoRoot, targetPath)}`,
    );
  }
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (!/\.mdx?$/.test(targetPath))
      throw new Error("--path file must be .md or .mdx");
    return [targetPath];
  }

  const files = [];
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
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
    frontmatter: source.slice(4, end),
    bodyStart: end + 5,
    body: source.slice(end + 5),
  };
}

function readScalar(frontmatter, key) {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!match) return "";
  return unquoteYaml(match[1].trim());
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

function stripCodeBlocks(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, " ");
}

function stripMdxBlocks(markdown) {
  return stripCodeBlocks(markdown)
    .replace(/<ArticleImage\b[\s\S]*?(?:\/>|>)/g, " ")
    .replace(/<[^>]+>/g, " ");
}

function wordCount(text) {
  const korean = text.match(/[가-힣]{2,}/g)?.length ?? 0;
  const latin = text.match(/[A-Za-z0-9_+-]{2,}/g)?.length ?? 0;
  return korean + latin;
}

function hasInlineImage(source) {
  return /<ArticleImage\b|!\[[^\]]*\]\([^)]*\)/.test(source);
}

function headingLevel(line) {
  return line.match(/^(#{2,4})\s+(.+)$/);
}

function extractSections(source, parsed) {
  const body = parsed.body;
  const bodyOffsetLine =
    source.slice(0, parsed.bodyStart).split("\n").length - 1;
  const lines = body.split("\n");
  const sections = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = headingLevel(lines[index]);
    if (!match) continue;
    const level = match[1].length;
    const title = match[2].replace(/#+\s*$/, "").trim();
    let end = lines.length;
    for (let next = index + 1; next < lines.length; next += 1) {
      const nextMatch = headingLevel(lines[next]);
      if (nextMatch && nextMatch[1].length <= level) {
        end = next;
        break;
      }
    }
    const content = lines.slice(index + 1, end).join("\n");
    sections.push({
      title,
      level,
      bodyLineIndex: index,
      absoluteLine: bodyOffsetLine + index + 1,
      content,
    });
  }
  return sections;
}

function scoreSection(section, args) {
  const plain = stripMdxBlocks(`${section.title}\n${section.content}`);
  const words = wordCount(plain);
  if (words < args.minSectionWords) return undefined;

  const matchedSignals = visualSignals.filter((signal) =>
    signal.pattern.test(plain),
  );
  let score = matchedSignals.length * 2;
  if (/```/.test(section.content)) score += 1;
  if (/->|→|=>|↔|\bvs\b|대신|반대로/.test(section.content)) score += 1;
  if (words > 180) score += 1;
  if (words > 320) score += 1;
  if (
    /^(오늘의\s*)?(목표|정리|마무리|요약|참고문헌|references?)$/i.test(
      section.title.replace(/^\d+\.\s*/, "").trim(),
    )
  ) {
    score -= 6;
  }
  if (/<ArticleImage\b|!\[[^\]]*\]\([^)]*\)/.test(section.content)) score -= 5;
  if (score < args.minScore) return undefined;

  const primary = matchedSignals[0] ?? visualSignals[0];
  return {
    ...section,
    plain,
    words,
    score,
    kind: primary.kind,
    label: primary.label,
    query: args.query ? String(args.query) : primary.query,
    signals: matchedSignals.map((signal) => signal.kind),
  };
}

function chooseVisualAnchor(info, args) {
  const candidates = extractSections(info.source, info.parsed)
    .map((section) => scoreSection(section, args))
    .filter(Boolean)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.words - a.words ||
        a.absoluteLine - b.absoluteLine,
    );
  return candidates[0];
}

function contentSectionFor(file) {
  const relative = toPosixPath(path.relative(contentRoot, file));
  const rule = sectionRules.find((entry) => relative.startsWith(entry.prefix));
  return rule?.section ?? "misc";
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
    .slice(0, 80);
}

function nextFilename(targetDir, extension) {
  let number = 1;
  while (number < 100) {
    const candidate = `inline-${String(number).padStart(2, "0")}${extension}`;
    if (!fs.existsSync(path.join(targetDir, candidate))) return candidate;
    number += 1;
  }
  throw new Error(
    `No available inline-NN${extension} slot in ${path.relative(repoRoot, targetDir)}`,
  );
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortText(value, max = 28) {
  const compact = String(value)
    .replace(/[`*_<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function diagramLabels(anchor) {
  const title = shortText(anchor.title, 30);
  if (anchor.kind === "flow") return ["입력", title, "검증", "산출"];
  if (anchor.kind === "state") return ["대기", "실행", "검증", "완료/실패"];
  if (anchor.kind === "comparison")
    return ["선택 A", "판단 기준", "선택 B", title];
  if (anchor.kind === "stack")
    return ["사용자", "런타임", "도구/API", "상태/저장소"];
  if (anchor.kind === "interface")
    return ["사람", "화면", "도구 호출", "피드백"];
  return ["요청", "경계", title, "권한/실패조건"];
}

function buildDiagramSvg(info, anchor) {
  const labels = diagramLabels(anchor);
  const title = shortText(anchor.title, 44);
  const subtitle = `${anchor.label} · ${shortText(info.title, 42)}`;
  const boxes = labels
    .map((label, index) => {
      const x = 86 + index * 260;
      return `<g>
  <rect x="${x}" y="285" width="190" height="88" rx="24" fill="#fff8e9" stroke="#111111" stroke-width="3"/>
  <text x="${x + 95}" y="338" text-anchor="middle" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#111111">${escapeXml(label)}</text>
</g>`;
    })
    .join("\n");
  const arrows = [0, 1, 2]
    .map((index) => {
      const x = 284 + index * 260;
      return `<path d="M ${x} 329 L ${x + 48} 329" stroke="#111111" stroke-width="5" stroke-linecap="round" marker-end="url(#arrow)"/>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeAttr(`${info.title} 중 ${anchor.title} 설명 다이어그램`)}">
<defs>
  <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
    <path d="M2,2 L10,6 L2,10 Z" fill="#111111"/>
  </marker>
  <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
    <circle cx="4" cy="4" r="1.8" fill="#111111" opacity="0.18"/>
  </pattern>
</defs>
<rect width="1200" height="630" fill="#f2eadb"/>
<rect width="1200" height="630" fill="url(#dots)" opacity="0.55"/>
<circle cx="1040" cy="120" r="138" fill="#ff5a78" opacity="0.7"/>
<circle cx="160" cy="520" r="156" fill="#1fb6a6" opacity="0.58"/>
<path d="M72 118 C260 54 375 136 540 92 C705 48 835 88 1108 54" fill="none" stroke="#111111" stroke-width="4" opacity="0.18"/>
<text x="78" y="118" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="#111111">INLINE VISUAL ANCHOR</text>
<text x="78" y="166" font-family="Arial, sans-serif" font-size="52" font-weight="900" fill="#111111">${escapeXml(title)}</text>
<text x="80" y="212" font-family="Arial, sans-serif" font-size="24" fill="#333333">${escapeXml(subtitle)}</text>
${boxes}
${arrows}
<text x="80" y="524" font-family="Arial, sans-serif" font-size="22" fill="#333333">읽는 중 머릿속에 남겨둘 구조: ${escapeXml(anchor.label)}를 먼저 보고, 세부 설명을 다시 읽는다.</text>
<text x="1088" y="562" text-anchor="end" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#111111">SEOJing</text>
</svg>
`;
}

function buildSnippet(publicPath, alt, caption) {
  return `<ArticleImage\n  src="${escapeAttr(publicPath)}"\n  alt="${escapeAttr(alt)}"\n  caption="${escapeAttr(caption)}"\n/>`;
}

function insertAfterHeading(source, absoluteLine, snippet) {
  const lines = source.split("\n");
  lines.splice(absoluteLine, 0, "", snippet);
  return lines.join("\n");
}

function postInfo(file) {
  const source = fs.readFileSync(file, "utf8");
  const parsed = parseFrontmatter(source);
  return {
    file,
    source,
    parsed,
    title: readScalar(parsed.frontmatter, "title") || slugFor(file),
    description: readScalar(parsed.frontmatter, "description"),
    alreadyHasImage: hasInlineImage(parsed.body),
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

async function searchWikimedia(info, anchor, args) {
  const query = args.query ? String(args.query) : anchor.query;
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
    headers: {
      "User-Agent": "SEOJingInlineVisualBot/1.0 (https://seojing.com)",
    },
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
      alt: `${anchor.title} section을 보조하는 참고 이미지`,
      caption: `Wikimedia Commons · ${attributionFromMetadata(image.extmetadata ?? {}, page.title)}`,
      query,
    };
  }
  throw new Error(`No suitable Wikimedia image for query: ${query}`);
}

async function resolveCandidate(info, anchor, args) {
  const errors = [];
  if (args.provider === "wikimedia") {
    return searchWikimedia(info, anchor, args);
  }
  if (args.provider === "auto" && anchor.kind === "interface") {
    try {
      return await searchWikimedia(info, anchor, args);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (args.provider === "diagram" || args.provider === "auto") {
    const svg = buildDiagramSvg(info, anchor);
    return {
      provider: "diagram",
      buffer: Buffer.from(svg, "utf8"),
      extension: ".svg",
      alt: `${info.title} 글의 ${anchor.title} 섹션을 설명하는 ${anchor.label} 다이어그램`,
      caption: `SEOJing authored diagram · ${anchor.label}`,
      query: errors.join(" | ") || undefined,
    };
  }
  throw new Error(
    errors.join(" | ") || "No provider could produce an inline visual",
  );
}

async function materializeCandidate(candidate, targetPath) {
  if (candidate.buffer) {
    fs.writeFileSync(targetPath, candidate.buffer);
    return;
  }
  if (!candidate.url) throw new Error("Candidate has neither buffer nor url");
  const response = await fetch(candidate.url, {
    headers: {
      "User-Agent": "SEOJingInlineVisualBot/1.0 (https://seojing.com)",
    },
  });
  if (!response.ok)
    throw new Error(`Image download failed: HTTP ${response.status}`);
  fs.writeFileSync(targetPath, Buffer.from(await response.arrayBuffer()));
}

async function processFile(info, args) {
  if (info.alreadyHasImage && !args.force) {
    return {
      status: "skipped",
      file: info.file,
      reason: "inline image already exists",
    };
  }

  const anchor = chooseVisualAnchor(info, args);
  if (!anchor) {
    return {
      status: "skipped",
      file: info.file,
      reason: "inline visual skipped: no useful visual anchor",
    };
  }

  const candidate = await resolveCandidate(info, anchor, args);
  const section = contentSectionFor(info.file);
  const slug = kebab(slugFor(info.file)) || "post";
  const targetDir = path.join(inlineRoot, section, slug);
  const filename = nextFilename(targetDir, candidate.extension);
  const targetPath = path.join(targetDir, filename);
  const publicPath = `/${toPosixPath(path.relative(publicRoot, targetPath))}`;
  const snippet = buildSnippet(publicPath, candidate.alt, candidate.caption);
  const nextSource = insertAfterHeading(
    info.source,
    anchor.absoluteLine,
    snippet,
  );

  const result = {
    status: args.write ? "written" : "dry-run",
    file: info.file,
    title: info.title,
    anchor: anchor.title,
    line: anchor.absoluteLine,
    score: anchor.score,
    words: anchor.words,
    signals: anchor.signals,
    provider: candidate.provider,
    query: candidate.query,
    image: candidate.url,
    target: targetPath,
    publicPath,
  };

  if (!args.write) return result;
  fs.mkdirSync(targetDir, { recursive: true });
  await materializeCandidate(candidate, targetPath);
  fs.writeFileSync(info.file, nextSource);
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const infos = walkMdx(args.path).map(postInfo).slice(0, args.limit);
  console.log(
    `${args.write ? "write" : "dry-run"}: ${infos.length} file(s), provider=${args.provider}`,
  );
  if (!infos.length) return;

  const results = [];
  for (const info of infos) {
    try {
      const result = await processFile(info, args);
      results.push(result);
      if (result.status === "skipped") {
        console.log(
          `SKIP ${path.relative(repoRoot, info.file)}: ${result.reason}`,
        );
        continue;
      }
      console.log(
        `OK ${path.relative(repoRoot, info.file)} -> ${result.publicPath} (${result.provider})`,
      );
      console.log(
        `   anchor: ${result.anchor} (line ${result.line}, score ${result.score}, signals ${result.signals.join(",") || "none"})`,
      );
      if (result.query) console.log(`   query/evidence: ${result.query}`);
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
