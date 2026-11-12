import { publicPageCacheKey } from "./public-page-cache";

const IMAGE_CACHE_CONTROL = "public, max-age=300, s-maxage=604800";
const FALLBACK_CACHE_CONTROL = "public, max-age=60, s-maxage=60";

export interface ImageOptimizationResult {
  response: Response;
  transformed: boolean;
}

function isCacheableImage({
  response,
  transformed,
}: ImageOptimizationResult): boolean {
  return (
    transformed &&
    response.status === 200 &&
    Boolean(response.headers.get("content-type")?.startsWith("image/")) &&
    !response.headers.has("set-cookie")
  );
}

function returnImage(
  optimized: ImageOptimizationResult,
  cacheStatus: "MISS" | "BYPASS",
): Response {
  const result = new Response(optimized.response.body, optimized.response);
  if (result.status === 200) {
    result.headers.set(
      "cache-control",
      isCacheableImage(optimized)
        ? IMAGE_CACHE_CONTROL
        : FALLBACK_CACHE_CONTROL,
    );
  }
  result.headers.set("x-seojing-image-cache", cacheStatus);
  return result;
}

export async function serveOptimizedImageWithCache(
  request: Request,
  workerVersion: string,
  ctx: ExecutionContext,
  optimize: () => Promise<ImageOptimizationResult>,
  cache?: Cache,
): Promise<Response> {
  if (request.method !== "GET" || !workerVersion)
    return returnImage(await optimize(), "BYPASS");

  let store: Cache;
  try {
    store = cache ?? (await caches.open("seojing-optimized-images-v1"));
  } catch {
    return returnImage(await optimize(), "BYPASS");
  }
  const key = await publicPageCacheKey(request, workerVersion, ["accept"]);
  try {
    const hit = await store.match(key);
    if (hit) {
      const response = new Response(hit.body, hit);
      response.headers.set("cache-control", IMAGE_CACHE_CONTROL);
      response.headers.set("x-seojing-image-cache", "HIT");
      return response;
    }
  } catch {
    // Optimization still works when the cache is unavailable.
  }

  const optimized = await optimize();
  const { response } = optimized;
  const cacheable = isCacheableImage(optimized);
  if (cacheable) {
    const stored = new Response(response.clone().body, response);
    stored.headers.set("cache-control", IMAGE_CACHE_CONTROL);
    ctx.waitUntil(store.put(key, stored).catch(() => undefined));
  }
  return returnImage(optimized, cacheable ? "MISS" : "BYPASS");
}
