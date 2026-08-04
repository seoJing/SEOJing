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
