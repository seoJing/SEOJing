import searchIndex from "@/generated/mdx-search-index.json";
import { handlePostQaRequest, type MdxSearchChunk } from "@/shared/rag/post-qa";

const chunks = searchIndex as MdxSearchChunk[];

export function POST(request: Request) {
  return handlePostQaRequest(request, { chunks });
}
