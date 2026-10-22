"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateOnly } from "@app/utils";

type ArticleRow = {
  slug: string;
  title: string;
  category: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sourceFormat: "MDX" | "BLOCKS" | "DOCUMENT";
  updatedAt: string;
};
type Result = {
  slug: string;
  ok: boolean;
  error?: string;
  retryAction?: string;
};
const PAGE_SIZE = 20;
const statusLabels = { DRAFT: "비공개", PUBLISHED: "공개", ARCHIVED: "보관" };
const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";
const buttonClass = "rounded-lg border px-3 py-2 text-sm disabled:opacity-40";

export function OpsArticleList() {
  const [rows, setRows] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [format, setFormat] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [failures, setFailures] = useState<Result[]>([]);
  const selectAll = useRef<HTMLInputElement>(null);

  async function load(signal?: AbortSignal) {
    const response = await fetch("/api/ops/articles", {
      cache: "no-store",
      signal,
    });
    const result = (await response.json()) as {
      ok?: boolean;
      articles?: ArticleRow[];
      results?: Result[];
      error?: string;
    };
    if (!response.ok || !result.ok || !Array.isArray(result.articles))
      throw new Error(result.error ?? "목록 조회 실패");
    return result.articles;
  }
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((articles) => {
        if (!controller.signal.aborted) setRows(articles);
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
            (format === "all" || row.sourceFormat === format) &&
            (category === "all" || row.category === category) &&
            `${row.title} ${row.slug} ${row.category ?? ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .sort(
          (a, b) =>
            b.updatedAt.localeCompare(a.updatedAt) ||
            a.slug.localeCompare(b.slug),
        ),
    [rows, status, format, category, query],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount);
  const visible = filtered.slice(
    (visiblePage - 1) * PAGE_SIZE,
    visiblePage * PAGE_SIZE,
  );
  const selectedVisible = visible.filter((row) =>
    selected.has(row.slug),
  ).length;
  useEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate =
        selectedVisible > 0 && selectedVisible < visible.length;
  }, [selectedVisible, visible.length]);
  const reset = () => {
    setPage(1);
    setSelected(new Set());
    setFailures([]);
    setProgress("");
  };
  const changePage = (value: number) => {
    setPage(value);
    setSelected(new Set());
  };
  const scope = {
    ...(category !== "all" ? { category } : {}),
    ...(status !== "all" ? { status } : {}),
    ...(format !== "all" ? { format } : {}),
    ...(query.trim() ? { query: query.trim() } : {}),
  };

  async function mutate(action: "bulkPublish" | "bulkUnpublish") {
    // Snapshot only explicit IDs still visible under the current filters.
    const slugs = filtered
      .filter((row) => selected.has(row.slug))
      .map((row) => row.slug);
    if (!slugs.length || busy) return;
    if (
      !window.confirm(
        action === "bulkUnpublish"
          ? `선택한 ${slugs.length}개 글을 비공개로 전환할까요? 공개 목록과 글에서 숨겨집니다.`
          : `선택한 ${slugs.length}개 글의 저장된 최신 수정본을 공개할까요?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setFailures([]);
    const results: Result[] = [];
    try {
      for (let offset = 0; offset < slugs.length; offset += PAGE_SIZE) {
        const batch = slugs.slice(offset, offset + PAGE_SIZE);
        setProgress(`${offset} / ${slugs.length} 처리 중…`);
        try {
          const response = await fetch("/api/ops/articles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action, slugs: batch, scope }),
          });
          const result = (await response.json()) as {
            ok?: boolean;
            articles?: ArticleRow[];
            results?: Result[];
            error?: string;
          };
          if (!response.ok || !Array.isArray(result.results))
            throw new Error(result.error ?? "처리 결과 확인 실패");
          for (const slug of batch)
            results.push(
              result.results.find((item: Result) => item.slug === slug) ?? {
                slug,
                ok: false,
                error: "처리 결과 누락",
                retryAction: "reconcileVisibility",
              },
            );
        } catch {
          results.push(
            ...batch.map((slug) => ({
              slug,
              ok: false,
              error: "서버 결과를 확인할 수 없습니다. 상태를 확인하세요.",
              retryAction: "reconcileVisibility",
            })),
          );
          // Do not continue sending additional batches after a transport failure.
          results.push(
            ...slugs.slice(offset + PAGE_SIZE).map((slug) => ({
              slug,
              ok: false,
              error: "아직 처리하지 않았습니다.",
            })),
          );
          break;
        }
      }
      setFailures(results.filter((result) => !result.ok));
      setProgress(
        `${results.filter((result) => result.ok).length} / ${slugs.length} 완료`,
      );
      setSelected(new Set());
      setRows(await load());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "목록 새로고침 실패");
    } finally {
      setBusy(false);
    }
  }
  async function reconcile(slug: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reconcileVisibility", slug }),
      });
      if (!response.ok || !((await response.json()) as { ok?: boolean }).ok)
        throw new Error("상태 확인 실패. 다시 시도하세요.");
      setFailures((value) => value.filter((item) => item.slug !== slug));
      setRows(await load());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "상태 확인 실패");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-busy={busy || loading}
      className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-6"
    >
      <fieldset
        disabled={busy}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="text-sm font-medium">
          검색
          <input
            aria-label="글 검색"
            maxLength={200}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              reset();
            }}
            placeholder="제목, slug 또는 카테고리"
            className={inputClass}
          />
        </label>
        <label className="text-sm font-medium">
          카테고리
          <select
            aria-label="카테고리 필터"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              reset();
            }}
            className={inputClass}
          >
            <option value="all">전체</option>
            {[...new Set(rows.map((row) => row.category).filter(Boolean))]
              .sort()
              .map((value) => (
                <option key={value}>{value}</option>
              ))}
          </select>
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
            <option value="DOCUMENT">CMS 문서</option>
            <option value="BLOCKS">기존 CMS 블록</option>
            <option value="MDX">이전 형식</option>
          </select>
        </label>
      </fieldset>
      {loading ? <p className="mt-5 text-sm">글 목록 불러오는 중…</p> : null}
      {error ? (
        <p role="alert" className="mt-5 text-sm text-rose-600">
          {error}
        </p>
      ) : null}
      <p role="status" className="mt-3 text-sm">
        {progress}
      </p>
      {failures.length ? (
        <ul aria-label="처리 실패" className="my-3 text-sm text-rose-700">
          {failures.map((item) => (
            <li key={item.slug}>
              {item.slug}: {item.error}{" "}
              {item.retryAction ? (
                <button
                  disabled={busy}
                  className={buttonClass}
                  onClick={() => void reconcile(item.slug)}
                >
                  공개 상태 확인 · {item.slug}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!loading ? (
        <>
          <p className="mt-4 text-sm text-zinc-500">
            {filtered.length}개 글 · 최근 수정일 순
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span role="status">{selected.size}개 선택</span>
            <button
              className={buttonClass}
              disabled={busy || !filtered.length}
              onClick={() =>
                setSelected(new Set(filtered.map((row) => row.slug)))
              }
            >
              현재 필터 전체 {filtered.length}개 선택
            </button>
            <button
              className={buttonClass}
              disabled={busy || !selected.size}
              onClick={() => setSelected(new Set())}
            >
              선택 해제
            </button>
            <button
              className={buttonClass}
              disabled={busy || !selected.size}
              onClick={() => void mutate("bulkPublish")}
            >
              선택 공개
            </button>
            <button
              className={buttonClass}
              disabled={busy || !selected.size}
              onClick={() => void mutate("bulkUnpublish")}
            >
              선택 비공개
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            체크박스는 현재 페이지를 선택합니다. 필터 또는 페이지를 바꾸면
            선택이 해제됩니다.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead className="border-b text-zinc-500">
                <tr>
                  <th className="px-3 py-3" scope="col">
                    <input
                      ref={selectAll}
                      type="checkbox"
                      aria-label="현재 페이지 전체 선택"
                      disabled={busy || !visible.length}
                      checked={
                        visible.length > 0 && selectedVisible === visible.length
                      }
                      onChange={(event) =>
                        setSelected((previous) => {
                          const next = new Set(previous);
                          for (const row of visible) {
                            if (event.target.checked) next.add(row.slug);
                            else next.delete(row.slug);
                          }
                          return next;
                        })
                      }
                    />
                  </th>
                  <th scope="col">#</th>
                  <th scope="col">제목</th>
                  <th scope="col">수정일</th>
                  <th scope="col">서버 상태</th>
                  <th scope="col">형식</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr
                    key={row.slug}
                    className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`${row.title || row.slug} 선택`}
                        disabled={busy}
                        checked={selected.has(row.slug)}
                        onChange={(event) =>
                          setSelected((previous) => {
                            const next = new Set(previous);
                            if (event.target.checked) next.add(row.slug);
                            else next.delete(row.slug);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="px-2">
                      {(visiblePage - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <a
                        className="block font-medium hover:underline"
                        href={`/ops/articles/edit?slug=${encodeURIComponent(row.slug)}`}
                      >
                        {row.title || row.slug}
                        <span className="mt-1 block text-xs font-normal text-zinc-500">
                          {row.slug} · {row.category}
                        </span>
                      </a>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap tabular-nums">
                      <time dateTime={row.updatedAt}>
                        {formatDateOnly(row.updatedAt)}
                      </time>
                    </td>
                    <td className="px-3 py-3">{statusLabels[row.status]}</td>
                    <td className="px-3 py-3">
                      {row.sourceFormat === "DOCUMENT"
                        ? "CMS 문서"
                        : row.sourceFormat === "BLOCKS"
                          ? "기존 블록"
                          : "이전 형식"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length ? (
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
              disabled={busy || visiblePage === 1}
              className={buttonClass}
              onClick={() => changePage(visiblePage - 1)}
            >
              이전
            </button>
            <span>
              {visiblePage} / {pageCount}
            </span>
            <button
              type="button"
              disabled={busy || visiblePage === pageCount}
              className={buttonClass}
              onClick={() => changePage(visiblePage + 1)}
            >
              다음
            </button>
          </nav>
        </>
      ) : null}
    </section>
  );
}
