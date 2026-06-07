import type { ContentFrontmatter } from "./content-types";

export interface ContentChunkInput {
  slug: string;
  frontmatter: ContentFrontmatter;
  source: string;
}

export interface ContentChunk {
  id: string;
  slug: string;
  slugParts: string[];
  href: string;
  title: string;
  description: string;
  tags: string[];
  date: string;
  heading: string;
  headingPath: string[];
  level: number;
  content: string;
  searchText: string;
}

interface HeadingState {
  level: number;
  text: string;
  anchor: string;
}

const ATX_HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const SUBTITLE_OPEN_RE = /<Subtitle\b[^>]*level=\{?(\d)\}?[^>]*>(.*)$/;
const SUBTITLE_CLOSE_RE = /^(.*?)<\/Subtitle>/;

export function chunkMdxByHeadings(input: ContentChunkInput): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  const stack: HeadingState[] = [];
  const lines = input.source.replace(/\r\n/g, "\n").split("\n");
  let currentHeading: HeadingState = {
    level: 1,
    text: input.frontmatter.title,
    anchor: slugifySegment(input.frontmatter.title),
  };
  let buffer: string[] = [];
  let inFence = false;
  let subtitleCapture: { level: number; lines: string[] } | null = null;

  const pushChunk = () => {
    const content = normalizeContent(buffer.join("\n"));
    if (!content) return;

    const headingPath = stack.map((heading) => heading.text);
    const headingAnchorPath = stack.map((heading) => heading.anchor);
    const id = [input.slug, ...headingAnchorPath].filter(Boolean).join("#");
    const slugParts = input.slug.split("/").filter(Boolean);

    chunks.push({
      id,
      slug: input.slug,
      slugParts,
      href: `/blog/${input.slug}`,
      title: input.frontmatter.title,
      description: input.frontmatter.description,
      tags: input.frontmatter.tags,
      date: input.frontmatter.date,
      heading: currentHeading.text,
      headingPath,
      level: currentHeading.level,
      content,
      searchText: normalizeSearchText([
        input.frontmatter.title,
        input.frontmatter.description,
        input.frontmatter.tags.join(" "),
        headingPath.join(" "),
        content,
      ]),
    });
  };

  for (const line of lines) {
    if (subtitleCapture) {
      const closeMatch = line.match(SUBTITLE_CLOSE_RE);
      if (closeMatch) {
        subtitleCapture.lines.push(closeMatch[1]!);
        setCurrentHeading(
          subtitleCapture.level,
          cleanHeadingText(subtitleCapture.lines.join(" ")),
        );
        subtitleCapture = null;
        continue;
      }
      subtitleCapture.lines.push(line);
      continue;
    }

    if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) {
      inFence = !inFence;
      buffer.push(line);
      continue;
    }

    const subtitleMatch = inFence ? null : line.match(SUBTITLE_OPEN_RE);
    if (subtitleMatch) {
      pushChunk();
      buffer = [];

      const level = Number(subtitleMatch[1]);
      const afterOpen = subtitleMatch[2]!;
      const closeMatch = afterOpen.match(SUBTITLE_CLOSE_RE);
      if (closeMatch) {
        setCurrentHeading(level, cleanHeadingText(closeMatch[1]!));
      } else {
        subtitleCapture = { level, lines: [afterOpen] };
      }
      continue;
    }

    const headingMatch = inFence ? null : line.match(ATX_HEADING_RE);
    if (!headingMatch) {
      buffer.push(line);
      continue;
    }

    pushChunk();
    buffer = [];

    const level = headingMatch[1]!.length;
    setCurrentHeading(level, cleanHeadingText(headingMatch[2]!));
  }

  function setCurrentHeading(level: number, text: string) {
    currentHeading = { level, text, anchor: slugifySegment(text) };

    while (stack.length > 0 && stack[stack.length - 1]!.level >= level) {
      stack.pop();
    }
    stack.push(currentHeading);
  }

  pushChunk();
  return chunks;
}

export function buildMdxSearchIndex(
  inputs: ContentChunkInput[],
): ContentChunk[] {
  return inputs.flatMap((input) => chunkMdxByHeadings(input));
}

function normalizeContent(value: string): string {
  return value
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function normalizeSearchText(parts: string[]): string {
  return parts
    .join(" ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_~>#{}[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function stripInlineMarkup(value: string): string {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]/g, "")
    .trim();
}

function cleanHeadingText(value: string): string {
  return stripInlineMarkup(value)
    .replace(/<[^>]+>/g, "")
    .replace(/\{" "\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifySegment(value: string): string {
  const slug = stripInlineMarkup(value)
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "section";
}
