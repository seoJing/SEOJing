export type BlockType =
  | "PARAGRAPH"
  | "HEADING"
  | "CODE"
  | "IMAGE"
  | "CALLOUT"
  | "QUIZ";

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
      const firstItem = Array.isArray(block.content.items)
        ? block.content.items[0]
        : undefined;
      if (firstItem && typeof firstItem === "object") {
        const item = firstItem as Record<string, unknown>;
        const props = item.props;
        return {
          ...block,
          content:
            props && typeof props === "object"
              ? (props as Record<string, unknown>)
              : item,
        };
      }
    }

    return block;
  });
}
