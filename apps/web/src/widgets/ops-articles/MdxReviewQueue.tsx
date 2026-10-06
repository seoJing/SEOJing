"use client";

import { useEffect, useMemo, useState } from "react";

import sourceEntries from "@/shared/content/mdx-migration-manifest.json";

type CmsItem = {
  slug: string;
  title: string;
  status: string;
  sourceFormat: string;
  sourceSha256: string;
};

export function MdxReviewQueue({ selectedSlug }: { selectedSlug: string }) {
  const [items, setItems] = useState<CmsItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ops/articles", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as {
          ok?: boolean;
          articles?: CmsItem[];
        };
        if (!response.ok || !payload.ok || !Array.isArray(payload.articles)) {
          throw new Error(`CMS 목록 조회 실패 (${response.status})`);
        }
        setItems(payload.articles);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "CMS 목록 조회 실패",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const rows = useMemo(() => {
    const cms = new Map(items.map((item) => [item.slug, item]));
    return sourceEntries.map((source) => {
      const item = cms.get(source.slug);
      const state = !item
        ? "미이전"
        : item.sourceSha256 !== source.sourceSha256
          ? "원문/CMS 불일치"
          : item.status === "DRAFT"
            ? "검토 대기"
            : "기존/발행";
      return { source, item, state };
    });
  }, [items]);
  const filtered = rows.filter(
    ({ source, item, state }) =>
      (filter === "all" || state === filter) &&
      `${source.slug} ${item?.title ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  return (
    <section className="sm:rounded-3xl sm:border sm:border-zinc-200 sm:bg-white/80 sm:p-5 sm:dark:border-zinc-800 sm:dark:bg-zinc-950/70">
      <h2 className="text-lg font-semibold">
        MDX → CMS 검토 대기열 ({sourceEntries.length}개)
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        원본 MDX는 그대로 유지합니다. CMS 미리보기는 컴포넌트가 생략될 수
        있으므로 공개 원본 화면과 직접 대조하세요. 이 목록은 검토 완료나 공개
        전환을 자동 판정하지 않습니다.
      </p>
      {loading ? <p className="mt-3 text-sm">CMS 상태 조회 중…</p> : null}
      {error ? (
        <p className="mt-3 text-sm text-red-600">
          {error} — 상태를 표시하지 않습니다.
        </p>
      ) : null}
      {!loading && !error ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              aria-label="글 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목·slug 검색"
              className="min-w-48 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
            <select
              aria-label="검토 상태"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              <option value="all">전체 ({rows.length})</option>
              {["검토 대기", "원문/CMS 불일치", "미이전", "기존/발행"].map(
                (state) => (
                  <option key={state} value={state}>
                    {state} ({rows.filter((row) => row.state === state).length})
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
            {filtered.map(({ source, item, state }) => (
              <div
                key={source.slug}
                className={`rounded-xl border p-3 text-sm dark:border-zinc-800 ${selectedSlug === source.slug ? "border-zinc-500 bg-zinc-50 dark:bg-zinc-900" : "border-zinc-200"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={`/ops/articles?slug=${encodeURIComponent(source.slug)}`}
                    className="break-all font-medium underline underline-offset-4"
                  >
                    {item?.title ?? source.slug}
                  </a>
                  <span>{state}</span>
                </div>
                <a
                  href={`/blog/${source.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs underline underline-offset-4"
                >
                  공개 원본 새 창에서 보기
                </a>
                <p className="mt-1 break-all text-xs text-zinc-500">
                  {source.slug} · {source.sourcePath}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  원문 SHA-256: {source.sourceSha256.slice(0, 12)}…
                  {source.components.length
                    ? ` · MDX 컴포넌트: ${source.components.join(", ")}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
