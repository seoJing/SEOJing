import {
  questionLengthBucket,
  type PostQaResult,
  type QaSource,
  type RelatedPost,
} from "@/shared/rag/post-qa";
import { env as cloudflareEnv } from "cloudflare:workers";

type BackendQaSource = {
  articleSlug?: unknown;
  blockId?: unknown;
  sectionId?: unknown;
  heading?: unknown;
  excerpt?: unknown;
  score?: unknown;
};

type BackendQaRelated = {
  slug?: unknown;
  title?: unknown;
};

type BackendQaResponse = {
  ok?: unknown;
  slug?: unknown;
  answer?: unknown;
  status?: unknown;
  sources?: unknown;
  related?: unknown;
};

const MAX_BODY_BYTES = 16 * 1024;
const BACKEND_QA_TIMEOUT_MS = 8_000;

export async function POST(request: Request): Promise<Response> {
  let qaRequest: NormalizedQaRequest | null = null;
  try {
    const body = await readJsonBody(request, MAX_BODY_BYTES);
    qaRequest = normalizeQaRequest(body);
    if (!qaRequest) {
      return jsonResponse(400, invalidResult(""));
    }
  } catch {
    return jsonResponse(400, invalidResult(""));
  }

  try {
    const origin = backendQaOrigin();
    if (!origin) {
      return jsonResponse(503, unavailableResult(qaRequest.question));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BACKEND_QA_TIMEOUT_MS);
    let backendResponse: Response;
    try {
      backendResponse = await fetch(
        `${origin}/articles/${encodeURIComponent(qaRequest.slug)}/qa`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...forwardRequestId(request),
          },
          body: JSON.stringify({
            question: qaRequest.question,
            ...(qaRequest.sectionId ? { section_id: qaRequest.sectionId } : {}),
            ...(qaRequest.sessionId ? { session_id: qaRequest.sessionId } : {}),
          }),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!backendResponse.ok) {
      return jsonResponse(
        backendResponse.status === 404 ? 404 : 502,
        unavailableResult(qaRequest.question),
      );
    }

    const backendBody = (await backendResponse.json()) as BackendQaResponse;
    return jsonResponse(
      200,
      mapBackendQaResult(backendBody, qaRequest.question),
    );
  } catch {
    return jsonResponse(503, unavailableResult(qaRequest.question));
  }
}

export function GET(): Response {
  return methodNotAllowed();
}

export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const OPTIONS = GET;

function backendQaOrigin(): string | null {
  const cloudflareRuntimeEnv = cloudflareEnv as Partial<BackendQaRuntimeEnv>;
  const runtimeEnv =
    (
      import.meta as unknown as {
        env?: Partial<BackendQaRuntimeEnv>;
      }
    ).env ?? {};
  const processEnv = typeof process === "undefined" ? undefined : process.env;
  const value =
    processEnv?.SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    processEnv?.SEOJING_BACKEND_API_ORIGIN ??
    cloudflareRuntimeEnv.SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    cloudflareRuntimeEnv.SEOJING_BACKEND_API_ORIGIN ??
    runtimeEnv.SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    runtimeEnv.SEOJING_BACKEND_API_ORIGIN ??
    runtimeEnv.VITE_SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    runtimeEnv.VITE_SEOJING_BACKEND_API_ORIGIN;
  if (!value?.trim()) return null;
  return value.trim().replace(/\/+$/, "");
}

type BackendQaRuntimeEnv = {
  SEOJING_BACKEND_ARTICLE_API_ORIGIN: string;
  SEOJING_BACKEND_API_ORIGIN: string;
  VITE_SEOJING_BACKEND_ARTICLE_API_ORIGIN: string;
  VITE_SEOJING_BACKEND_API_ORIGIN: string;
};

async function readJsonBody(
  request: Request,
  maxBodyBytes: number,
): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBodyBytes) {
    throw new Error("payload too large");
  }
  if (!request.body) {
    return {};
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBodyBytes) {
        await reader.cancel();
        throw new Error("payload too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bodyBytes);
  return text.trim() ? JSON.parse(text) : {};
}

type NormalizedQaRequest = {
  slug: string;
  question: string;
  sectionId?: string;
  sessionId?: string;
};

function normalizeQaRequest(body: unknown): NormalizedQaRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.slug !== "string") return null;
  if (typeof candidate.question !== "string") return null;
  const slug = candidate.slug.trim();
  const question = candidate.question.trim();
  if (!slug || !question || question.length > 600) return null;
  return {
    slug,
    question,
    sectionId: readOptionalString(candidate.section_id ?? candidate.sectionId),
    sessionId: readOptionalString(candidate.session_id ?? candidate.sessionId),
  };
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function mapBackendQaResult(
  backendBody: BackendQaResponse,
  question: string,
): PostQaResult {
  const status =
    backendBody.status === "answered" ? "answered" : "insufficient_context";
  const action =
    status === "answered" ? "answer_shown" : "insufficient_context";
  const sources = Array.isArray(backendBody.sources)
    ? backendBody.sources.map(toQaSource).filter(isQaSource)
    : [];
  const relatedPosts = Array.isArray(backendBody.related)
    ? backendBody.related.map(toRelatedPost).filter(isRelatedPost)
    : [];

  return {
    status,
    answer:
      typeof backendBody.answer === "string" && backendBody.answer.trim()
        ? backendBody.answer
        : "백엔드 Q&A에서 충분한 근거를 찾지 못했어요.",
    sources,
    relatedPosts,
    analytics: {
      event_type: "qa_interaction",
      event: {
        action,
        question_length_bucket: questionLengthBucket(question),
      },
    },
  };
}

function toQaSource(value: unknown): QaSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as BackendQaSource;
  if (typeof source.articleSlug !== "string") return null;
  if (typeof source.blockId !== "string") return null;
  return {
    chunkId: source.blockId,
    slug: source.articleSlug,
    href: `/blog/${source.articleSlug}`,
    title: source.articleSlug,
    heading: qaSourceHeading(source),
    excerpt: typeof source.excerpt === "string" ? source.excerpt : "",
    score: typeof source.score === "number" ? source.score : 0,
  };
}

function qaSourceHeading(source: BackendQaSource): string {
  if (typeof source.heading === "string" && source.heading.trim()) {
    return source.heading;
  }
  if (typeof source.sectionId === "string" && source.sectionId.trim()) {
    return source.sectionId;
  }
  return "근거 블록";
}

function toRelatedPost(value: unknown): RelatedPost | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const related = value as BackendQaRelated;
  if (typeof related.slug !== "string") return null;
  return {
    slug: related.slug,
    href: `/blog/${related.slug}`,
    title: typeof related.title === "string" ? related.title : related.slug,
  };
}

function isQaSource(source: QaSource | null): source is QaSource {
  return source !== null;
}

function isRelatedPost(post: RelatedPost | null): post is RelatedPost {
  return post !== null;
}

function invalidResult(question: string): PostQaResult {
  return {
    status: "invalid_request",
    answer: "질문은 1자 이상 600자 이하의 문자열이어야 해요.",
    sources: [],
    relatedPosts: [],
    analytics: {
      event_type: "qa_interaction",
      event: {
        action: "invalid_request",
        question_length_bucket: questionLengthBucket(question),
      },
    },
  };
}

function unavailableResult(question: string): PostQaResult {
  return {
    status: "insufficient_context",
    answer:
      "백엔드 Q&A API와 연결하지 못했어요. 글 읽기는 그대로 가능하니 잠시 후 다시 시도해주세요.",
    sources: [],
    relatedPosts: [],
    analytics: {
      event_type: "qa_interaction",
      event: {
        action: "insufficient_context",
        question_length_bucket: questionLengthBucket(question),
      },
    },
  };
}

function jsonResponse(status: number, body: PostQaResult): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

function methodNotAllowed(): Response {
  return new Response(
    JSON.stringify({ ok: false, error: "method_not_allowed" }),
    {
      status: 405,
      headers: {
        "content-type": "application/json; charset=utf-8",
        allow: "POST",
        "cache-control": "private, no-store",
      },
    },
  );
}

function forwardRequestId(request: Request): Record<string, string> {
  const requestId = request.headers.get("x-request-id");
  return requestId ? { "x-request-id": requestId } : {};
}
