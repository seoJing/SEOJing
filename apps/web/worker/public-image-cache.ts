import { publicPageCacheKey } from "./public-page-cache";

const IMAGE_CACHE_CONTROL = "public, max-age=300, s-maxage=604800";

export async function serveOptimizedImageWithCache(
  request: Request,
  workerVersion: string,
  ctx: ExecutionContext,
  optimize: () => Promise<Response>,
  cache?: Cache,
): Promise<Response> {
  if (request.method !== "GET" || !workerVersion) return optimize();

  let store: Cache;
  try {
    store = cache ?? (await caches.open("seojing-optimized-images-v1"));
  } catch {
    return optimize();
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

  const response = await optimize();
  if (
    response.status === 200 &&
    response.headers.get("content-type")?.startsWith("image/") &&
    !response.headers.has("set-cookie")
  ) {
    const stored = new Response(response.clone().body, response);
    stored.headers.set("cache-control", IMAGE_CACHE_CONTROL);
    ctx.waitUntil(store.put(key, stored).catch(() => undefined));
  }
  const result = new Response(response.body, response);
  if (response.status === 200) {
    result.headers.set("cache-control", IMAGE_CACHE_CONTROL);
  }
  result.headers.set("x-seojing-image-cache", "MISS");
  return result;
}
