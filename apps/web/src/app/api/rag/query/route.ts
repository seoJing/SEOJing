import searchIndex from "@/generated/mdx-search-index.json";
import { handlePostQaRequest, type MdxSearchChunk } from "@/shared/rag/post-qa";

const chunks = searchIndex as MdxSearchChunk[];

function handler(request: Request) {
  return handlePostQaRequest(request, { chunks });
}

export const POST = handler;
export const GET = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
