const PROXY_TIMEOUT_MS = 2500;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function normalizeRequestId(request: Request): string {
  const requestId = request.headers.get("x-request-id");
  if (requestId && REQUEST_ID_PATTERN.test(requestId)) return requestId;
  return crypto.randomUUID();
}

function jsonResponse(
  status: number,
  body: unknown,
  requestId: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "x-request-id": requestId,
    },
  });
}

function optionsResponse(requestId: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type,x-request-id",
      "cache-control": "private, no-store",
      "x-request-id": requestId,
    },
  });
}

async function handler(request: Request) {
  const requestId = normalizeRequestId(request);

  if (request.method === "OPTIONS") return optionsResponse(requestId);

  if (request.method !== "POST") {
    return jsonResponse(
      404,
      { ok: false, error: "not_found", request_id: requestId },
      requestId,
    );
  }

  const collectUrl = process.env.SEOJING_ANALYTICS_COLLECT_URL;
  if (!collectUrl) {
    return jsonResponse(
      202,
      {
        ok: true,
        accepted: 0,
        rejected: 0,
        request_id: requestId,
        disabled: true,
      },
      requestId,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const body = await request.text();
    const response = await fetch(collectUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type":
          request.headers.get("content-type") ?? "application/json",
        "x-request-id": requestId,
        ...(request.headers.get("origin")
          ? { origin: request.headers.get("origin") as string }
          : {}),
      },
      body,
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ??
          "application/json; charset=utf-8",
        "cache-control": "private, no-store",
        "x-request-id": response.headers.get("x-request-id") ?? requestId,
      },
    });
  } catch {
    return jsonResponse(
      202,
      {
        ok: true,
        accepted: 0,
        rejected: 0,
        request_id: requestId,
        proxy_error: true,
      },
      requestId,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = handler;
export const GET = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
