"use client";

import { useEffect, useState } from "react";

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
type Report = {
  generated_at: string;
  search: Source<{
    period: { from: string; to: string };
    daily: SearchRow[];
    queries: SearchRow[];
    pages: SearchRow[];
  }>;
  ai_visits: Source<{
    period: { from: string; to: string };
    rows: Array<{ host: string; path: string; visits: number }>;
  }>;
  google_ai: Source<never>;
};

const number = (value: number) => new Intl.NumberFormat("ko-KR").format(value);

function sourceNote(status: Source<unknown>) {
  if (status.status === "unconfigured")
    return status.note ?? "데이터 연결 전입니다.";
  if (status.status === "error")
    return `조회 실패: ${status.note ?? "원인을 확인해 주세요."}`;
  if (status.status === "empty")
    return "연결됐지만 해당 기간의 데이터가 아직 없습니다.";
  return status.note ?? "";
}

function totals(rows: SearchRow[]) {
  return rows.reduce(
    (total, row) => ({
      clicks: total.clicks + row.clicks,
      impressions: total.impressions + row.impressions,
    }),
    { clicks: 0, impressions: 0 },
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs text-zinc-500">{detail}</p>}
    </div>
  );
}

export default function OpsDiscoveryPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/ops/discovery", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`발견 API 응답 ${response.status}`);
        return response.json() as Promise<Report>;
      })
      .then((value) => {
        if (active) setReport(value);
      })
      .catch((reason) => {
        if (active) setError(String(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  const daily = report?.search.data?.daily ?? [];
  const search = report?.search;
  const period = search?.data?.period;
  const current28 = totals(
    daily.filter(
      (row) =>
        period && row.keys[0]! >= period.from && row.keys[0]! <= period.to,
    ),
  );
  const previous28 = totals(
    daily.filter((row) => period && row.keys[0]! < period.from),
  );
  const sevenDayStart = period ? new Date(`${period.to}T00:00:00Z`) : null;
  sevenDayStart?.setUTCDate(sevenDayStart.getUTCDate() - 6);
  const previousSevenStart = period ? new Date(`${period.to}T00:00:00Z`) : null;
  previousSevenStart?.setUTCDate(previousSevenStart.getUTCDate() - 13);
  const current7 = totals(
    daily.filter(
      (row) =>
        period &&
        sevenDayStart &&
        row.keys[0]! >= sevenDayStart.toISOString().slice(0, 10) &&
        row.keys[0]! <= period.to,
    ),
  );
  const previous7 = totals(
    daily.filter(
      (row) =>
        period &&
        sevenDayStart &&
        previousSevenStart &&
        row.keys[0]! >= previousSevenStart.toISOString().slice(0, 10) &&
        row.keys[0]! < sevenDayStart.toISOString().slice(0, 10),
    ),
  );
  const queryRows = (search?.data?.queries ?? [])
    .filter((row) => row.keys[0]?.toLowerCase().includes(filter.toLowerCase()))
    .slice(0, 30);
  const pageRows = (search?.data?.pages ?? [])
    .filter((row) => row.keys[0]?.toLowerCase().includes(filter.toLowerCase()))
    .slice(0, 30);

  if (error && !report) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-zinc-950 dark:text-zinc-50">
        <h1 className="text-3xl font-bold">SEOJing 발견 분석</h1>
        <p className="mt-5 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          발견 데이터를 가져오지 못했습니다: {error}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-zinc-950 dark:text-zinc-50">
      <header className="rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/70 md:p-8">
        <p className="text-sm font-medium text-zinc-500">
          Internal ops · 검색·AI 발견
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
          SEOJing 발견 분석
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          검색 노출·클릭, Google 생성형 AI 노출, AI 서비스에서 온 실제 방문을
          서로 다른 출처의 지표로 봅니다. 합계로 섞지 않습니다.
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          {report
            ? `마지막 조회 ${new Date(report.generated_at).toLocaleString("ko-KR")}`
            : error || "데이터를 확인하는 중입니다."}
        </p>
      </header>

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/70 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Google 일반 검색</h2>
            <p className="mt-1 text-sm text-zinc-500">
              출처: Search Console ·{" "}
              {period ? `${period.from} ~ ${period.to}` : "기간 미확인"} · 완결
              데이터
            </p>
          </div>
          {search?.status === "ready" && (
            <input
              aria-label="검색어 또는 글 필터"
              className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
              placeholder="검색어·글 필터"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          )}
        </div>
        {search?.status === "ready" ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="28일 클릭"
                value={number(current28.clicks)}
                detail={`전기 ${number(previous28.clicks)}`}
              />
              <Metric
                label="28일 노출"
                value={number(current28.impressions)}
                detail={`전기 ${number(previous28.impressions)}`}
              />
              <Metric
                label="7일 클릭"
                value={number(current7.clicks)}
                detail={`직전 7일 ${number(previous7.clicks)}`}
              />
              <Metric
                label="28일 CTR"
                value={
                  current28.impressions
                    ? `${((current28.clicks / current28.impressions) * 100).toFixed(1)}%`
                    : "—"
                }
                detail="클릭 ÷ 노출"
              />
            </div>
            <div className="mt-6">
              <h3 className="font-semibold">일별 클릭·노출 추이</h3>
              <div
                className="mt-3 flex h-28 items-end gap-1 overflow-x-auto"
                aria-label="최근 28일 검색 클릭 추이"
              >
                {daily
                  .filter((row) => period && row.keys[0]! >= period.from)
                  .map((row) => (
                    <div
                      key={row.keys[0]}
                      title={`${row.keys[0]} · 클릭 ${row.clicks} · 노출 ${row.impressions}`}
                      className="min-w-2 flex-1 rounded-t bg-zinc-900 dark:bg-zinc-200"
                      style={{
                        height: `${Math.max(4, (row.clicks / Math.max(1, ...daily.map((day) => day.clicks))) * 100)}%`,
                      }}
                    />
                  ))}
              </div>
            </div>
            <div className="mt-7 grid gap-6 lg:grid-cols-2">
              <DataTable title="상위 검색어" rows={queryRows} />
              <DataTable title="상위 글" rows={pageRows} />
            </div>
          </>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm dark:border-zinc-700">
            {search ? sourceNote(search) : "조회 중입니다."}
          </p>
        )}
        {search?.note && search.status === "ready" && (
          <p className="mt-4 text-xs text-zinc-500">{search.note}</p>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/70">
          <h2 className="text-2xl font-semibold">Google 생성형 AI 노출</h2>
          <p className="mt-2 text-sm text-zinc-500">
            출처: Search Console 생성형 AI 보고서 · 일반 검색과 별도
          </p>
          <p className="mt-5 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm dark:border-zinc-700">
            {report ? sourceNote(report.google_ai) : "조회 중입니다."}
          </p>
        </section>
        <section className="rounded-3xl border border-zinc-200 bg-white/80 p-6 dark:border-zinc-800 dark:bg-zinc-950/70">
          <h2 className="text-2xl font-semibold">AI 서비스 유입 방문</h2>
          <p className="mt-2 text-sm text-zinc-500">
            출처: Cloudflare Web Analytics · 리퍼러가 전달된 방문만
          </p>
          {report?.ai_visits.status === "ready" ? (
            <>
              <p className="mt-5 text-3xl font-bold">
                {number(
                  report.ai_visits.data?.rows.reduce(
                    (sum, row) => sum + row.visits,
                    0,
                  ) ?? 0,
                )}{" "}
                <span className="text-sm font-normal">글별 방문 합</span>
              </p>
              <div className="mt-4 max-h-72 overflow-auto text-sm">
                {report.ai_visits.data?.rows.map((row) => (
                  <div
                    key={`${row.host}:${row.path}`}
                    className="flex justify-between gap-3 border-t border-zinc-200 py-2 dark:border-zinc-800"
                  >
                    <span className="truncate">
                      {row.host} → {row.path}
                    </span>
                    <strong>{number(row.visits)}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm dark:border-zinc-700">
              {report ? sourceNote(report.ai_visits) : "조회 중입니다."}
            </p>
          )}
          {report?.ai_visits.note && report.ai_visits.status === "ready" && (
            <p className="mt-3 text-xs text-zinc-500">
              {report.ai_visits.note}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function DataTable({ title, rows }: { title: string; rows: SearchRow[] }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-3 max-h-80 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white text-zinc-500 dark:bg-zinc-950">
            <tr>
              <th className="py-2">항목</th>
              <th>클릭</th>
              <th>노출</th>
              <th>CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.keys[0]}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="max-w-48 truncate py-2 pr-2" title={row.keys[0]}>
                  {row.keys[0]}
                </td>
                <td>{number(row.clicks)}</td>
                <td>{number(row.impressions)}</td>
                <td>{(row.ctr * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="py-4 text-sm text-zinc-500">표시할 항목이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
