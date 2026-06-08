"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PostQaResult } from "@/shared/rag/post-qa";

type QuestionLogEntry = {
  slug: string;
  question: string;
  status: PostQaResult["status"];
  createdAt: string;
};

type SectionQaContext = {
  sectionTitle: string;
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
    "seojing:open-comments": CustomEvent<{ source: "post_qa" }>;
    "seojing:qa-context": CustomEvent<SectionQaContext>;
  }
}

function safeReadLog(storageKey: string): QuestionLogEntry[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is QuestionLogEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.slug === "string" &&
        typeof entry.question === "string" &&
        ["answered", "insufficient_context", "invalid_request"].includes(
          String((entry as Partial<QuestionLogEntry>).status),
        ) &&
        typeof (entry as Partial<QuestionLogEntry>).createdAt === "string",
    );
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

function safeInternalBlogHref(href: string): string | null {
  try {
    const origin = window.location.origin;
    const url = new URL(href, origin);
    if (url.origin !== origin) return null;
    if (!url.pathname.startsWith("/blog/")) return null;
    if (url.search || url.hash) return null;
    return url.pathname;
  } catch {
    return null;
  }
}

function sourceHref(href: string, chunkId: string) {
  const safeHref = safeInternalBlogHref(href);
  return safeHref ? `${safeHref}#${encodeURIComponent(chunkId)}` : null;
}

function safeAnalyticsDetail(
  detail: PostQaResult["analytics"]["event"] | undefined,
): QaAnalyticsDetail | null {
  if (!detail) return null;
  const { action, question_length_bucket: questionLengthBucket } = detail;
  if (
    !["answer_shown", "insufficient_context", "invalid_request"].includes(
      action,
    ) ||
    !["1-40", "41-120", "121+"].includes(questionLengthBucket)
  ) {
    return null;
  }
  return { action, question_length_bucket: questionLengthBucket };
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
  const [sectionContext, setSectionContext] = useState<SectionQaContext | null>(
    null,
  );
  const requestSeq = useRef(0);
  const panelRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    requestSeq.current += 1;
    setQuestion("");
    setResult(null);
    setError(null);
    setPending(false);
    setSectionContext(null);
    setLog(safeReadLog(storageKey).filter((entry) => entry.slug === slug));
  }, [slug, storageKey]);

  useEffect(() => {
    const handleContext = (event: WindowEventMap["seojing:qa-context"]) => {
      const nextContext = event.detail;
      setSectionContext(nextContext);
      setResult(null);
      setError(null);
      window.setTimeout(() => {
        panelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        textareaRef.current?.focus();
      }, 0);
    };

    window.addEventListener("seojing:qa-context", handleContext);
    return () =>
      window.removeEventListener("seojing:qa-context", handleContext);
  }, []);

  const canSubmit = useMemo(
    () =>
      question.trim().length > 0 && question.trim().length <= 500 && !pending,
    [pending, question],
  );

  const submitQuestion = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || pending) return;
    const apiQuestion = sectionContext
      ? `[${sectionContext.sectionTitle} 부분에 대한 질문] ${trimmedQuestion}`
      : trimmedQuestion;

    requestSeq.current += 1;
    const currentRequestSeq = requestSeq.current;

    setPending(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, question: apiQuestion }),
      });
      if (!response.ok)
        throw new Error(`qa request failed: ${response.status}`);
      const body = (await response.json()) as PostQaResult;
      if (requestSeq.current !== currentRequestSeq) return;
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
      setSectionContext(null);

      const analyticsDetail = safeAnalyticsDetail(body.analytics?.event);
      if (analyticsDetail) {
        window.dispatchEvent(
          new CustomEvent("seojing:qa-interaction", {
            detail: analyticsDetail,
          }),
        );
      }
    } catch {
      if (requestSeq.current !== currentRequestSeq) return;
      setError(
        "질문 API가 잠시 불안정해요. 글 읽기는 그대로 가능하니 잠시 후 다시 시도해주세요.",
      );
    } finally {
      if (requestSeq.current === currentRequestSeq) {
        setPending(false);
      }
    }
  };

  const openComments = () => {
    window.dispatchEvent(
      new CustomEvent("seojing:open-comments", {
        detail: { source: "post_qa" },
      }),
    );
  };

  return (
    <section
      ref={panelRef}
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
          오케이징에게 물어보기
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {sectionContext
            ? `「${sectionContext.sectionTitle}」 부분을 기준으로 먼저 답해볼게요.`
            : `${title} 전체를 기준으로 질문과 피드백을 받아요.`}
          답을 본 뒤에는 이 내용을 댓글로 달아서 서징에게도 물어볼 수 있어요.
          작성자가 직접 볼 수 있어요!
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="post-qa-question" className="sr-only">
          이 글에 대해 질문하기
        </label>
        <textarea
          ref={textareaRef}
          id="post-qa-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder={
            sectionContext
              ? "예: 이 부분에서 헷갈리는 흐름을 더 쉽게 다시 설명해줘"
              : "예: 이 글 전체에서 Controller와 Service 흐름을 다시 설명해줘"
          }
          className="w-full resize-y rounded-xl border border-gray-200 bg-background px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">
            {question.trim().length}/500
          </span>
          <button
            type="button"
            aria-label="질문 보내기"
            disabled={!canSubmit}
            onClick={submitQuestion}
            className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-300 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
          >
            {pending ? "답변 찾는 중..." : "오케이징에게 묻기"}
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
                {result.sources.map((source) => {
                  const href = sourceHref(source.href, source.chunkId);
                  return (
                    <li
                      key={source.chunkId}
                      className="text-sm text-gray-600 dark:text-gray-300"
                    >
                      {href ? (
                        <a
                          href={href}
                          className="font-medium text-gray-900 underline underline-offset-4 dark:text-gray-100"
                        >
                          {source.heading}
                        </a>
                      ) : (
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {source.heading}
                        </span>
                      )}
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                        {source.excerpt}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {result.relatedPosts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                관련 글
              </h3>
              <ul className="flex flex-wrap gap-2">
                {result.relatedPosts.map((post) => {
                  const href = safeInternalBlogHref(post.href);
                  return (
                    <li key={post.slug}>
                      {href ? (
                        <a
                          href={href}
                          className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300"
                        >
                          {post.title}
                        </a>
                      ) : (
                        <span className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300">
                          {post.title}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-white/70 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">
            이 내용을 댓글로 달아서 서징에게도 물어볼까요? 작성자가 직접 볼 수
            있어요!
            <button
              type="button"
              aria-label="댓글 열기"
              onClick={openComments}
              className="ml-2 font-medium text-gray-900 underline underline-offset-4 dark:text-gray-100"
            >
              댓글로 남기기
            </button>
          </div>
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
