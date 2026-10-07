"use client";

import { useEffect, useMemo, useState } from "react";

type ArticleRow = {
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sourceFormat: "MDX" | "BLOCKS";
  updatedAt: string;
};

const PAGE_SIZE = 20;
const statusLabels = { DRAFT: "비공개", PUBLISHED: "공개", ARCHIVED: "보관" };
const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

export function OpsArticleList() {
  const [rows, setRows] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [format, setFormat] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ops/articles", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as {
          ok?: boolean;
          articles?: ArticleRow[];
          error?: string;
        };
        if (!response.ok || !result.ok || !Array.isArray(result.articles)) {
          throw new Error(
            result.error ?? `목록 조회 실패 (${response.status})`,
          );
        }
        setRows(result.articles);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "목록 조회 실패");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            (status === "all" || row.status === status) &&
            (format === "all" || row.sourceFormat === format),
        )
        .filter((row) =>
          `${row.title} ${row.slug}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
        .sort(
          (a, b) =>
            b.updatedAt.localeCompare(a.updatedAt) ||
            a.slug.localeCompare(b.slug),
        ),
    [rows, status, format, query],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (visiblePage - 1) * PAGE_SIZE,
    visiblePage * PAGE_SIZE,
  );
  const reset = () => setPage(1);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_11rem_11rem]">
        <label className="text-sm font-medium">
          검색
          <input
            aria-label="글 검색"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              reset();
            }}
            placeholder="제목 또는 slug"
            className={inputClass}
          />
        </label>
        <label className="text-sm font-medium">
          상태
          <select
            aria-label="상태 필터"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              reset();
            }}
            className={inputClass}
          >
            <option value="all">전체</option>
            <option value="PUBLISHED">공개</option>
            <option value="DRAFT">비공개</option>
            <option value="ARCHIVED">보관</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          형식
          <select
            aria-label="형식 필터"
            value={format}
            onChange={(event) => {
              setFormat(event.target.value);
              reset();
            }}
            className={inputClass}
          >
            <option value="all">전체</option>
            <option value="MDX">MDX</option>
            <option value="BLOCKS">CMS</option>
          </select>
        </label>
      </div>
      {loading ? <p className="mt-5 text-sm">글 목록 불러오는 중…</p> : null}
      {error ? (
        <p role="alert" className="mt-5 text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      {!loading && !error ? (
        <>
          <p className="mt-4 text-sm text-zinc-500">
            {filtered.length}개 글 · 최근 수정일 순
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            MDX는 CMS에 보관된 원본 형식, CMS는 블록 형식입니다. 공개 배지는 CMS
            API 상태이며 기존 /blog MDX 경로와는 별개입니다.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th scope="col" className="w-14 px-3 py-3">
                    #
                  </th>
                  <th scope="col" className="px-3 py-3">
                    제목
                  </th>
                  <th scope="col" className="w-32 px-3 py-3">
                    수정일
                  </th>
                  <th scope="col" className="w-24 px-3 py-3">
                    CMS 공개
                  </th>
                  <th scope="col" className="w-20 px-3 py-3">
                    형식
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr
                    key={row.slug}
                    className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                    onClick={(event) => {
                      if (!(event.target as HTMLElement).closest("a"))
                        window.location.assign(
                          `/ops/articles/edit?slug=${encodeURIComponent(row.slug)}`,
                        );
                    }}
                  >
                    <td className="px-3 py-3 text-zinc-500">
                      {(visiblePage - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <a
                        className="block font-medium hover:underline"
                        href={`/ops/articles/edit?slug=${encodeURIComponent(row.slug)}`}
                      >
                        {row.title || row.slug}
                        <span className="mt-1 block text-xs font-normal text-zinc-500">
                          {row.slug}
                        </span>
                      </a>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.updatedAt && !Number.isNaN(Date.parse(row.updatedAt))
                        ? new Intl.DateTimeFormat("ko-KR", {
                            timeZone: "Asia/Seoul",
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          }).format(new Date(row.updatedAt))
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block rounded-full border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700">
                        {statusLabels[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
                        {row.sourceFormat === "BLOCKS" ? "CMS" : "MDX"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-zinc-500">
                조건에 맞는 글이 없습니다.
              </p>
            ) : null}
          </div>
          <nav
            aria-label="글 목록 페이지"
            className="mt-4 flex items-center justify-end gap-3 text-sm"
          >
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={visiblePage === 1}
              className="rounded-lg border px-3 py-2 disabled:opacity-40"
            >
              이전
            </button>
            <span>
              {visiblePage} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              disabled={visiblePage === pageCount}
              className="rounded-lg border px-3 py-2 disabled:opacity-40"
            >
              다음
            </button>
          </nav>
        </>
      ) : null}
    </section>
  );
}
