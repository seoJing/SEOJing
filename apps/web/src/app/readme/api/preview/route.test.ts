import { afterEach, describe, expect, it, vi } from "vitest";
import { README_CASE_ID, syntheticPreview } from "@/shared/readme/preview";
import { POST } from "./route";

const request = (body: unknown) =>
  new Request("https://seojing.com/readme/api/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("README synthetic preview proxy", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects personal/free-form input before contacting the backend", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      request({ case_id: README_CASE_ID, resume_text: "private text" }),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bounds even the synthetic preview request before parsing it", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      request({ case_id: README_CASE_ID, padding: "x".repeat(1_000) }),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "too_large" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies only the synthetic case ID and reports the backend source", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(syntheticPreview), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request({ case_id: README_CASE_ID }));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.seojing.com/readme/preview",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ case_id: README_CASE_ID }),
      }),
    );
    expect(response.headers.get("x-readme-source")).toBe("backend");
    expect(await response.json()).toEqual(syntheticPreview);
  });

  it("returns an explicitly labelled fixture when the backend is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const response = await POST(request({ case_id: README_CASE_ID }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-readme-source")).toBe("fixture");
    expect(await response.json()).toEqual(syntheticPreview);
  });
});
