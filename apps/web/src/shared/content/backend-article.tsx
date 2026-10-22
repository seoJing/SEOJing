import { env as cloudflareEnv } from "cloudflare:workers";
import {
  toBackendArticleContentData,
  type BackendArticleApiResponse,
  type BackendArticleContentData,
} from "./article-adapter";
export {
  toBackendArticleContentData,
  documentPlainText,
  type BackendArticleApiResponse,
  type BackendArticleContentData,
} from "./article-adapter";

export type BackendArticleLoadResult<T> =
  | { status: "found"; data: T }
  | { status: "not-found" }
  | { status: "unavailable" }
  | { status: "rejected"; httpStatus: number };

export async function loadBackendArticleContent(
  slug: string,
  signal?: AbortSignal,
): Promise<BackendArticleContentData | null> {
  const result = await loadBackendArticleContentResult(slug, signal);
  return result.status === "found" ? result.data : null;
}

// Keep failure semantics available to outage-aware loaders, while existing
// callers of loadBackendArticleContent/fetchBackendArticle still receive null.
export async function loadBackendArticleContentResult(
  slug: string,
  signal?: AbortSignal,
): Promise<BackendArticleLoadResult<BackendArticleContentData>> {
  const origin = readBackendArticleApiOrigin();
  if (!origin) {
    return { status: "unavailable" };
  }

  const result = await fetchBackendArticleResult(origin, slug, signal);
  if (result.status !== "found") {
    return result;
  }

  return { status: "found", data: toBackendArticleContentData(result.data) };
}

export async function fetchBackendArticle(
  origin: string,
  slug: string,
  signal?: AbortSignal,
): Promise<BackendArticleApiResponse | null> {
  const result = await fetchBackendArticleResult(origin, slug, signal);
  return result.status === "found" ? result.data : null;
}

async function fetchBackendArticleResult(
  origin: string,
  slug: string,
  signal?: AbortSignal,
): Promise<BackendArticleLoadResult<BackendArticleApiResponse>> {
  try {
    const articleUrl = new URL(
      `/articles/${encodeURIComponent(slug)}`,
      normalizeOrigin(origin),
    );
    const response = await fetch(articleUrl, {
      headers: { Accept: "application/json" },
      signal,
    });

    if (response.status === 404) {
      return { status: "not-found" };
    }
    if (!response.ok) {
      if (response.status < 500) {
        return { status: "rejected", httpStatus: response.status };
      }
      throw new Error(
        `Backend article API returned ${response.status} for ${slug}`,
      );
    }

    // Await body consumption here so stream aborts and JSON errors become
    // unavailable results just like transport failures before headers arrive.
    const data = (await response.json()) as BackendArticleApiResponse;
    return { status: "found", data };
  } catch (error) {
    console.error("Failed to load backend article", { slug, error });
    return { status: "unavailable" };
  }
}

function readBackendArticleApiOrigin(): string | null {
  const runtimeEnv = cloudflareEnv as Partial<{
    SEOJING_BACKEND_ARTICLE_API_ORIGIN: string;
    SEOJING_BACKEND_API_ORIGIN: string;
  }>;
  const origin =
    process.env.SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    process.env.SEOJING_BACKEND_API_ORIGIN ??
    runtimeEnv.SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    runtimeEnv.SEOJING_BACKEND_API_ORIGIN;
  return origin?.trim() || null;
}

function normalizeOrigin(origin: string): string {
  return origin.endsWith("/") ? origin : `${origin}/`;
}
