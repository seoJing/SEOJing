import {
  ingestAnalyticsEvents,
  type AnalyticsEventStorage,
} from "./analytics-ingestion";

export type AnalyticsCollectOptions = {
  storage: AnalyticsEventStorage;
  allowedOrigins: string[];
  maxBodyBytes?: number;
  now?: () => string;
};

const DEFAULT_MAX_BODY_BYTES = 32 * 1024;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function jsonResponse(
  status: number,
  body: unknown,
  headers: HeadersInit = {},
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

function normalizeRequestId(request: Request): string {
  const requestId = request.headers.get("x-request-id");
  if (requestId && REQUEST_ID_PATTERN.test(requestId)) return requestId;
  return crypto.randomUUID();
}

function corsHeaders(request: Request, allowedOrigins: string[]): HeadersInit {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.includes(origin)) {
    return { vary: "Origin" };
  }

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type,x-request-id",
    vary: "Origin",
  };
}

async function readJsonBody(
  request: Request,
  maxBodyBytes: number,
): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBodyBytes) {
    throw Object.assign(new Error("payload too large"), { status: 413 });
  }

  if (!request.body) return {};

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBodyBytes) {
      await reader.cancel();
      throw Object.assign(new Error("payload too large"), { status: 413 });
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(bytes);
  if (!text.trim()) return {};
  return JSON.parse(text);
}

export async function handleAnalyticsCollectRequest(
  request: Request,
  options: AnalyticsCollectOptions,
): Promise<Response> {
  const url = new URL(request.url);
  const requestId = normalizeRequestId(request);
  const headers = {
    ...corsHeaders(request, options.allowedOrigins),
    "x-request-id": requestId,
  };
  const origin = request.headers.get("origin");

  if (
    request.method === "OPTIONS" &&
    url.pathname.endsWith("/analytics/events")
  ) {
    return new Response(null, { status: 204, headers });
  }

  if (
    request.method !== "POST" ||
    !url.pathname.endsWith("/analytics/events")
  ) {
    return jsonResponse(
      404,
      { ok: false, error: "not_found", request_id: requestId },
      headers,
    );
  }

  if (origin && !options.allowedOrigins.includes(origin)) {
    return jsonResponse(
      403,
      { ok: false, error: "origin_not_allowed", request_id: requestId },
      headers,
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
    const code = status === 413 ? "payload_too_large" : "invalid_json";
    return jsonResponse(
      status,
      { ok: false, error: code, request_id: requestId },
      headers,
    );
  }

  const result = await ingestAnalyticsEvents({
    body,
    requestId,
    receivedAt: options.now?.() ?? new Date().toISOString(),
    storage: options.storage,
  });

  return jsonResponse(result.status, result.body, headers);
}
