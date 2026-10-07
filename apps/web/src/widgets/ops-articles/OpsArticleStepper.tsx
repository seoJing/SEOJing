"use client";

import { useEffect, useState } from "react";

type ArticleRef = { slug: string; updatedAt: string };

export function OpsArticleStepper({ slug }: { slug: string }) {
  const [articles, setArticles] = useState<ArticleRef[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ops/articles", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as {
          ok?: boolean;
          articles?: ArticleRef[];
        };
        if (response.ok && body.ok && Array.isArray(body.articles)) {
          setArticles(
            body.articles.sort(
              (a, b) =>
                b.updatedAt.localeCompare(a.updatedAt) ||
                a.slug.localeCompare(b.slug),
            ),
          );
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const index = articles.findIndex((item) => item.slug === slug);
  if (index < 0) return null;
  const previous = articles[index - 1];
  const next = articles[index + 1];
  return (
    <nav
      aria-label="글 간 이동"
      className="mt-4 flex items-center justify-between gap-3 text-sm"
    >
      {previous ? (
        <a
          className="rounded-lg border border-zinc-300 px-3 py-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          href={`/ops/articles/edit?slug=${encodeURIComponent(previous.slug)}`}
        >
          ← 이전 글
        </a>
      ) : (
        <span />
      )}
      <span className="text-zinc-500">
        {index + 1} / {articles.length}
      </span>
      {next ? (
        <a
          className="rounded-lg border border-zinc-300 px-3 py-2 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          href={`/ops/articles/edit?slug=${encodeURIComponent(next.slug)}`}
        >
          다음 글 →
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}
