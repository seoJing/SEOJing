import {
  MAX_RESUME_BYTES,
  USER_CASE_ID,
  isReadmePreview,
  resumeMediaType,
} from "@/shared/readme/preview";
import { readmeBackendOrigin } from "@/shared/readme/backend-origin";

const MAX_BODY_BYTES = 2_820_000;

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.body) throw new Error("invalid_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUnsafeFilenameCharacters(value: string): boolean {
  return (
    value.includes("/") ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  );
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "json_required" }, 415);
  }
  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error && error.message === "too_large"
            ? "too_large"
            : "invalid_json",
      },
      error instanceof Error && error.message === "too_large" ? 413 : 400,
    );
  }
  if (
    !isRecord(body) ||
    Object.keys(body).sort().join(",") !==
      "job_text,resume_base64,resume_filename,resume_media_type"
  ) {
    return json({ error: "invalid_input" }, 400);
  }
  const { job_text, resume_filename, resume_media_type, resume_base64 } = body;
  if (
    typeof job_text !== "string" ||
    job_text.trim().length < 20 ||
    job_text.length > 6_000 ||
    typeof resume_filename !== "string" ||
    resume_filename.length < 1 ||
    resume_filename.length > 120 ||
    hasUnsafeFilenameCharacters(resume_filename) ||
    typeof resume_media_type !== "string" ||
    resumeMediaType(resume_filename) !== resume_media_type ||
    typeof resume_base64 !== "string" ||
    resume_base64.length === 0 ||
    resume_base64.length > Math.ceil(MAX_RESUME_BYTES / 3) * 4 ||
    resume_base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(resume_base64)
  ) {
    return json({ error: "invalid_input" }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const upstreamHeaders = new Headers({ "content-type": "application/json" });
    // Cloudflare same-zone subrequests derive CF-Connecting-IP from x-real-ip.
    // Use only Cloudflare's incoming client-IP header, never a caller's x-real-ip.
    const visitorIp = request.headers.get("cf-connecting-ip");
    if (visitorIp) upstreamHeaders.set("x-real-ip", visitorIp);
    const upstream = await fetch(`${readmeBackendOrigin()}/readme/analyze`, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify({
        job_text,
        resume_filename,
        resume_media_type,
        resume_base64,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!upstream.ok) {
      const upstreamBody: unknown = await upstream.json().catch(() => null);
      const upstreamCode = isRecord(upstreamBody) ? upstreamBody.error : null;
      const knownCodes = new Set([
        "invalid_file",
        "invalid_filename",
        "unsupported_file",
        "invalid_media_type",
        "invalid_text_encoding",
        "invalid_pdf",
        "invalid_docx",
        "docx_too_large",
        "docx_too_complex",
        "unreadable_pdf",
        "unreadable_docx",
        "text_too_short",
        "text_too_long",
        "too_many_units",
        "rate_limited",
        "analysis_busy",
        "analysis_timeout",
        "analysis_resource_limit",
        "analysis_unavailable",
      ]);
      const fallback =
        upstream.status === 413
          ? "too_large"
          : upstream.status === 415
            ? "unsupported_file"
            : upstream.status === 422
              ? "unreadable_document"
              : upstream.status === 429
                ? "busy"
                : "analyze_unavailable";
      const backendError =
        typeof upstreamCode === "string" && knownCodes.has(upstreamCode)
          ? upstreamCode
          : fallback;
      const error =
        backendError === "text_too_short" &&
        resume_media_type === "application/pdf"
          ? "pdf_text_missing"
          : backendError;
      return json(
        { error },
        upstream.status === 429
          ? 429
          : upstream.status >= 500
            ? 502
            : upstream.status,
      );
    }
    const result: unknown = await upstream.json();
    if (!isReadmePreview(result, USER_CASE_ID)) {
      return json({ error: "invalid_backend_response" }, 502);
    }
    return json(result, 200);
  } catch {
    return json({ error: "analyze_unavailable" }, 504);
  } finally {
    clearTimeout(timeout);
  }
}
