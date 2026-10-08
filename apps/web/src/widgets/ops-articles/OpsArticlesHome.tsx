"use client";

import { useState } from "react";
import { OpsArticleList } from "./OpsArticleList";
import { MdxReviewQueue } from "./MdxReviewQueue";

export function OpsArticlesHome() {
  const [tab, setTab] = useState<"articles" | "review">("articles");
  return (
    <>
      <nav
        aria-label="글 운영 보기"
        className="mb-4 flex gap-2 border-b border-zinc-200 dark:border-zinc-800"
      >
        <button
          type="button"
          aria-current={tab === "articles" ? "page" : undefined}
          onClick={() => setTab("articles")}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === "articles" ? "border-zinc-950 dark:border-zinc-50" : "border-transparent text-zinc-500"}`}
        >
          전체 글
        </button>
        <button
          type="button"
          aria-current={tab === "review" ? "page" : undefined}
          onClick={() => setTab("review")}
          className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === "review" ? "border-zinc-950 dark:border-zinc-50" : "border-transparent text-zinc-500"}`}
        >
          검토 대기열
        </button>
      </nav>
      {tab === "articles" ? (
        <OpsArticleList />
      ) : (
        <MdxReviewQueue selectedSlug="" />
      )}
    </>
  );
}
