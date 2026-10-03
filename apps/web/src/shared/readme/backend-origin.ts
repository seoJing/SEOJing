type BackendRuntimeEnv = {
  SEOJING_BACKEND_API_ORIGIN?: string;
  SEOJING_BACKEND_ARTICLE_API_ORIGIN?: string;
};

export function readmeBackendOrigin(): string {
  const runtime =
    (import.meta as unknown as { env?: BackendRuntimeEnv }).env ?? {};
  const processEnv = typeof process === "undefined" ? undefined : process.env;
  const configured =
    processEnv?.SEOJING_BACKEND_API_ORIGIN ??
    processEnv?.SEOJING_BACKEND_ARTICLE_API_ORIGIN ??
    runtime.SEOJING_BACKEND_API_ORIGIN ??
    runtime.SEOJING_BACKEND_ARTICLE_API_ORIGIN;
  return configured?.trim().replace(/\/+$/, "") || "https://api.seojing.com";
}
