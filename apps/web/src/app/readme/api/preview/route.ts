import {
  README_CASE_ID,
  isReadmePreview,
  syntheticPreview,
} from "@/shared/readme/preview";
import { readmeBackendOrigin } from "@/shared/readme/backend-origin";

const MAX_BODY_BYTES = 512;

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

function json(body: unknown, status: number, source: "backend" | "fixture") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-readme-source": source,
    },
  });
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "json_required" }, 415, "fixture");
  }
  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "too_large";
    return json(
      { error: tooLarge ? "too_large" : "invalid_json" },
      tooLarge ? 413 : 400,
      "fixture",
    );
  }
  if (
    !body ||
    typeof body !== "object" ||
    (body as { case_id?: unknown }).case_id !== README_CASE_ID ||
    Object.keys(body).length !== 1
  ) {
    return json({ error: "synthetic_case_only" }, 400, "fixture");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2200);
  try {
    const upstream = await fetch(`${readmeBackendOrigin()}/readme/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ case_id: README_CASE_ID }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (upstream.ok) {
      const preview: unknown = await upstream.json();
      if (isReadmePreview(preview, README_CASE_ID))
        return json(preview, 200, "backend");
    }
  } catch {
    // The public synthetic demonstration remains usable without the Mac mini.
  } finally {
    clearTimeout(timeout);
  }
  return json(syntheticPreview, 200, "fixture");
}
