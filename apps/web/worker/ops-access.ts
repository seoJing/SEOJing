type OpsAccessEnv = {
  SEOJING_OPS_ACCESS_ISSUER: string;
  SEOJING_OPS_ACCESS_AUD: string;
  SEOJING_OPS_ACCESS_EMAIL?: string;
};

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export async function isOpsAuthorized(
  request: Request,
  env: OpsAccessEnv,
): Promise<boolean> {
  const token = request.headers.get("cf-access-jwt-assertion");
  const allowedEmails = new Set(
    (env.SEOJING_OPS_ACCESS_EMAIL ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  if (
    !token ||
    allowedEmails.size === 0 ||
    !env.SEOJING_OPS_ACCESS_ISSUER ||
    !env.SEOJING_OPS_ACCESS_AUD
  )
    return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [encodedHeader, encodedPayload, encodedSignature] = parts as [
      string,
      string,
      string,
    ];
    const header = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedHeader)),
    ) as { alg?: string; kid?: string };
    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedPayload)),
    ) as {
      iss?: string;
      aud?: string | string[];
      email?: string;
      exp?: number;
      nbf?: number;
    };
    const issuer = env.SEOJING_OPS_ACCESS_ISSUER.replace(/\/+$/, "");
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const now = Math.floor(Date.now() / 1000);
    if (
      header.alg !== "RS256" ||
      !header.kid ||
      payload.iss?.replace(/\/+$/, "") !== issuer ||
      !audience.includes(env.SEOJING_OPS_ACCESS_AUD) ||
      !allowedEmails.has(payload.email?.trim().toLowerCase() ?? "") ||
      !payload.exp ||
      payload.exp <= now ||
      (payload.nbf && payload.nbf > now)
    )
      return false;
    const response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return false;
    const certificates = (await response.json()) as {
      keys?: Array<JsonWebKey & { kid?: string }>;
    };
    const certificate = certificates.keys?.find(
      (key) => key.kid === header.kid,
    );
    if (!certificate) return false;
    const key = await crypto.subtle.importKey(
      "jwk",
      certificate,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
  } catch {
    return false;
  }
}
