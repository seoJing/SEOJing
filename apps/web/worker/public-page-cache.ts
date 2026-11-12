const CACHE_TTL_SECONDS = 600;
const CACHE_VARIANT_HEADERS = [
  "accept",
  "rsc",
  "next-url",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "x-vinext-interception-context",
  "x-vinext-mounted-slots",
  "x-vinext-rsc-render-mode",
] as const;

function isBlogPath(pathname: string): boolean {
  return pathname === "/blog" || pathname.startsWith("/blog/");
}

export function isPublicPageCacheRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  if (
    request.headers.has("authorization") ||
    request.headers.has("cookie") ||
    request.headers.has("range") ||
    request.headers.has("next-action")
  ) {
    return false;
  }

  const url = new URL(request.url);
  if (
    !isBlogPath(url.pathname) &&
    url.pathname !== "/" &&
    url.pathname !== "/portfolio" &&
    url.pathname !== "/skills"
  ) {
    return false;
  }
  // These pages have no server-side query state. Only vinext's RSC variant
  // parameter is expected; arbitrary queries are not cached.
  return [...url.searchParams.keys()].every((key) => key === "_rsc");
}

export async function publicPageCacheKey(
  request: Request,
  revision: string,
  variantHeaders: readonly string[] = CACHE_VARIANT_HEADERS,
): Promise<Request> {
  const url = new URL(request.url);
  const variant = [
    url.search,
    ...variantHeaders.map(
      (name) => `${name}:${request.headers.get(name) ?? ""}`,
    ),
  ].join("\n");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(variant),
  );
  const variantHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  // Keep revision and variant in the path so zone rules that normalize or
  // discard query strings cannot accidentally collapse distinct snapshots.
  url.pathname = `/__seojing_public_cache/v1/${encodeURIComponent(revision)}/${variantHash}${url.pathname}`;
  url.search = "";
  return new Request(url.toString());
}

function isCacheableResponse(response: Response, request: Request): boolean {
  if (response.status !== 200 || response.headers.has("set-cookie"))
    return false;
  const control = response.headers.get("cache-control") ?? "";
  if (/\b(private|no-store)\b/i.test(control)) return false;
  if (response.headers.get("vary")?.trim() === "*") return false;
  const type = response.headers.get("content-type") ?? "";
  return request.headers.get("rsc") === "1"
    ? type.startsWith("text/x-component")
    : type.startsWith("text/html");
}

export async function servePublicPageWithCache(
  request: Request,
  db: D1Database,
  workerVersion: string,
  ctx: ExecutionContext,
  render: () => Promise<Response>,
  cache?: Cache,
): Promise<Response> {
  if (!isPublicPageCacheRequest(request) || !workerVersion) return render();

  let revision = workerVersion;
  if (isBlogPath(new URL(request.url).pathname)) {
    try {
      const row = await db
        .prepare(
          "SELECT revision FROM public_content_revision WHERE singleton = 1",
        )
        .first<{ revision: number }>();
      if (!row || !Number.isSafeInteger(row.revision)) return render();
      revision += `-${row.revision}`;
    } catch {
      // The migration may not have been applied yet. Fail open to rendering,
      // never to serving potentially stale or unpublished content.
      return render();
    }
  }

  // An article can temporarily still resolve via the backend fallback after
  // its D1 snapshot was removed for unpublication. Never cache that 200 under
  // the new revision. A folder is safe when D1 has published descendants.
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith("/blog/")) {
    try {
      const slug = decodeURIComponent(pathname.slice("/blog/".length));
      const visible = await db
        .prepare(
          "SELECT 1 FROM public_articles WHERE slug = ? OR instr(slug, ? || '/') = 1 LIMIT 1",
        )
        .bind(slug, slug)
        .first();
      if (!visible) return render();
    } catch {
      return render();
    }
  }

  // `_rsc` is a transport cache buster, not page state. The RSC/router headers
  // remain in the key; normalizing its value prevents unbounded cold renders.
  const keyUrl = new URL(request.url);
  keyUrl.search = "";
  const cacheKey = await publicPageCacheKey(
    new Request(keyUrl, request),
    revision,
  );
  let store: Cache;
  try {
    store = cache ?? (await caches.open("seojing-public-pages-v1"));
  } catch {
    return render();
  }
  try {
    const hit = await store.match(cacheKey);
    if (hit) {
      const response = new Response(hit.body, hit);
      // Keep this internal Cache API entry out of browser and front-of-Worker
      // caches; those would bypass the D1 revision check after unpublication.
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("x-seojing-cache", "HIT");
      return response;
    }
  } catch {
    // A cache outage must not make public pages unavailable.
  }

  const response = await render();
  if (!isCacheableResponse(response, request)) return response;
  const stored = new Response(response.clone().body, response);
  stored.headers.set(
    "cache-control",
    `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}`,
  );
  ctx.waitUntil(store.put(cacheKey, stored).catch(() => undefined));
  const result = new Response(response.body, response);
  result.headers.set("cache-control", "private, no-store");
  result.headers.set("x-seojing-cache", "MISS");
  return result;
}
