import { isOpsAuthorized } from "../../../../../worker/ops-access";

const MAX_SOURCE_BYTES = 512 * 1024;
const OPS_PROXY_TIMEOUT_MS = 8_000;
const ALLOWED_BLOCK_TYPES = new Set([
  "PARAGRAPH",
  "HEADING",
  "CODE",
  "IMAGE",
  "CALLOUT",
  "QUIZ",
]);

type RuntimeEnv = {
  NODE_ENV?: string;
  SEOJING_BACKEND_API_ORIGIN?: string;
  SEOJING_BACKEND_ARTICLE_API_ORIGIN?: string;
  SEOJING_BACKEND_ADMIN_API_TOKEN?: string;
  ADMIN_API_TOKEN?: string;
  SEOJING_OPS_ACCESS_EMAIL?: string;
  SEOJING_OPS_ACCESS_ISSUER?: string;
  SEOJING_OPS_ACCESS_AUD?: string;
  VITE_SEOJING_BACKEND_API_ORIGIN?: string;
};

type AdminArticleBlock = {
  id?: string;
  type?: string;
  sortOrder?: number;
  content?: Record<string, unknown>;
  plainText?: string | null;
  metadata?: Record<string, unknown> | null;
};

type AdminArticlePayload = {
  article?: {
    slug?: string;
    title?: string;
    description?: string | null;
    category?: string;
    status?: string;
    sourceFormat?: string;
    sourceText?: string;
    renderedHtml?: string | null;
    blocks?: AdminArticleBlock[];
    currentRevisionNumber?: number | null;
    editingRevisionNumber?: number | null;
    hasUnpublishedChanges?: boolean;
    revisions?: Array<{
      revisionNumber: number;
      changeSummary?: string | null;
      createdAt: string;
      isPublished: boolean;
    }>;
    publishedAt?: string | null;
    updatedAt?: string;
  };
  editor?: {
    mode?: string;
    autosaveTarget?: string;
    publishTarget?: string;
  };
};

type PublicArticlePayload = {
  slug?: string;
  title?: string;
  description?: string | null;
  updatedAt?: string;
  publishedAt?: string | null;
  body?: { html?: string };
};

export async function GET(request: Request): Promise<Response> {
  const access = await verifyOpsAccess(request);
  if (!access.ok) return jsonResponse(access.status, access.body);

  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) {
    const config = readBackendConfig();
    if (!config.ok) return jsonResponse(config.status, config.body);
    const queue = await fetchBackendJson<{ articles: unknown[] }>(
      config.origin,
      "/admin/article-review-queue",
      { method: "GET", adminToken: config.adminToken },
    );
    if (!queue.ok) {
      return jsonResponse(queue.status, {
        ok: false,
        error: "backend_review_queue_read_failed",
      });
    }
    return jsonResponse(200, { ok: true, articles: queue.data.articles });
  }

  const config = readBackendConfig();
  if (!config.ok) return jsonResponse(config.status, config.body);

  const [editor, publicReadback] = await Promise.all([
    fetchBackendJson<AdminArticlePayload>(
      config.origin,
      `/admin/articles/${encodeURIComponent(slug)}/editor`,
      {
        method: "GET",
        adminToken: config.adminToken,
      },
    ),
    fetchBackendJson<PublicArticlePayload>(
      config.origin,
      `/articles/${encodeURIComponent(slug)}`,
      { method: "GET" },
    ),
  ]);

  if (!editor.ok) {
    return jsonResponse(editor.status, {
      ok: false,
      error: "backend_editor_read_failed",
      status: editor.status,
    });
  }

  return jsonResponse(200, {
    ok: true,
    article: editor.data.article,
    editor: editor.data.editor,
    publicReadback: publicReadback.ok
      ? {
          status: publicReadback.status,
          title: publicReadback.data.title,
          updatedAt: publicReadback.data.updatedAt,
          publishedAt: publicReadback.data.publishedAt,
          htmlLength: publicReadback.data.body?.html?.length ?? 0,
          html: publicReadback.data.body?.html ?? "",
        }
      : { status: publicReadback.status, missing: true },
  });
}

export async function POST(request: Request): Promise<Response> {
  const access = await verifyOpsAccess(request);
  if (!access.ok) return jsonResponse(access.status, access.body);

  let body: unknown;
  try {
    body = await readJsonBody(request, MAX_SOURCE_BYTES);
  } catch {
    return jsonResponse(400, { ok: false, error: "invalid_json" });
  }

  const action = readString(body, "action");
  const slug = readString(body, "slug");
  if (!slug) return jsonResponse(400, { ok: false, error: "slug_required" });

  const config = readBackendConfig();
  if (!config.ok) return jsonResponse(config.status, config.body);

  if (action === "createBlocks") {
    const title = readString(body, "title");
    const blocks = readBlocks(body);
    if (!title || blocks.length === 0) {
      return jsonResponse(400, {
        ok: false,
        error: "title_and_blocks_required",
      });
    }
    if (!hasAllowedBlockTypes(blocks)) {
      return jsonResponse(400, { ok: false, error: "invalid_block_type" });
    }
    const created = await fetchBackendJson<AdminArticlePayload>(
      config.origin,
      "/admin/articles/blocks",
      {
        method: "POST",
        adminToken: config.adminToken,
        body: JSON.stringify({
          slug,
          title,
          description: readString(body, "description") || undefined,
          category: readString(body, "category") || undefined,
          blocks,
          changeSummary: "SEOJing CMS native draft",
          authorName: "SEOJing Ops",
        }),
      },
    );
    if (!created.ok) {
      return jsonResponse(created.status, {
        ok: false,
        error: "backend_block_draft_create_failed",
        status: created.status,
      });
    }
    return jsonResponse(201, {
      ok: true,
      action,
      article: created.data.article,
    });
  }

  if (action === "saveBlocks") {
    const blocks = readBlocks(body);
    if (blocks.length === 0) {
      return jsonResponse(400, { ok: false, error: "blocks_required" });
    }
    if (!hasAllowedBlockTypes(blocks)) {
      return jsonResponse(400, { ok: false, error: "invalid_block_type" });
    }
    const saved = await fetchBackendJson<AdminArticlePayload>(
      config.origin,
      `/admin/articles/${encodeURIComponent(slug)}/blocks`,
      {
        method: "PUT",
        adminToken: config.adminToken,
        body: JSON.stringify({
          title: readString(body, "title") || undefined,
          description: readString(body, "description") || undefined,
          category: readString(body, "category") || undefined,
          blocks,
          changeSummary: "SEOJing CMS block revision",
          authorName: "SEOJing Ops",
        }),
      },
    );
    if (!saved.ok) {
      return jsonResponse(saved.status, {
        ok: false,
        error: "backend_block_revision_save_failed",
        status: saved.status,
      });
    }
    return jsonResponse(200, { ok: true, action, article: saved.data.article });
  }

  if (action === "saveRevision") {
    const sourceText = readString(body, "sourceText");
    if (!sourceText) {
      return jsonResponse(400, { ok: false, error: "source_text_required" });
    }
    const saved = await fetchBackendJson<AdminArticlePayload>(
      config.origin,
      `/admin/articles/${encodeURIComponent(slug)}/revisions`,
      {
        method: "PUT",
        adminToken: config.adminToken,
        body: JSON.stringify({
          title: readString(body, "title") || undefined,
          description: readString(body, "description") || undefined,
          category: readString(body, "category") || undefined,
          sourceText,
          changeSummary:
            readString(body, "changeSummary") || "SEOJing /ops article edit",
          authorName: "SEOJing Ops",
        }),
      },
    );
    if (!saved.ok) {
      return jsonResponse(saved.status, {
        ok: false,
        error: "backend_revision_save_failed",
        status: saved.status,
      });
    }
    return jsonResponse(200, { ok: true, action, article: saved.data.article });
  }

  if (action === "restoreRevision") {
    const revisionNumber = readNumber(body, "revisionNumber");
    if (!Number.isInteger(revisionNumber) || revisionNumber < 1) {
      return jsonResponse(400, { ok: false, error: "invalid_revision_number" });
    }
    const restored = await fetchBackendJson<AdminArticlePayload>(
      config.origin,
      `/admin/articles/${encodeURIComponent(slug)}/revisions/${revisionNumber}/restore`,
      { method: "POST", adminToken: config.adminToken },
    );
    if (!restored.ok) {
      return jsonResponse(restored.status, {
        ok: false,
        error: "backend_revision_restore_failed",
        status: restored.status,
      });
    }
    return jsonResponse(201, {
      ok: true,
      action,
      article: restored.data.article,
    });
  }

  if (action === "publish") {
    const published = await fetchBackendJson<AdminArticlePayload>(
      config.origin,
      `/admin/articles/${encodeURIComponent(slug)}/publish`,
      {
        method: "POST",
        adminToken: config.adminToken,
      },
    );
    if (!published.ok) {
      return jsonResponse(published.status, {
        ok: false,
        error: "backend_publish_failed",
        status: published.status,
      });
    }
    return jsonResponse(200, {
      ok: true,
      action,
      article: published.data.article,
    });
  }

  const visibilityAction =
    action === "unpublish" || action === "archive" ? action : null;
  if (visibilityAction) {
    const updated = await fetchBackendJson<AdminArticlePayload>(
      config.origin,
      `/admin/articles/${encodeURIComponent(slug)}/${visibilityAction}`,
      { method: "POST", adminToken: config.adminToken },
    );
    if (!updated.ok) {
      return jsonResponse(updated.status, {
        ok: false,
        error: `backend_${visibilityAction}_failed`,
        status: updated.status,
      });
    }
    return jsonResponse(200, {
      ok: true,
      action,
      article: updated.data.article,
    });
  }

  if (action === "delete") {
    const deleted = await fetchBackendJson<Record<string, never>>(
      config.origin,
      `/admin/articles/${encodeURIComponent(slug)}`,
      { method: "DELETE", adminToken: config.adminToken },
    );
    if (!deleted.ok) {
      return jsonResponse(deleted.status, {
        ok: false,
        error: "backend_delete_failed",
        status: deleted.status,
      });
    }
    return jsonResponse(200, { ok: true, action });
  }

  return jsonResponse(400, { ok: false, error: "unsupported_action" });
}

export function PUT(): Response {
  return methodNotAllowed();
}

export const PATCH = PUT;
export const DELETE = PUT;
export const OPTIONS = PUT;

type AccessResult =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> };

async function verifyOpsAccess(request: Request): Promise<AccessResult> {
  const env = readRuntimeEnv();
  const allowedEmail = env.SEOJING_OPS_ACCESS_EMAIL?.trim().toLowerCase();
  const hostname = new URL(request.url).hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  if (env.NODE_ENV !== "production" && isLocalhost && !allowedEmail) {
    return { ok: true };
  }
  if (
    !allowedEmail ||
    !env.SEOJING_OPS_ACCESS_ISSUER ||
    !env.SEOJING_OPS_ACCESS_AUD
  ) {
    return {
      ok: false,
      status: 403,
      body: { ok: false, error: "ops_access_not_configured" },
    };
  }
  if (
    await isOpsAuthorized(request, {
      SEOJING_OPS_ACCESS_EMAIL: allowedEmail,
      SEOJING_OPS_ACCESS_ISSUER: env.SEOJING_OPS_ACCESS_ISSUER,
      SEOJING_OPS_ACCESS_AUD: env.SEOJING_OPS_ACCESS_AUD,
    })
  ) {
    return { ok: true };
  }
  return {
    ok: false,
    status: 401,
    body: { ok: false, error: "unauthorized_ops_request" },
  };
}

type BackendConfig =
  | { ok: true; origin: string; adminToken: string }
  | { ok: false; status: number; body: Record<string, unknown> };

function readBackendConfig(): BackendConfig {
  const env = readRuntimeEnv();
  const origin =
    env.SEOJING_BACKEND_API_ORIGIN ??
    env.SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    env.VITE_SEOJING_BACKEND_API_ORIGIN;
  const adminToken = env.SEOJING_BACKEND_ADMIN_API_TOKEN ?? env.ADMIN_API_TOKEN;

  if (!origin?.trim()) {
    return {
      ok: false,
      status: 503,
      body: { ok: false, error: "backend_origin_not_configured" },
    };
  }
  if (!adminToken?.trim()) {
    return {
      ok: false,
      status: 503,
      body: { ok: false, error: "backend_admin_token_not_configured" },
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
    (
      import.meta as unknown as {
        env?: Partial<RuntimeEnv>;
      }
    ).env ?? {};
  const processEnv = typeof process === "undefined" ? undefined : process.env;
  return {
    ...runtimeEnv,
    ...processEnv,
  };
}

type BackendFetchOptions = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  adminToken?: string;
  body?: string;
};

type BackendFetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number };

async function fetchBackendJson<T>(
  origin: string,
  path: string,
  options: BackendFetchOptions,
): Promise<BackendFetchResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPS_PROXY_TIMEOUT_MS);
  try {
    const response = await fetch(`${origin}${path}`, {
      method: options.method,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.adminToken
          ? { authorization: `Bearer ${options.adminToken}` }
          : {}),
      },
      body: options.body,
    });
    if (response.status === 204) {
      return { ok: true, status: response.status, data: {} as T };
    }
    if (!response.ok) return { ok: false, status: response.status };
    return {
      ok: true,
      status: response.status,
      data: (await response.json()) as T,
    };
  } catch {
    return { ok: false, status: 503 };
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error("payload too large");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new Error("payload too large");
  }
  return text.trim() ? JSON.parse(text) : {};
}

function readString(body: unknown, key: string): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(body: unknown, key: string): number {
  if (!body || typeof body !== "object" || Array.isArray(body)) return NaN;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" ? value : NaN;
}

function readBlocks(body: unknown): AdminArticleBlock[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const value = (body as Record<string, unknown>).blocks;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (block): block is AdminArticleBlock =>
      Boolean(block) && typeof block === "object" && !Array.isArray(block),
  );
}

function hasAllowedBlockTypes(blocks: AdminArticleBlock[]): boolean {
  return blocks.every(
    (block) =>
      typeof block.type === "string" && ALLOWED_BLOCK_TYPES.has(block.type),
  );
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

function methodNotAllowed(): Response {
  return jsonResponse(405, { ok: false, error: "method_not_allowed" });
}
