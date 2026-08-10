import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("/api/ops/articles", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function configureBackend() {
    vi.stubEnv("SEOJING_BACKEND_API_ORIGIN", "http://127.0.0.1:4027/");
    vi.stubEnv("SEOJING_BACKEND_ADMIN_API_TOKEN", "test-admin-token");
  }

  it("proxies an unpublish action to the protected backend endpoint", async () => {
    configureBackend();
    const fetchSpy = vi.fn(async () =>
      Response.json({
        article: { slug: "study/effective-typescript/day1", status: "DRAFT" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(
      new Request("http://localhost/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "unpublish",
          slug: "study/effective-typescript/day1",
        }),
      }),
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:4027/admin/articles/study%2Feffective-typescript%2Fday1/unpublish",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-admin-token",
        }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      action: "unpublish",
      article: { status: "DRAFT" },
    });
  });

  it("accepts the backend's empty 204 response after permanent deletion", async () => {
    configureBackend();
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(
      new Request("http://localhost/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          slug: "cms/draft",
        }),
      }),
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:4027/admin/articles/cms%2Fdraft",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      action: "delete",
    });
  });

  it("forwards the selected category when saving a block revision", async () => {
    configureBackend();
    const fetchSpy = vi.fn(async () =>
      Response.json({ article: { slug: "cms/draft", category: "Study" } }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(
      new Request("http://localhost/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "saveBlocks",
          slug: "cms/draft",
          title: "CMS draft",
          category: "Study",
          blocks: [{ type: "PARAGRAPH", content: { text: "body" } }],
        }),
      }),
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:4027/admin/articles/cms%2Fdraft/blocks",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"category":"Study"'),
      }),
    );
    expect(response.status).toBe(200);
  });
});
