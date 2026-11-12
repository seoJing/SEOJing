import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { serveOptimizedImageWithCache } from "./public-image-cache";

beforeAll(() => vi.stubGlobal("crypto", webcrypto));

describe("optimized image cache", () => {
  it("reuses only the same image, format variant, and Worker version", async () => {
    const entries = new Map<string, Response>();
    const cache = {
      match: async (request: Request) => entries.get(request.url)?.clone(),
      put: async (request: Request, response: Response) => {
        entries.set(request.url, response.clone());
      },
    } as unknown as Cache;
    const waits: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
    } as unknown as ExecutionContext;
    const optimize = vi.fn(
      async () =>
        new Response("optimized", {
          headers: { "content-type": "image/avif" },
        }),
    );
    const url = "https://seojing.com/_next/image?url=%2Fcover.png&w=640&q=70";
    const avif = new Request(url, { headers: { accept: "image/avif" } });

    const first = await serveOptimizedImageWithCache(
      avif,
      "version-a",
      ctx,
      optimize,
      cache,
    );
    await Promise.all(waits);
    expect(first.headers.get("x-seojing-image-cache")).toBe("MISS");
    expect(first.headers.get("cache-control")).toContain("max-age=300");
    const second = await serveOptimizedImageWithCache(
      avif,
      "version-a",
      ctx,
      optimize,
      cache,
    );
    expect(second.headers.get("x-seojing-image-cache")).toBe("HIT");
    expect(await second.text()).toBe("optimized");
    expect(optimize).toHaveBeenCalledTimes(1);

    const webp = new Request(url, { headers: { accept: "image/webp" } });
    await serveOptimizedImageWithCache(webp, "version-a", ctx, optimize, cache);
    await serveOptimizedImageWithCache(avif, "version-b", ctx, optimize, cache);
    expect(optimize).toHaveBeenCalledTimes(3);
  });
});
