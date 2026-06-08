"use client";

import { useEffect, useMemo, useState } from "react";
import type { PostQaResult } from "@/shared/rag/post-qa";

type QuestionLogEntry = {
  slug: string;
  question: string;
  status: PostQaResult["status"];
  createdAt: string;
};

interface PostQaPanelProps {
  slug: string;
  title: string;
  endpoint?: string;
  storageKey?: string;
}

const DEFAULT_ENDPOINT = "/api/rag/query";
const DEFAULT_STORAGE_KEY = "seojing_post_qa_log_v1";
const MAX_LOG_ENTRIES = 5;

type QaAnalyticsDetail = PostQaResult["analytics"]["event"];

declare global {
  interface WindowEventMap {
    "seojing:qa-interaction": CustomEvent<QaAnalyticsDetail>;
  }
}

function safeReadLog(storageKey: string): QuestionLogEntry[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QuestionLogEntry[]) : [];
  } catch {
    return [];
  }
}

function safeWriteLog(storageKey: string, entries: QuestionLogEntry[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    // Local question history is best-effort and must not break Q&A UX.
  }
}

function sourceHref(href: string, chunkId: string) {
  return `${href}#${encodeURIComponent(chunkId)}`;
}

export function PostQaPanel({
  slug,
  title,
  endpoint = DEFAULT_ENDPOINT,
  storageKey = DEFAULT_STORAGE_KEY,
}: PostQaPanelProps) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<PostQaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [log, setLog] = useState<QuestionLogEntry[]>([]);

  useEffect(() => {
    setLog(safeReadLog(storageKey).filter((entry) => entry.slug === slug));
  }, [slug, storageKey]);

  const canSubmit = useMemo(
    () =>
      question.trim().length > 0 && question.trim().length <= 500 && !pending,
    [pending, question],
  );

  const submitQuestion = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || pending) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, question: trimmedQuestion }),
      });
      if (!response.ok)
        throw new Error(`qa request failed: ${response.status}`);
      const body = (await response.json()) as PostQaResult;
      setResult(body);
      setQuestion("");

      const nextLog = [
        {
          slug,
          question: trimmedQuestion,
          status: body.status,
          createdAt: new Date().toISOString(),
        },
        ...safeReadLog(storageKey).filter(
          (entry) =>
            !(entry.slug === slug && entry.question === trimmedQuestion),
        ),
      ].slice(0, MAX_LOG_ENTRIES);
      safeWriteLog(storageKey, nextLog);
      setLog(nextLog.filter((entry) => entry.slug === slug));

      if (body.analytics?.event) {
        window.dispatchEvent(
          new CustomEvent("seojing:qa-interaction", {
            detail: body.analytics.event,
          }),
        );
      }
    } catch {
      setError(
        "질문 API가 잠시 불안정해요. 글 읽기는 그대로 가능하니 잠시 후 다시 시도해주세요.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      aria-labelledby="post-qa-title"
      className="my-10 rounded-2xl border border-gray-200 bg-white/70 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950/60"
    >
      <div className="mb-4 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
          Post Q&amp;A
        </p>
        <h2
          id="post-qa-title"
          className="text-xl font-semibold text-gray-900 dark:text-gray-100"
        >
          이 글에 대해 질문하기
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {title} 안의 섹션 인덱스를 먼저 찾고, 필요하면 관련 글 출처도 함께
          보여줘요.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="post-qa-question" className="sr-only">
          이 글에 대해 질문하기
        </label>
        <textarea
          id="post-qa-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="예: 이 섹션에서 말하는 Controller와 Service 흐름을 다시 설명해줘"
          className="w-full resize-y rounded-xl border border-gray-200 bg-background px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">
            {question.trim().length}/500
          </span>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submitQuestion}
            className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-300 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
          >
            {pending ? "답변 찾는 중..." : "질문 보내기"}
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5 space-y-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-900/70">
          <p className="whitespace-pre-wrap text-sm leading-7 text-gray-800 dark:text-gray-200">
            {result.answer}
          </p>
          {result.sources.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                출처
              </h3>
              <ul className="space-y-2">
                {result.sources.map((source) => (
                  <li
                    key={source.chunkId}
                    className="text-sm text-gray-600 dark:text-gray-300"
                  >
                    <a
                      href={sourceHref(source.href, source.chunkId)}
                      className="font-medium text-gray-900 underline underline-offset-4 dark:text-gray-100"
                    >
                      {source.heading}
                    </a>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                      {source.excerpt}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.relatedPosts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                관련 글
              </h3>
              <ul className="flex flex-wrap gap-2">
                {result.relatedPosts.map((post) => (
                  <li key={post.slug}>
                    <a
                      href={post.href}
                      className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300"
                    >
                      {post.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-5 border-t border-gray-200 pt-4 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            최근 질문 로그
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
            {log.map((entry) => (
              <li
                key={`${entry.createdAt}:${entry.question}`}
                className="line-clamp-1"
              >
                {entry.question}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
