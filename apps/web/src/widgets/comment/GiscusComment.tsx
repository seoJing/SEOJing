"use client";

import { lazy, Suspense } from "react";
import { useTheme } from "@app/ui";
import { GISCUS_CONFIG } from "@/shared/config/giscus";

const Giscus = lazy(() => import("@giscus/react"));

/** Mounted only after the reader opens comments; no comment analytics/tracker. */
export function GiscusComment({ slug }: { slug: string }) {
  const { resolvedTheme } = useTheme();
  return (
    <div id="comments" aria-label="글 댓글">
      <p className="mb-3 text-xs text-gray-500">
        댓글은 GitHub Discussions에서 제공합니다.
      </p>
      <Suspense fallback={<p role="status">댓글을 불러오는 중…</p>}>
        <Giscus
          key={slug}
          id="article-giscus"
          repo={GISCUS_CONFIG.repo}
          repoId={GISCUS_CONFIG.repoId}
          category={GISCUS_CONFIG.category}
          categoryId={GISCUS_CONFIG.categoryId}
          mapping="specific"
          term={slug}
          strict="0"
          reactionsEnabled="1"
          emitMetadata="0"
          inputPosition="top"
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          lang="ko"
          loading="lazy"
        />
      </Suspense>
      <a
        className="text-sm underline"
        href="https://github.com/seoJing/SEOJing/discussions/categories/announcements"
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub에서 댓글 보기
      </a>
    </div>
  );
}
