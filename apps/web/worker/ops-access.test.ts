import { afterEach, describe, expect, it, vi } from "vitest";
import { isOpsAuthorized } from "./ops-access";

const issuer = "https://owner.cloudflareaccess.com";
const audience = "analytics-audience";
const email = "owner@example.com";

function encode(value: object | Uint8Array): string {
  const bytes =
    value instanceof Uint8Array
      ? value
      : new TextEncoder().encode(JSON.stringify(value));
  return Buffer.from(bytes).toString("base64url");
}

async function fixture(payloadOverride: Record<string, unknown> = {}) {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicKey = await crypto.subtle.exportKey("jwk", keys.publicKey);
  const header = encode({ alg: "RS256", kid: "test-key" });
  const payload = encode({
    iss: issuer,
    aud: [audience],
    email,
    exp: Math.floor(Date.now() / 1000) + 300,
    ...payloadOverride,
  });
  const signingInput = `${header}.${payload}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keys.privateKey,
      new TextEncoder().encode(signingInput),
    ),
  );
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ keys: [{ ...publicKey, kid: "test-key" }] }),
      ),
  );
  return new Request("https://seojing.com/api/ops/analytics/summary", {
    headers: {
      "cf-access-jwt-assertion": `${signingInput}.${encode(signature)}`,
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("signed ops access", () => {
  const env = {
    SEOJING_OPS_ACCESS_ISSUER: issuer,
    SEOJING_OPS_ACCESS_AUD: audience,
    SEOJING_OPS_ACCESS_EMAIL: email,
  };

  it("accepts a valid owner token", async () => {
    expect(await isOpsAuthorized(await fixture(), env)).toBe(true);
  });

  it("rejects another audience or email", async () => {
    expect(
      await isOpsAuthorized(await fixture({ aud: ["another-app"] }), env),
    ).toBe(false);
    expect(
      await isOpsAuthorized(
        await fixture({ email: "visitor@example.com" }),
        env,
      ),
    ).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const request = await fixture();
    const token = request.headers.get("cf-access-jwt-assertion")!;
    const broken = `${token.slice(0, -3)}xxx`;
    expect(
      await isOpsAuthorized(
        new Request(request.url, {
          headers: { "cf-access-jwt-assertion": broken },
        }),
        env,
      ),
    ).toBe(false);
  });
});
