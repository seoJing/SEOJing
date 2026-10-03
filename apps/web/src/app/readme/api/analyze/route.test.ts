import { afterEach, describe, expect, it, vi } from "vitest";
import { USER_CASE_ID, syntheticPreview } from "@/shared/readme/preview";
import { POST } from "./route";

const payload = {
  job_text: "청년 프로그램 운영과 문서 정리 경험을 가진 담당자를 모집합니다.",
  resume_filename: "resume.txt",
  resume_media_type: "text/plain",
  resume_base64: "7J207L2Y", // arbitrary bytes; backend decides if they are readable
};

const request = (body: unknown, extraHeaders: Record<string, string> = {}) =>
  new Request("https://seojing.com/readme/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });

describe("README user-document proxy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("rejects a filename/media-type mismatch before backend contact", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      request({ ...payload, resume_filename: "resume.pdf" }),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns only a valid user analysis response", async () => {
    const userPreview = { ...syntheticPreview, case_id: USER_CASE_ID };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify(userPreview), { status: 200 }),
      ),
    );
    const response = await POST(request(payload));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual(userPreview);
  });

  it("sets same-zone x-real-ip only from Cloudflare's visitor header", async () => {
    const userPreview = { ...syntheticPreview, case_id: USER_CASE_ID };
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify(userPreview), { status: 200 }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await POST(
      request(payload, {
        "cf-connecting-ip": "198.51.100.14",
        "x-real-ip": "203.0.113.66",
      }),
    );
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1].headers).get("x-real-ip"),
    ).toBe("198.51.100.14");

    await POST(request(payload, { "x-real-ip": "203.0.113.66" }));
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1].headers).has("x-real-ip"),
    ).toBe(false);
  });

  it("does not replace a failed personal analysis with a synthetic report", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const response = await POST(request(payload));
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "analyze_unavailable" });
  });

  it("uses the configured backend and preserves a scanned-PDF error code", async () => {
    vi.stubEnv("SEOJING_BACKEND_API_ORIGIN", "http://127.0.0.1:4028/");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "unreadable_pdf" }), {
          status: 400,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request(payload));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4028/readme/analyze",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "unreadable_pdf" });
  });

  it("preserves the backend analysis-timeout code without a synthetic fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "analysis_timeout" }), {
            status: 503,
          }),
      ),
    );
    const response = await POST(request(payload));
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "analysis_timeout" });
  });

  it("preserves the resource-limit code without a synthetic fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "analysis_resource_limit" }), {
            status: 503,
          }),
      ),
    );
    const response = await POST(request(payload));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "analysis_resource_limit" });
  });

  it("labels a too-short PDF as possibly scanned without echoing uploaded content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "text_too_short" }), {
            status: 400,
          }),
      ),
    );
    const response = await POST(
      request({
        ...payload,
        resume_filename: "resume.pdf",
        resume_media_type: "application/pdf",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "pdf_text_missing" });
  });
});
