import searchIndex from "@/generated/mdx-search-index.json";
import { handlePostQaRequest, type MdxSearchChunk } from "@/shared/rag/post-qa";

function isMdxSearchChunk(value: unknown): value is MdxSearchChunk {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const chunk = value as Record<string, unknown>;
  return (
    typeof chunk.id === "string" &&
    typeof chunk.slug === "string" &&
    typeof chunk.href === "string" &&
    typeof chunk.title === "string" &&
    typeof chunk.heading === "string" &&
    typeof chunk.content === "string" &&
    typeof chunk.searchText === "string"
  );
}

const chunks = (Array.isArray(searchIndex) ? searchIndex : []).filter(
  isMdxSearchChunk,
);

function handler(request: Request) {
  return handlePostQaRequest(request, { chunks });
}

export const POST = handler;
export const GET = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
