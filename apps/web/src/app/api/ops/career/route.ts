const MAX_BODY_BYTES = 256 * 1024;
const OPS_PROXY_TIMEOUT_MS = 8_000;
const ACCESS_CERT_CACHE_MS = 5 * 60 * 1_000;

interface AccessJwtPayload {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iss?: string;
  nbf?: number;
}

interface AccessJwk extends JsonWebKey {
  kid?: string;
}

interface CachedAccessKeys {
  expiresAt: number;
  keys: AccessJwk[];
}

const accessKeyCache = new Map<string, CachedAccessKeys>();

type RuntimeEnv = {
  NODE_ENV?: string;
  SEOJING_BACKEND_API_ORIGIN?: string;
  SEOJING_BACKEND_ARTICLE_API_ORIGIN?: string;
  SEOJING_BACKEND_ADMIN_API_TOKEN?: string;
  ADMIN_API_TOKEN?: string;
  SEOJING_OPS_ACCESS_AUD?: string;
  SEOJING_OPS_ACCESS_EMAIL?: string;
  SEOJING_OPS_ACCESS_ISSUER?: string;
  VITE_SEOJING_BACKEND_API_ORIGIN?: string;
};

export async function GET(request: Request): Promise<Response> {
  const access = await verifyOpsAccess(request);
  if (!access.ok) return jsonResponse(access.status, access.body);
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) return jsonResponse(400, { ok: false, error: "slug_required" });

  return proxyAdminRequest(
    `/admin/career/opportunities/${encodeURIComponent(slug)}`,
    "GET",
  );
}

export async function PUT(request: Request): Promise<Response> {
  const access = await verifyOpsAccess(request);
  if (!access.ok) return jsonResponse(access.status, access.body);

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse(400, { ok: false, error: "invalid_json" });
  }
  if (!isRecord(body) || typeof body.slug !== "string" || !body.slug.trim()) {
    return jsonResponse(400, { ok: false, error: "slug_required" });
  }

  const document = body.document;
  if (!isRecord(document) || !isRecord(document.aggregate)) {
    return jsonResponse(400, { ok: false, error: "aggregate_required" });
  }
  const opportunity = document.aggregate.opportunity;
  if (!isRecord(opportunity) || opportunity.slug !== body.slug.trim()) {
    return jsonResponse(400, { ok: false, error: "slug_mismatch" });
  }
  return proxyAdminRequest(
    `/admin/career/opportunities/${encodeURIComponent(body.slug.trim())}`,
    "PUT",
    JSON.stringify(document),
  );
}

export async function POST(request: Request): Promise<Response> {
  const access = await verifyOpsAccess(request);
  if (!access.ok) return jsonResponse(access.status, access.body);

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse(400, { ok: false, error: "invalid_json" });
  }
  if (!isRecord(body) || typeof body.slug !== "string" || !body.slug.trim()) {
    return jsonResponse(400, { ok: false, error: "slug_required" });
  }
  if (body.action === "create") {
    const document = body.document;
    if (!isRecord(document) || !isRecord(document.aggregate)) {
      return jsonResponse(400, { ok: false, error: "aggregate_required" });
    }
    const opportunity = document.aggregate.opportunity;
    if (!isRecord(opportunity) || opportunity.slug !== body.slug.trim()) {
      return jsonResponse(400, { ok: false, error: "slug_mismatch" });
    }
    return proxyAdminRequest(
      "/admin/career/opportunities",
      "POST",
      JSON.stringify(document),
    );
  }
  if (body.action === "publish") {
    return proxyAdminRequest(
      `/admin/career/opportunities/${encodeURIComponent(body.slug.trim())}/publish`,
      "POST",
    );
  }
  return jsonResponse(400, { ok: false, error: "unsupported_action" });
}

export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;

async function proxyAdminRequest(
  path: string,
  method: "GET" | "PUT" | "POST",
  body?: string,
): Promise<Response> {
  const config = readBackendConfig();
  if (!config.ok) return jsonResponse(config.status, config.body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPS_PROXY_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.origin}${path}`, {
      method,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.adminToken}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body,
    });
    const text = await response.text();
    return new Response(text || JSON.stringify({ ok: response.ok }), {
      status: response.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return jsonResponse(503, { ok: false, error: "backend_unavailable" });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyOpsAccess(
  request: Request,
): Promise<
  { ok: true } | { ok: false; status: number; body: Record<string, unknown> }
> {
  const env = readRuntimeEnv();
  const allowedEmail = env.SEOJING_OPS_ACCESS_EMAIL?.trim().toLowerCase();
  const hostname = new URL(request.url).hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isLocalDevelopment = env.NODE_ENV !== "production" && isLocalhost;

  if (isLocalDevelopment) {
    if (!allowedEmail) return { ok: true };
    const localEmail = request.headers
      .get("x-authenticated-user-email")
      ?.trim()
      .toLowerCase();
    if (localEmail === allowedEmail) return { ok: true };
    return unauthorizedOpsResponse();
  }

  const issuer = env.SEOJING_OPS_ACCESS_ISSUER?.trim().replace(/\/+$/, "");
  const audience = env.SEOJING_OPS_ACCESS_AUD?.trim();
  if (!allowedEmail || !issuer || !audience) {
    return {
      ok: false,
      status: 403,
      body: { ok: false, error: "ops_access_not_configured" },
    };
  }

  const assertion = request.headers.get("cf-access-jwt-assertion")?.trim();
  if (!assertion) return unauthorizedOpsResponse();

  try {
    const payload = await verifyAccessJwt(assertion, issuer, audience);
    if (payload.email?.trim().toLowerCase() === allowedEmail) {
      return { ok: true };
    }
  } catch {
    // Fail closed without exposing token verification details.
  }
  return unauthorizedOpsResponse();
}

function unauthorizedOpsResponse() {
  return {
    ok: false as const,
    status: 401,
    body: { ok: false, error: "unauthorized_ops_request" },
  };
}

async function verifyAccessJwt(
  token: string,
  issuer: string,
  audience: string,
): Promise<AccessJwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid token");
  const encodedHeader = parts[0]!;
  const encodedPayload = parts[1]!;
  const encodedSignature = parts[2]!;
  const header = parseJwtPart(encodedHeader) as { alg?: string; kid?: string };
  const payload = parseJwtPart(encodedPayload) as AccessJwtPayload;
  if (header.alg !== "RS256" || !header.kid) throw new Error("invalid header");

  let keys = await getAccessKeys(issuer);
  let jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    keys = await getAccessKeys(issuer, true);
    jwk = keys.find((candidate) => candidate.kid === header.kid);
  }
  if (!jwk) throw new Error("unknown key");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!verified) throw new Error("invalid signature");

  const now = Math.floor(Date.now() / 1_000);
  const tokenAudience = Array.isArray(payload.aud)
    ? payload.aud
    : payload.aud
      ? [payload.aud]
      : [];
  if (payload.iss?.replace(/\/+$/, "") !== issuer) {
    throw new Error("invalid issuer");
  }
  if (!tokenAudience.includes(audience)) throw new Error("invalid audience");
  if (typeof payload.exp !== "number" || payload.exp <= now - 30) {
    throw new Error("expired token");
  }
  if (typeof payload.nbf === "number" && payload.nbf > now + 30) {
    throw new Error("inactive token");
  }
  return payload;
}

async function getAccessKeys(
  issuer: string,
  forceRefresh = false,
): Promise<AccessJwk[]> {
  const cached = accessKeyCache.get(issuer);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("Access keys unavailable");
  const body = (await response.json()) as unknown;
  if (!isRecord(body) || !Array.isArray(body.keys)) {
    throw new Error("Invalid Access keys response");
  }
  const keys = body.keys.filter(isRecord) as AccessJwk[];
  accessKeyCache.set(issuer, {
    expiresAt: Date.now() + ACCESS_CERT_CACHE_MS,
    keys,
  });
  return keys;
}

function parseJwtPart(value: string): Record<string, unknown> {
  const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  if (!isRecord(parsed)) throw new Error("invalid token payload");
  return parsed;
}

function decodeBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
    .buffer as ArrayBuffer;
}

function readBackendConfig():
  | { ok: true; origin: string; adminToken: string }
  | { ok: false; status: number; body: Record<string, unknown> } {
  const env = readRuntimeEnv();
  const origin =
    env.SEOJING_BACKEND_API_ORIGIN ??
    env.SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    env.VITE_SEOJING_BACKEND_API_ORIGIN;
  const adminToken = env.SEOJING_BACKEND_ADMIN_API_TOKEN ?? env.ADMIN_API_TOKEN;
  if (!origin?.trim() || !adminToken?.trim()) {
    return {
      ok: false,
      status: 503,
      body: { ok: false, error: "backend_admin_not_configured" },
    };
  }
  return {
    ok: true,
    origin: origin.trim().replace(/\/+$/, ""),
    adminToken: adminToken.trim(),
  };
}

function readRuntimeEnv(): Partial<RuntimeEnv> {
  const runtimeEnv =
    (import.meta as unknown as { env?: Partial<RuntimeEnv> }).env ?? {};
  const processEnv = typeof process === "undefined" ? undefined : process.env;
  return { ...runtimeEnv, ...processEnv };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new Error("payload too large");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new Error("payload too large");
  }
  return text.trim() ? JSON.parse(text) : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function methodNotAllowed(): Response {
  return jsonResponse(405, { ok: false, error: "method_not_allowed" });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}
