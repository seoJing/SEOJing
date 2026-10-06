export type BlockType =
  | "PARAGRAPH"
  | "HEADING"
  | "CODE"
  | "IMAGE"
  | "CALLOUT"
  | "QUIZ";

export const blockTypes: BlockType[] = [
  "PARAGRAPH",
  "HEADING",
  "CODE",
  "IMAGE",
  "CALLOUT",
  "QUIZ",
];

export type ArticleBlock = {
  id?: string;
  type: BlockType;
  sortOrder?: number;
  content: Record<string, unknown>;
  plainText?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type MdxSection = { label: string; source: string };

/** Textareas use LF internally; restore the source's line endings on edit. */
export function preserveMdxLineEndings(
  edited: string,
  originalSection: string,
  originalDocument: string,
): string {
  const newline =
    originalSection.match(/\r\n|\n|\r/)?.[0] ??
    originalDocument.match(/\r\n|\n|\r/)?.[0] ??
    "\n";
  return edited.replace(/\r\n|\n|\r/g, newline);
}

/** Keep the original MDX bytes intact while giving long legacy posts sections. */
export function splitMdxSections(source: string): MdxSection[] {
  if (!source) return [{ label: "도입·문서 설정", source: "" }];

  const boundaries = [0];
  const labels = ["도입·문서 설정"];
  const lines = source.match(/.*(?:\r\n|\n|\r|$)/g) ?? [];
  let offset = 0;
  let inFrontmatter =
    source.startsWith("---\n") || source.startsWith("---\r\n");
  let fence: { marker: string; length: number } | null = null;

  for (const line of lines) {
    if (!line) continue;
    const plain = line.replace(/[\r\n]+$/, "");
    if (inFrontmatter) {
      if (offset > 0 && plain === "---") inFrontmatter = false;
    } else {
      const fenceMatch = plain.match(/^ {0,3}(`{3,}|~{3,})/);
      if (!fence && fenceMatch) {
        const marker = fenceMatch[1]![0]!;
        fence = { marker, length: fenceMatch[1]!.length };
      } else if (fence) {
        if (
          fenceMatch &&
          fence.marker === fenceMatch[1]![0] &&
          fenceMatch[1]!.length >= fence.length &&
          plain.slice(fenceMatch[0].length).trim() === ""
        ) {
          fence = null;
        }
      } else {
        const heading = plain.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (heading) {
          const label = heading[2]!.replace(/[`*_]/g, "").trim();
          if (offset > 0) {
            boundaries.push(offset);
            labels.push(label);
          } else {
            labels[0] = label;
          }
        }
      }
    }
    offset += line.length;
  }

  return boundaries.map((start, index) => ({
    label: labels[index]!,
    source: source.slice(start, boundaries[index + 1] ?? source.length),
  }));
}

/**
 * Converts editor-only block content shapes to the API's persisted format.
 */
export function toBackendBlocks(blocks: ArticleBlock[]): ArticleBlock[] {
  return blocks.map((block) => {
    if (block.type === "IMAGE") {
      const { src, ...rest } = block.content;
      return {
        ...block,
        content: {
          ...rest,
          url: typeof src === "string" ? src : block.content.url,
        },
      };
    }

    if (block.type === "QUIZ") {
      return { ...block, content: normalizeQuizContent(block.content) };
    }

    return block;
  });
}

/** Converts persisted quiz items into the editor's direct-field shape. */
export function normalizeBlocks(
  blocks: ArticleBlock[] | undefined,
): ArticleBlock[] {
  return (blocks ?? [])
    .filter(
      (block): block is ArticleBlock =>
        Boolean(block) &&
        blockTypes.includes(block.type) &&
        Boolean(block.content) &&
        typeof block.content === "object" &&
        !Array.isArray(block.content),
    )
    .map((block) =>
      block.type === "QUIZ"
        ? { ...block, content: normalizeQuizContent(block.content) }
        : { ...block, content: { ...block.content } },
    );
}

function normalizeQuizContent(
  content: Record<string, unknown>,
): Record<string, unknown> {
  const { items, ...directContent } = content;
  const firstItem = Array.isArray(items) ? items[0] : undefined;
  if (!firstItem || typeof firstItem !== "object" || Array.isArray(firstItem)) {
    return directContent;
  }

  const item = firstItem as Record<string, unknown>;
  const legacyContent =
    item.props && typeof item.props === "object" && !Array.isArray(item.props)
      ? (item.props as Record<string, unknown>)
      : item;
  return { ...legacyContent, ...directContent };
}
