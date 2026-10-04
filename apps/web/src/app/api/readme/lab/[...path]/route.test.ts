import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST, DELETE, PUT } from "./route";

const request = (
  path: string,
  method = "GET",
  body?: string,
  headers: Record<string, string> = {},
) =>
  new Request(`https://seojing.com/api/readme/lab/${path}`, {
    method,
    ...(body === undefined ? {} : { body }),
    headers: { "content-type": "application/json", ...headers },
  });
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("Lab allowlisted same-origin proxy", () => {
  it.each([
    ["session", "GET"],
    ["session/id", "GET"],
    ["jobs", "DELETE"],
    ["jobs/id", "POST"],
    ["jobs/id", "PUT"],
    ["other", "POST"],
    ["jobs/id/other", "GET"],
    ["jobs/%2Fadmin", "GET"],
    ["prepare/id?after_seq=0", "GET"],
    ["session?x=1", "POST"],
    ["jobs/id?after_seq=-1", "GET"],
    ["jobs/id?after_seq=1.5", "GET"],
    ["jobs/id?after_seq=0&after_seq=1", "GET"],
    ["jobs/id?after_seq=9007199254740992", "GET"],
  ])("rejects %s with %s before contacting backend", async (path, method) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await PUT(request(path, method));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    ["session", "POST"],
    ["prepare", "POST"],
    ["jobs", "POST"],
    ["prepare/id", "GET"],
    ["prepare/id", "DELETE"],
    ["jobs/id?after_seq=12", "GET"],
    ["jobs/id", "DELETE"],
  ])("forwards allowed %s %s", async (path, method) => {
    vi.stubEnv("SEOJING_BACKEND_API_ORIGIN", "http://127.0.0.1:4028");
    const fetchMock = vi.fn(async () => response({ status: "queued" }, 202));
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(
      request(path, method, method === "POST" ? "{}" : undefined),
    );
    expect(res.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://127.0.0.1:4028/readme/lab/${path}`,
      expect.objectContaining({
        method,
        redirect: "manual",
        cache: "no-store",
      }),
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
  });
  it("preserves consent version/body while isolating headers and client IP", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      response({ access_token: "fixture" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const body = JSON.stringify({
      invite_code: "fixture",
      cloud_consent: true,
      consent_version: "readme-jev-v1",
    });
    await POST(
      request("session", "POST", body, {
        authorization: "Bearer fixture-token",
        cookie: "private=cookie",
        "x-real-ip": "203.0.113.66",
        "cf-connecting-ip": "198.51.100.14",
        "x-private": "secret",
      }),
    );
    const init = fetchMock.mock.calls[0]![1];
    expect(init.body).toBe(body);
    expect(Object.fromEntries(new Headers(init.headers))).toEqual({
      authorization: "Bearer fixture-token",
      "content-type": "application/json",
      "x-real-ip": "198.51.100.14",
    });
    await GET(
      request("jobs/id", "GET", undefined, {
        "x-real-ip": "203.0.113.66",
        authorization: "Basic unwanted",
      }),
    );
    expect([...new Headers(fetchMock.mock.calls[1]![1].headers)]).toEqual([]);
  });
  it.each([401, 409, 410, 413, 429, 503])(
    "preserves backend JSON error and status %i",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => response({ error: "fixture_error" }, status)),
      );
      const res = await GET(request("jobs/id"));
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error: "fixture_error" });
    },
  );
  it("preserves an empty cancellation response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    const res = await DELETE(request("jobs/id", "DELETE"));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });
  it("counts actual bytes despite a lying Content-Length", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      request("session", "POST", JSON.stringify("가".repeat(1400)), {
        "content-length": "1",
      }),
    );
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("allows prepare-sized payloads but rejects oversized ones without an upstream call", async () => {
    const fetchMock = vi.fn(async () => response({ status: "queued" }, 202));
    vi.stubGlobal("fetch", fetchMock);
    expect(
      (
        await POST(
          request(
            "prepare",
            "POST",
            JSON.stringify({ resume_base64: "a".repeat(2_666_672) }),
          ),
        )
      ).status,
    ).toBe(202);
    expect(
      (
        await POST(
          request("prepare", "POST", JSON.stringify("a".repeat(2_900_001))),
        )
      ).status,
    ).toBe(413);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["not json", "application/json", 400],
    ["{}", "text/plain", 415],
  ])("rejects invalid body %s / %s", async (body, type, status) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(
      (await POST(request("session", "POST", body, { "content-type": type })))
        .status,
    ).toBe(status);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["html", "invalid_json", "redirect", "oversized", "network"])(
    "maps upstream %s to safe JSON without forwarding tokens",
    async (kind) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          if (kind === "network") throw new Error("private server detail");
          if (kind === "redirect")
            return new Response(null, {
              status: 302,
              headers: { location: "https://untrusted.invalid" },
            });
          return new Response(
            kind === "oversized"
              ? "a".repeat(4_000_001)
              : "private server detail",
            {
              headers: {
                "content-type":
                  kind === "html" ? "text/html" : "application/json",
                "set-cookie": "private=cookie",
              },
            },
          );
        }),
      );
      const res = await GET(request("jobs/id"));
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: "upstream_unavailable" });
      expect(res.headers.has("set-cookie")).toBe(false);
    },
  );
  it("times out stalled upstream headers", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          ),
      ),
    );
    const pending = GET(request("jobs/id"));
    await vi.advanceTimersByTimeAsync(30_001);
    const res = await pending;
    expect(res.status).toBe(504);
  });
  it("keeps the timeout active while reading a stalled response body", async () => {
    vi.useFakeTimers();
    const cancelled = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new ReadableStream({ cancel: cancelled }), {
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    const pending = GET(request("jobs/id"));
    await vi.advanceTimersByTimeAsync(30_001);
    expect((await pending).status).toBe(504);
    expect(cancelled).toHaveBeenCalled();
  });
});
