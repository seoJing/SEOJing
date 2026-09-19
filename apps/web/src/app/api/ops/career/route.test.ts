import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST, PUT } from "./route";

describe("/api/ops/career", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function configureBackend() {
    vi.stubEnv("SEOJING_BACKEND_API_ORIGIN", "http://127.0.0.1:4027/");
    vi.stubEnv("SEOJING_BACKEND_ADMIN_API_TOKEN", "test-admin-token");
  }

  async function createAccessFixture({
    issuer,
    audience,
    email,
  }: {
    issuer: string;
    audience: string;
    email: string;
  }) {
    const keyPair = (await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const publicJwk = {
      ...(await crypto.subtle.exportKey("jwk", keyPair.publicKey)),
      kid: "access-test-key",
    };
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const header = encode({ alg: "RS256", kid: publicJwk.kid, typ: "JWT" });
    const now = Math.floor(Date.now() / 1_000);
    const payload = encode({
      aud: [audience],
      email,
      exp: now + 300,
      iat: now,
      iss: issuer,
    });
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keyPair.privateKey,
      new TextEncoder().encode(`${header}.${payload}`),
    );
    return {
      publicJwk,
      token: `${header}.${payload}.${Buffer.from(signature).toString("base64url")}`,
    };
  }

  it("rejects a spoofable development identity header in production", async () => {
    configureBackend();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEOJING_OPS_ACCESS_EMAIL", "owner@example.com");
    vi.stubEnv(
      "SEOJING_OPS_ACCESS_ISSUER",
      "https://team.cloudflareaccess.com",
    );
    vi.stubEnv("SEOJING_OPS_ACCESS_AUD", "career-ops-audience");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await GET(
      new Request(
        "https://example.com/api/ops/career?slug=daangn-frontend-intern",
        { headers: { "x-authenticated-user-email": "owner@example.com" } },
      ),
    );

    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts a valid Cloudflare Access assertion in production", async () => {
    configureBackend();
    const issuer = "https://valid-team.cloudflareaccess.com";
    const audience = "career-ops-audience";
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SEOJING_OPS_ACCESS_EMAIL", "owner@example.com");
    vi.stubEnv("SEOJING_OPS_ACCESS_ISSUER", issuer);
    vi.stubEnv("SEOJING_OPS_ACCESS_AUD", audience);
    const fixture = await createAccessFixture({
      issuer,
      audience,
      email: "owner@example.com",
    });
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === `${issuer}/cdn-cgi/access/certs`) {
        return Response.json({ keys: [fixture.publicJwk] });
      }
      return Response.json({ aggregate: {} });
    });
    vi.stubGlobal("fetch", fetchSpy);

    const response = await GET(
      new Request(
        "https://example.com/api/ops/career?slug=daangn-frontend-intern",
        { headers: { "cf-access-jwt-assertion": fixture.token } },
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("reads an aggregate through the protected backend", async () => {
    configureBackend();
    const fetchSpy = vi.fn(async () =>
      Response.json({ opportunity: { slug: "daangn-frontend-intern" } }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await GET(
      new Request(
        "http://localhost/api/ops/career?slug=daangn-frontend-intern",
      ),
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:4027/admin/career/opportunities/daangn-frontend-intern",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer test-admin-token",
        }),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("saves the full admin document unchanged", async () => {
    configureBackend();
    const fetchSpy = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await PUT(
      new Request("http://localhost/api/ops/career", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "daangn-frontend-intern",
          document: {
            aggregate: {
              opportunity: {
                slug: "daangn-frontend-intern",
                title: "Frontend Internship",
              },
            },
            metadata: { visibility: "DRAFT" },
          },
        }),
      }),
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:4027/admin/career/opportunities/daangn-frontend-intern",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          aggregate: {
            opportunity: {
              slug: "daangn-frontend-intern",
              title: "Frontend Internship",
            },
          },
          metadata: { visibility: "DRAFT" },
        }),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("rejects update payloads whose opportunity slug does not match", async () => {
    configureBackend();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await PUT(
      new Request("http://localhost/api/ops/career", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "daangn-frontend-intern",
          document: {
            aggregate: { opportunity: { slug: "another-opportunity" } },
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("creates a new private aggregate", async () => {
    configureBackend();
    const fetchSpy = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(
      new Request("http://localhost/api/ops/career", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          slug: "daangn-frontend-intern",
          document: {
            aggregate: {
              company: {},
              opportunity: { slug: "daangn-frontend-intern" },
              statusSources: [],
            },
          },
        }),
      }),
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:4027/admin/career/opportunities",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          aggregate: {
            company: {},
            opportunity: { slug: "daangn-frontend-intern" },
            statusSources: [],
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
  });

  it("publishes through a separate action", async () => {
    configureBackend();
    const fetchSpy = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(
      new Request("http://localhost/api/ops/career", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          slug: "daangn-frontend-intern",
        }),
      }),
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:4027/admin/career/opportunities/daangn-frontend-intern/publish",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(200);
  });
});
