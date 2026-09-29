import { isOpsAuthorized } from "./ops-access";

type DiscoveryEnv = Env & {
  SEOJING_OPS_ACCESS_EMAIL?: string;
  SEOJING_GSC_CLIENT_ID?: string;
  SEOJING_GSC_CLIENT_SECRET?: string;
  SEOJING_GSC_REFRESH_TOKEN?: string;
  SEOJING_CF_ANALYTICS_TOKEN?: string;
  SEOJING_CF_RUM_SITE_TAG?: string;
};

type SearchRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};
type Source<T> = {
  status: "ready" | "empty" | "unconfigured" | "error";
  note?: string;
  data?: T;
};

function daysAgo(date: Date, days: number): string {
  return new Date(date.getTime() - days * 86400_000).toISOString().slice(0, 10);
}

async function googleSearch(
  env: DiscoveryEnv,
  now: Date,
): Promise<
  Source<{
    period: { from: string; to: string };
    daily: SearchRow[];
    queries: SearchRow[];
    pages: SearchRow[];
  }>
> {
  if (
    !env.SEOJING_GSC_CLIENT_ID ||
    !env.SEOJING_GSC_CLIENT_SECRET ||
    !env.SEOJING_GSC_REFRESH_TOKEN
  ) {
    return {
      status: "unconfigured",
      note: "Search Console 읽기 전용 OAuth가 연결되지 않았습니다.",
    };
  }
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(8_000),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: env.SEOJING_GSC_CLIENT_ID,
        client_secret: env.SEOJING_GSC_CLIENT_SECRET,
        refresh_token: env.SEOJING_GSC_REFRESH_TOKEN,
      }),
    });
    if (!tokenResponse.ok) throw new Error("OAuth 갱신 실패");
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("OAuth 토큰 누락");
    const from = daysAgo(now, 30);
    const to = daysAgo(now, 3);
    const endpoint =
      "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aseojing.com/searchAnalytics/query";
    const query = async (
      dimensions: string[],
      startDate: string,
      endDate: string,
    ) => {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(8_000),
        headers: {
          authorization: `Bearer ${token.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions,
          type: "web",
          dataState: "final",
          rowLimit: 1000,
        }),
      });
      if (!response.ok) throw new Error(`Search Console ${response.status}`);
      return ((await response.json()) as { rows?: SearchRow[] }).rows ?? [];
    };
    const [daily, queries, pages] = await Promise.all([
      query(["date"], daysAgo(now, 58), to),
      query(["query"], from, to),
      query(["page"], from, to),
    ]);
    return {
      status:
        daily.length || queries.length || pages.length ? "ready" : "empty",
      note: "완결된 날짜만 표시합니다. 검색어·페이지 행은 Search Console 상위 1,000개 제한이 적용됩니다.",
      data: { period: { from, to }, daily, queries, pages },
    };
  } catch (error) {
    return {
      status: "error",
      note: error instanceof Error ? error.message : "Search Console 조회 실패",
    };
  }
}

async function aiVisits(
  env: DiscoveryEnv,
  now: Date,
): Promise<
  Source<{
    period: { from: string; to: string };
    rows: Array<{ host: string; path: string; visits: number }>;
  }>
> {
  if (!env.SEOJING_CF_ANALYTICS_TOKEN || !env.SEOJING_CF_RUM_SITE_TAG) {
    return {
      status: "unconfigured",
      note: "Cloudflare Web Analytics API 자격 정보가 연결되지 않았습니다.",
    };
  }
  try {
    const from = `${daysAgo(now, 27)}T00:00:00Z`;
    const to = now.toISOString();
    const response = await fetch(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        method: "POST",
        signal: AbortSignal.timeout(8_000),
        headers: {
          authorization: `Bearer ${env.SEOJING_CF_ANALYTICS_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          query: `query Visits($account: string!, $site: string!, $from: Time!, $to: Time!) {
        viewer { accounts(filter: { accountTag: $account }) {
          rumPageloadEventsAdaptiveGroups(limit: 5000, filter: { siteTag: $site, datetime_geq: $from, datetime_leq: $to }) {
            dimensions { refererHost requestPath } sum { visits }
          }
        } }
      }`,
          variables: {
            account: "40b6e5a5424ab5505a10e9bb1b692638",
            site: env.SEOJING_CF_RUM_SITE_TAG,
            from,
            to,
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`Cloudflare GraphQL ${response.status}`);
    const body = (await response.json()) as {
      errors?: Array<{ message: string }>;
      data?: {
        viewer?: {
          accounts?: Array<{
            rumPageloadEventsAdaptiveGroups?: Array<{
              dimensions?: { refererHost?: string; requestPath?: string };
              sum?: { visits?: number };
            }>;
          }>;
        };
      };
    };
    if (body.errors?.length)
      throw new Error(body.errors[0]?.message ?? "GraphQL 오류");
    if (!Array.isArray(body.data?.viewer?.accounts))
      throw new Error("Cloudflare 분석 계정 응답이 없습니다.");
    const groups =
      body.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    if (groups.length >= 5000)
      throw new Error("결과가 5,000행 이상이라 부분 집계를 표시하지 않습니다.");
    const aiHosts = new Set([
      "chatgpt.com",
      "www.chatgpt.com",
      "chat.openai.com",
      "perplexity.ai",
      "www.perplexity.ai",
      "claude.ai",
      "www.claude.ai",
      "gemini.google.com",
      "copilot.microsoft.com",
    ]);
    const rows = groups
      .filter((item) =>
        aiHosts.has(item.dimensions?.refererHost?.toLowerCase() ?? ""),
      )
      .map((item) => ({
        host: item.dimensions?.refererHost ?? "",
        path: item.dimensions?.requestPath ?? "",
        visits: item.sum?.visits ?? 0,
      }))
      .sort((a, b) => b.visits - a.visits);
    return {
      status: rows.length ? "ready" : "empty",
      note: "리퍼러가 전달된 글별 방문의 합입니다. 사이트 고유 방문자·AI 답변 노출·인용 횟수는 아닙니다.",
      data: { period: { from: from.slice(0, 10), to: to.slice(0, 10) }, rows },
    };
  } catch (error) {
    return {
      status: "error",
      note: error instanceof Error ? error.message : "Cloudflare 조회 실패",
    };
  }
}

export async function handleDiscoveryRequest(
  request: Request,
  env: DiscoveryEnv,
): Promise<Response> {
  if (request.method !== "GET")
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  if (!(await isOpsAuthorized(request, env)))
    return Response.json({ error: "access_required" }, { status: 401 });
  const now = new Date();
  const [search, ai_visits] = await Promise.all([
    googleSearch(env, now),
    aiVisits(env, now),
  ]);
  return Response.json(
    {
      generated_at: now.toISOString(),
      search,
      ai_visits,
      google_ai: {
        status: "unconfigured",
        note: "Google 생성형 AI 보고서는 공식 내보내기 파일 연결 전입니다. 일반 검색과 합산하지 않습니다.",
      },
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
