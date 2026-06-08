export type MdxSearchChunk = {
  id: string;
  slug: string;
  slugParts?: string[];
  href: string;
  title: string;
  description?: string;
  tags?: string[];
  date?: string;
  heading: string;
  headingPath: string[];
  level: number;
  content: string;
  searchText: string;
};

export type QaSource = {
  chunkId: string;
  slug: string;
  href: string;
  title: string;
  heading: string;
  excerpt: string;
  score: number;
};

export type RelatedPost = {
  slug: string;
  href: string;
  title: string;
};

export type PostQaStatus =
  | "answered"
  | "insufficient_context"
  | "invalid_request";

export type PostQaResult = {
  status: PostQaStatus;
  answer: string;
  sources: QaSource[];
  relatedPosts: RelatedPost[];
  analytics: {
    event_type: "qa_interaction";
    event: {
      action: "answer_shown" | "insufficient_context" | "invalid_request";
      question_length_bucket: ReturnType<typeof questionLengthBucket>;
    };
  };
};

export type AnswerPostQuestionOptions = {
  question: string;
  currentSlug: string;
  chunks: MdxSearchChunk[];
  maxSources?: number;
};

export type PostQaHandlerOptions = {
  chunks: MdxSearchChunk[];
  now?: () => string;
  maxBodyBytes?: number;
};

const DEFAULT_MAX_BODY_BYTES = 16 * 1024;
const MAX_QUESTION_CHARS = 500;
const MIN_SCORE = 3;
const WORD_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}._+-]*/gu;
const MARKUP_PATTERN = /<[^>]+>|```[\s\S]*?```|`([^`]+)`/g;

function jsonResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      ...headers,
    },
  });
}

export function questionLengthBucket(
  question: string,
): "1-40" | "41-120" | "121+" {
  const length = question.trim().length;
  if (length <= 40) return "1-40";
  if (length <= 120) return "41-120";
  return "121+";
}

function analytics(
  action: PostQaResult["analytics"]["event"]["action"],
  question: string,
): PostQaResult["analytics"] {
  return {
    event_type: "qa_interaction",
    event: {
      action,
      question_length_bucket: questionLengthBucket(question),
    },
  };
}

function tokenize(value: string): string[] {
  const normalized = value.toLocaleLowerCase("ko-KR");
  const matches = normalized.match(WORD_PATTERN) ?? [];
  return Array.from(
    new Set(
      matches.filter((token) => token.length >= 2 || /[a-z0-9]/.test(token)),
    ),
  );
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function plainText(value: string): string {
  return value
    .replace(MARKUP_PATTERN, "$1")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFor(content: string, terms: string[], maxChars = 190): string {
  const text = plainText(content);
  if (text.length <= maxChars) return text;

  const lower = text.toLocaleLowerCase("ko-KR");
  const firstHit = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  const start = Math.max(0, (firstHit ?? 0) - 45);
  const excerpt = text.slice(start, start + maxChars).trim();
  return `${start > 0 ? "…" : ""}${excerpt}${start + maxChars < text.length ? "…" : ""}`;
}

function scoreChunk(
  chunk: MdxSearchChunk,
  terms: string[],
  currentSlug: string,
): number {
  const title = chunk.title.toLocaleLowerCase("ko-KR");
  const heading = chunk.heading.toLocaleLowerCase("ko-KR");
  const searchText = chunk.searchText.toLocaleLowerCase("ko-KR");
  const content = plainText(chunk.content).toLocaleLowerCase("ko-KR");

  let score = chunk.slug === currentSlug ? 1.5 : 0;

  for (const term of terms) {
    score += countOccurrences(title, term) * 4;
    score += countOccurrences(heading, term) * 5;
    score += Math.min(countOccurrences(searchText, term), 4) * 2;
    score += Math.min(countOccurrences(content, term), 3);
  }

  return score;
}

function buildAnswer(sources: QaSource[]): string {
  const evidence = sources
    .slice(0, 3)
    .map((source, index) => `출처 ${index + 1}: ${source.excerpt}`)
    .join("\n\n");

  return `현재 인덱스에서 찾은 근거로 답하면 다음과 같아요.\n\n${evidence}`;
}

function invalidResult(question: string): PostQaResult {
  return {
    status: "invalid_request",
    answer: "질문은 1자 이상 500자 이하의 문자열이어야 해요.",
    sources: [],
    relatedPosts: [],
    analytics: analytics("invalid_request", question),
  };
}

export function answerPostQuestion({
  question,
  currentSlug,
  chunks,
  maxSources = 4,
}: AnswerPostQuestionOptions): PostQaResult {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion || trimmedQuestion.length > MAX_QUESTION_CHARS) {
    return invalidResult(question);
  }

  const terms = tokenize(trimmedQuestion);
  if (terms.length === 0) return invalidResult(question);

  const sources = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms, currentSlug) }))
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSources)
    .map<QaSource>(({ chunk, score }) => ({
      chunkId: chunk.id,
      slug: chunk.slug,
      href: chunk.href,
      title: chunk.title,
      heading: chunk.heading,
      excerpt: excerptFor(chunk.content, terms),
      score: Number(score.toFixed(2)),
    }));

  if (sources.length === 0) {
    return {
      status: "insufficient_context",
      answer:
        "현재 포스트 인덱스에서 충분한 근거를 찾지 못했어요. 질문을 더 구체적으로 바꾸거나 관련 포스트를 먼저 열어주세요.",
      sources: [],
      relatedPosts: [],
      analytics: analytics("insufficient_context", trimmedQuestion),
    };
  }

  const relatedPosts = Array.from(
    new Map(
      sources
        .filter((source) => source.slug !== currentSlug)
        .map((source) => [
          source.slug,
          { slug: source.slug, href: source.href, title: source.title },
        ]),
    ).values(),
  );

  return {
    status: "answered",
    answer: buildAnswer(sources),
    sources,
    relatedPosts,
    analytics: analytics("answer_shown", trimmedQuestion),
  };
}

function concatChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function readJsonBody(
  request: Request,
  maxBodyBytes: number,
): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBodyBytes) {
    throw Object.assign(new Error("payload too large"), { status: 413 });
  }

  const reader = request.body?.getReader();
  if (!reader) return {};

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    receivedBytes += value.byteLength;
    if (receivedBytes > maxBodyBytes) {
      await reader.cancel();
      throw Object.assign(new Error("payload too large"), { status: 413 });
    }
    chunks.push(value);
  }

  const body = new TextDecoder().decode(concatChunks(chunks, receivedBytes));
  if (!body.trim()) return {};
  return JSON.parse(body);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function handlePostQaRequest(
  request: Request,
  options: PostQaHandlerOptions,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(
      405,
      { status: "method_not_allowed" },
      { Allow: "POST" },
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(
      request,
      options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
    );
  } catch (error) {
    const status = (error as { status?: number }).status ?? 400;
    return jsonResponse(status, {
      status: status === 413 ? "payload_too_large" : "invalid_json",
    });
  }

  if (!isRecord(body)) {
    return jsonResponse(400, invalidResult(""));
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const question = typeof body.question === "string" ? body.question : "";
  if (
    !slug ||
    !question.trim() ||
    question.trim().length > MAX_QUESTION_CHARS
  ) {
    return jsonResponse(400, invalidResult(question));
  }

  const result = answerPostQuestion({
    question,
    currentSlug: slug,
    chunks: options.chunks,
  });

  return jsonResponse(result.status === "invalid_request" ? 400 : 200, {
    ...result,
    generated_at: options.now?.() ?? new Date().toISOString(),
  });
}
