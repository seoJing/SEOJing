import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("README Lab page route", () => {
  it("serves a standards-mode page that talks only to the same-origin lab API", async () => {
    const response = GET();
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(
      html.startsWith(
        '<!doctype html>\n<html lang="ko">\n<title>README Lab</title>',
      ),
    ).toBe(true);
    expect(html).toContain(
      '<meta name="readme-lab-api" content="/api/readme/lab">',
    );
    expect(html).toContain('<meta name="readme-lab-source" content="http">');
    expect(html).not.toMatch(
      /<meta name="readme-lab-source" content="(auto|sample)">/,
    );
  });

  it("stays out of search, caches and other sites' frames", () => {
    const headers = GET().headers;

    expect(headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    expect(headers.get("cache-control")).toBe("private, no-store");
    expect(headers.get("referrer-policy")).toBe("no-referrer");
    const csp = headers.get("content-security-policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("font-src https://fonts.gstatic.com");
  });

  it("contains no prototype or synthetic-demo wording in the served page", async () => {
    const html = await GET().text();

    expect(html).not.toMatch(/가상|시안|합성|흉내|모델 실행 없음/);
  });
});
