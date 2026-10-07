import { afterEach, describe, expect, it, vi } from "vitest";

const snapshot = vi.hoisted(() => ({
  put: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  read: vi.fn(async (): Promise<unknown> => null),
}));
vi.mock("@/shared/content/public-article-store", () => ({
  putPublicArticle: snapshot.put,
  deletePublicArticle: snapshot.remove,
  readPublicArticle: snapshot.read,
}));

import { GET, POST } from "./route";

describe("/api/ops/articles", () => {
  it("proxies the private review queue without a slug", async () => {
    vi.stubEnv("SEOJING_BACKEND_API_ORIGIN", "http://127.0.0.1:4027/");
    vi.stubEnv("SEOJING_BACKEND_ADMIN_API_TOKEN", "test-admin-token");
    const fetchSpy = vi.fn(async () =>
      Response.json({ articles: [{ slug: "SEOJing/devLog/day1" }] }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const response = await GET(
      new Request("http://localhost/api/ops/articles"),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:4027/admin/article-review-queue",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer test-admin-token",
        }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      articles: [{ slug: "SEOJing/devLog/day1" }],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    snapshot.put.mockClear();
    snapshot.remove.mockClear();
    snapshot.read.mockClear();
  });

  function configureBackend() {
    vi.stubEnv("SEOJING_BACKEND_API_ORIGIN", "http://127.0.0.1:4027/");
    vi.stubEnv("SEOJING_BACKEND_ADMIN_API_TOKEN", "test-admin-token");
  }

  it("passes a document validation message back to the CMS author", async () => {
    configureBackend();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "Invalid quiz item." }, { status: 400 }),
      ),
    );
    const response = await POST(
      new Request("http://localhost/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "createDocument",
          slug: "native",
          title: "Native",
          document: { type: "doc", content: [] },
        }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid quiz item.",
    });
  });

  it("rejects spoofed email headers without a signed Access assertion", async () => {
    configureBackend();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEOJING_OPS_ACCESS_EMAIL", "owner@example.com");
    vi.stubEnv("SEOJING_OPS_ACCESS_ISSUER", "https://access.example.com");
    vi.stubEnv("SEOJING_OPS_ACCESS_AUD", "test-audience");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await GET(
      new Request("https://seojing.com/api/ops/articles?slug=cms%2Fpost", {
        headers: {
          "cf-access-authenticated-user-email": "owner@example.com",
          "x-authenticated-user-email": "owner@example.com",
        },
      }),
    );
    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated production review-queue request", async () => {
    configureBackend();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEOJING_OPS_ACCESS_EMAIL", "owner@example.com");
    vi.stubEnv("SEOJING_OPS_ACCESS_ISSUER", "https://access.example.com");
    vi.stubEnv("SEOJING_OPS_ACCESS_AUD", "test-audience");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const response = await GET(
      new Request("https://seojing.com/api/ops/articles"),
    );
    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

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
    expect(snapshot.remove).toHaveBeenCalledWith(
      "study/effective-typescript/day1",
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      action: "unpublish",
      article: { status: "DRAFT" },
    });
  });

  it("hides the snapshot before unpublishing and restores it if the backend rejects the action", async () => {
    configureBackend();
    const article = {
      slug: "cms/live",
      title: "Live",
      publishedAt: "2026-10-07T00:00:00Z",
      body: { html: "<p>Live</p>" },
    };
    snapshot.read.mockResolvedValueOnce(article);
    const events: string[] = [];
    snapshot.remove.mockImplementationOnce(async () => {
      events.push("snapshot-delete");
    });
    snapshot.put.mockImplementationOnce(async () => {
      events.push("snapshot-restore");
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        events.push("backend-unpublish");
        return Response.json({ error: "conflict" }, { status: 409 });
      }),
    );
    const response = await POST(
      new Request("http://localhost/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "unpublish", slug: "cms/live" }),
      }),
    );
    expect(response.status).toBe(409);
    expect(events).toEqual([
      "snapshot-delete",
      "backend-unpublish",
      "snapshot-restore",
    ]);
    expect(snapshot.put).toHaveBeenCalledWith(article);
  });

  it("shows the backend's publication gap without exposing article source", async () => {
    configureBackend();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: "MDX contains content the CMS renderer cannot preserve.",
            issues: [{ name: "UnknownWidget", line: 12 }],
          },
          { status: 409 },
        ),
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish", slug: "cms/draft" }),
      }),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "MDX contains content the CMS renderer cannot preserve.",
      issues: [{ name: "UnknownWidget", line: 12 }],
    });
  });

  it("snapshots a published document before confirming publication", async () => {
    configureBackend();
    const article = {
      slug: "cms/draft",
      title: "CMS draft",
      publishedAt: "2026-10-07T00:00:00Z",
      updatedAt: "2026-10-07T00:00:00Z",
      body: { html: "<p>Live</p>", document: { type: "doc", content: [] } },
    };
    const fetchSpy = vi.fn(async (url: string) =>
      url.endsWith("/publish")
        ? Response.json({ article: { slug: "cms/draft", status: "PUBLISHED" } })
        : Response.json(article),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const response = await POST(
      new Request("http://localhost/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish", slug: "cms/draft" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(snapshot.put).toHaveBeenCalledWith(article);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("reports a recoverable sync action if the backend published but the snapshot failed", async () => {
    configureBackend();
    snapshot.put.mockRejectedValueOnce(new Error("D1 unavailable"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/publish")
          ? Response.json({
              article: { slug: "cms/draft", status: "PUBLISHED" },
            })
          : Response.json({
              slug: "cms/draft",
              title: "Draft",
              publishedAt: "2026-10-07T00:00:00Z",
              body: { html: "" },
            }),
      ),
    );
    const response = await POST(
      new Request("http://localhost/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish", slug: "cms/draft" }),
      }),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      backendPublished: true,
      retryAction: "syncPublished",
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
    expect(snapshot.remove).toHaveBeenCalledWith("cms/draft");
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

  it("restores an earlier revision for the selected article", async () => {
    configureBackend();
    const fetchSpy = vi.fn(async () =>
      Response.json({ article: { slug: "study/effective-typescript/day5" } }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const response = await POST(
      new Request("http://localhost/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "restoreRevision",
          slug: "study/effective-typescript/day5",
          revisionNumber: 2,
        }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:4027/admin/articles/study%2Feffective-typescript%2Fday5/revisions/2/restore",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(201);
  });
});
