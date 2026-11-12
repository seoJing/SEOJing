import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  isPublicPageCacheRequest,
  publicPageCacheKey,
  servePublicPageWithCache,
} from "./public-page-cache";

beforeAll(() => vi.stubGlobal("crypto", webcrypto));

function fixture() {
  let revision = 1;
  const visibleSlugs = new Set<string>();
  const entries = new Map<string, Response>();
  const waits: Promise<unknown>[] = [];
  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: (slug: string) => ({
        first: async () =>
          [...visibleSlugs].some(
            (visible) => visible === slug || visible.startsWith(`${slug}/`),
          )
            ? { 1: 1 }
            : null,
      }),
      first: async () =>
        sql.includes("public_content_revision") ? { revision } : null,
    })),
  } as unknown as D1Database;
  const cache = {
    match: vi.fn(async (request: Request) => entries.get(request.url)?.clone()),
    put: vi.fn(async (request: Request, response: Response) => {
      entries.set(request.url, response.clone());
    }),
  } as unknown as Cache;
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => waits.push(promise),
  } as unknown as ExecutionContext;
  return {
    db,
    cache,
    ctx,
    waits,
    setRevision: (value: number) => (revision = value),
    addVisibleSlug: (slug: string) => visibleSlugs.add(slug),
    removeVisibleSlug: (slug: string) => visibleSlugs.delete(slug),
  };
}

describe("public blog edge cache", () => {
  it("only considers anonymous public blog GETs with expected query state", () => {
    expect(
      isPublicPageCacheRequest(new Request("https://seojing.com/blog")),
    ).toBe(true);
    expect(isPublicPageCacheRequest(new Request("https://seojing.com/"))).toBe(
      true,
    );
    expect(
      isPublicPageCacheRequest(
        new Request("https://seojing.com/blog/study/post?_rsc=state", {
          headers: { rsc: "1" },
        }),
      ),
    ).toBe(true);
    for (const request of [
      new Request("https://seojing.com/ops/articles"),
      new Request("https://seojing.com/blog?preview=1"),
      new Request("https://seojing.com/blog", {
        headers: { cookie: "session=x" },
      }),
      new Request("https://seojing.com/blog", { method: "POST" }),
    ]) {
      expect(isPublicPageCacheRequest(request)).toBe(false);
    }
  });

  it("serves a second request from cache and misses after publication revision changes", async () => {
    const { db, cache, ctx, waits, setRevision } = fixture();
    const request = new Request("https://seojing.com/blog", {
      headers: { accept: "text/html", "user-agent": "Chrome" },
    });
    const render = vi.fn(
      async () =>
        new Response("<h1>Public</h1>", {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    );

    const first = await servePublicPageWithCache(
      request,
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    await Promise.all(waits);
    expect(first.headers.get("x-seojing-cache")).toBe("MISS");
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    expect(await first.text()).toBe("<h1>Public</h1>");

    const second = await servePublicPageWithCache(
      request,
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    expect(second.headers.get("x-seojing-cache")).toBe("HIT");
    expect(second.headers.get("cache-control")).toBe("private, no-store");
    expect(await second.text()).toBe("<h1>Public</h1>");
    expect(render).toHaveBeenCalledTimes(1);

    setRevision(2);
    const afterPublish = await servePublicPageWithCache(
      request,
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    expect(afterPublish.headers.get("x-seojing-cache")).toBe("MISS");
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("separates HTML and RSC navigation variants", async () => {
    const html = new Request("https://seojing.com/blog/study/post", {
      headers: { accept: "text/html" },
    });
    const rsc = new Request("https://seojing.com/blog/study/post?_rsc=state", {
      headers: {
        accept: "text/x-component",
        rsc: "1",
        "next-router-state-tree": "state",
      },
    });
    expect((await publicPageCacheKey(html, "version-a-1")).url).not.toBe(
      (await publicPageCacheKey(rsc, "version-a-1")).url,
    );
    expect((await publicPageCacheKey(rsc, "version-a-1")).url).not.toBe(
      (await publicPageCacheKey(rsc, "version-a-2")).url,
    );
    const intercepted = new Request(rsc, {
      headers: {
        ...Object.fromEntries(rsc.headers),
        "x-vinext-interception-context": "modal",
      },
    });
    expect((await publicPageCacheKey(rsc, "version-a-1")).url).not.toBe(
      (await publicPageCacheKey(intercepted, "version-a-1")).url,
    );
  });

  it("normalizes arbitrary _rsc values while preserving router-state variants", async () => {
    const { db, cache, ctx, waits, addVisibleSlug } = fixture();
    addVisibleSlug("study/post");
    const render = vi.fn(
      async () =>
        new Response("RSC", {
          headers: { "content-type": "text/x-component", vary: "RSC" },
        }),
    );
    const request = (state: string, rsc: string) =>
      new Request(`https://seojing.com/blog/study/post?_rsc=${rsc}`, {
        headers: { rsc: "1", "next-router-state-tree": state },
      });
    await servePublicPageWithCache(
      request("same", "first"),
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    await Promise.all(waits);
    const hit = await servePublicPageWithCache(
      request("same", "random-second"),
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    expect(hit.headers.get("x-seojing-cache")).toBe("HIT");
    await servePublicPageWithCache(
      request("different", "third"),
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("does not cache a backend-fallback article after its public snapshot disappears", async () => {
    const { db, cache, ctx, waits, addVisibleSlug, removeVisibleSlug } =
      fixture();
    const slug = "study/post";
    addVisibleSlug(slug);
    const request = new Request(`https://seojing.com/blog/${slug}`);
    const render = vi.fn(
      async () =>
        new Response("<h1>Article</h1>", {
          headers: { "content-type": "text/html" },
        }),
    );
    await servePublicPageWithCache(
      request,
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    await Promise.all(waits);
    removeVisibleSlug(slug);
    const fallback = await servePublicPageWithCache(
      request,
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    expect(fallback.headers.get("x-seojing-cache")).toBeNull();
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("invalidates static pages on a new Worker deployment without reading D1", async () => {
    const { db, cache, ctx, waits } = fixture();
    const request = new Request("https://seojing.com/");
    const render = vi.fn(
      async () =>
        new Response("<h1>Home</h1>", {
          headers: { "content-type": "text/html" },
        }),
    );
    await servePublicPageWithCache(
      request,
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    await Promise.all(waits);
    const hit = await servePublicPageWithCache(
      request,
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    expect(hit.headers.get("x-seojing-cache")).toBe("HIT");
    const nextVersion = await servePublicPageWithCache(
      request,
      db,
      "version-b",
      ctx,
      render,
      cache,
    );
    expect(nextVersion.headers.get("x-seojing-cache")).toBe("MISS");
    expect(render).toHaveBeenCalledTimes(2);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("never stores private 404 responses", async () => {
    const { db, cache, ctx, waits } = fixture();
    const render = vi.fn(
      async () =>
        new Response("Not found", {
          status: 404,
          headers: { "content-type": "text/html" },
        }),
    );
    const request = new Request(
      "https://seojing.com/blog/study/effective-typescript/day5",
    );
    await servePublicPageWithCache(
      request,
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    await Promise.all(waits);
    await servePublicPageWithCache(
      request,
      db,
      "version-a",
      ctx,
      render,
      cache,
    );
    expect(render).toHaveBeenCalledTimes(2);
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("preserves the app's headers for responses that are not cacheable", async () => {
    const { db, cache, ctx } = fixture();
    const response = await servePublicPageWithCache(
      new Request("https://seojing.com/blog"),
      db,
      "version-a",
      ctx,
      async () =>
        new Response("Not found", {
          status: 404,
          headers: { "cache-control": "public, max-age=60" },
        }),
      cache,
    );
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(response.headers.get("x-seojing-cache")).toBeNull();
  });
});
