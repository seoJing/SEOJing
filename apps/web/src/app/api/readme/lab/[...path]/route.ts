import { readmeBackendOrigin } from "@/shared/readme/backend-origin";

const PREPARE_BYTES = 2_900_000;
const SMALL_BYTES = 4_096;
const RESPONSE_BYTES = 4_000_000;
const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, no-store",
  "x-robots-tag": "noindex, nofollow, noarchive",
};
const json = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), { status, headers: HEADERS });

function target(request: Request): string | null {
  const url = new URL(request.url);
  const match =
    /^\/api\/readme\/lab\/(session|prepare|jobs)(?:\/([A-Za-z0-9_-]{1,100}))?$/.exec(
      url.pathname,
    );
  if (!match) return null;
  const [, resource, id] = match;
  const create = !id && request.method === "POST";
  const view =
    id && resource !== "session" && ["GET", "DELETE"].includes(request.method);
  if (!create && !view) return null;
  const query = [...url.searchParams];
  if (query.length) {
    if (
      request.method !== "GET" ||
      resource !== "jobs" ||
      !id ||
      query.length !== 1
    )
      return null;
    const [key, value] = query[0]!;
    if (
      key !== "after_seq" ||
      !/^(0|[1-9]\d*)$/.test(value) ||
      !Number.isSafeInteger(Number(value))
    )
      return null;
  }
  return `/readme/lab/${resource}${id ? `/${id}` : ""}${url.search}`;
}

class TooLarge extends Error {}
async function boundedBody(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  signal.throwIfAborted();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        abort();
        throw new TooLarge();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

async function proxy(request: Request): Promise<Response> {
  const path = target(request);
  if (!path) return json("not_found", 404);
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 30_000);
  const signal = AbortSignal.any([request.signal, timeout.signal]);
  try {
    const headers = new Headers();
    const authorization = request.headers.get("authorization");
    if (authorization && /^Bearer [A-Za-z0-9_-]{1,200}$/.test(authorization))
      headers.set("authorization", authorization);
    // In production this request enters through Cloudflare. Do not accept the
    // browser's x-real-ip, cookies or arbitrary headers as upstream authority.
    const visitorIp = request.headers.get("cf-connecting-ip");
    if (visitorIp) headers.set("x-real-ip", visitorIp);
    let body: string | undefined;
    if (request.method === "POST") {
      if (
        !/^application\/json(?:\s*;|$)/i.test(
          request.headers.get("content-type") ?? "",
        )
      )
        return json("unsupported_media_type", 415);
      headers.set("content-type", "application/json");
      const limit =
        path === "/readme/lab/prepare" ? PREPARE_BYTES : SMALL_BYTES;
      const length = request.headers.get("content-length");
      if (length && /^\d+$/.test(length) && Number(length) > limit)
        return json("request_too_large", 413);
      try {
        body = new TextDecoder("utf-8", { fatal: true }).decode(
          await boundedBody(request.body, limit, signal),
        );
        JSON.parse(body);
      } catch (error) {
        if (signal.aborted) throw error;
        return json(
          error instanceof TooLarge ? "request_too_large" : "invalid_input",
          error instanceof TooLarge ? 413 : 400,
        );
      }
    }
    const upstream = await fetch(`${readmeBackendOrigin()}${path}`, {
      method: request.method,
      headers,
      body,
      signal,
      cache: "no-store",
      redirect: "manual",
    });
    if (upstream.status === 204)
      return new Response(null, { status: 204, headers: HEADERS });
    if (upstream.status >= 300 && upstream.status < 400) {
      void upstream.body?.cancel().catch(() => undefined);
      return json("upstream_unavailable", 502);
    }
    if (
      !/^application\/json(?:\s*;|$)/i.test(
        upstream.headers.get("content-type") ?? "",
      )
    ) {
      void upstream.body?.cancel().catch(() => undefined);
      return json("upstream_unavailable", 502);
    }
    const bytes = await boundedBody(upstream.body, RESPONSE_BYTES, signal);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    JSON.parse(text);
    return new Response(text, { status: upstream.status, headers: HEADERS });
  } catch {
    return json("upstream_unavailable", signal.aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
}

export const GET = proxy;
export const POST = proxy;
export const DELETE = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
