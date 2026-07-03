"use client";

import { useEffect, useMemo, useState } from "react";
import type { PostQaResult } from "@/shared/rag/post-qa";

type SectionPrompt = {
  id: string;
  title: string;
  top: number;
};

interface SectionQaPromptsProps {
  slug: string;
  articleSelector?: string;
  endpoint?: string;
}

const MIN_SECTION_HEIGHT = 160;
const DESKTOP_QUERY = "(min-width: 1280px)";
const DEFAULT_ENDPOINT = "/api/rag/query";

/**
 * Renders small out-of-flow prompts near the end of each H2 section on desktop.
 * The MDX tree is server-rendered, so this client helper measures headings after
 * hydration instead of changing every MDX component contract.
 */
export function SectionQaPrompts({
  slug,
  articleSelector = "[data-article-content]",
  endpoint = DEFAULT_ENDPOINT,
}: SectionQaPromptsProps) {
  const [prompts, setPrompts] = useState<SectionPrompt[]>([]);
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(DESKTOP_QUERY);
    const updateDesktop = () => {
      setIsDesktop(mediaQuery.matches);
      if (!mediaQuery.matches) setPrompts([]);
    };
    mediaQuery.addEventListener("change", updateDesktop);
    return () => mediaQuery.removeEventListener("change", updateDesktop);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;

    const article = document.querySelector<HTMLElement>(articleSelector);
    if (!article) return;

    const measure = () => {
      const articleRect = article.getBoundingClientRect();
      const headings = Array.from(
        article.querySelectorAll<HTMLHeadingElement>("h2"),
      ).filter((heading) => heading.textContent?.trim());

      const nextPrompts = headings
        .map((heading, index) => {
          const headingRect = heading.getBoundingClientRect();
          const nextHeading = headings[index + 1];
          const nextTop = nextHeading
            ? nextHeading.getBoundingClientRect().top
            : article.getBoundingClientRect().bottom;
          const sectionHeight = nextTop - headingRect.top;
          if (sectionHeight < MIN_SECTION_HEIGHT) return null;

          const id = heading.id || `section-${index + 1}`;
          const title = heading.textContent?.trim() ?? "이 부분";
          return {
            id,
            title,
            top: Math.max(
              0,
              nextTop - articleRect.top - Math.min(72, sectionHeight * 0.35),
            ),
          } satisfies SectionPrompt;
        })
        .filter((prompt): prompt is SectionPrompt => prompt !== null);

      setPrompts(nextPrompts);
    };

    measure();
    window.addEventListener("resize", measure);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => measure());
    resizeObserver?.observe(article);

    return () => {
      window.removeEventListener("resize", measure);
      resizeObserver?.disconnect();
    };
  }, [articleSelector, isDesktop]);

  if (!isDesktop || prompts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 hidden xl:block">
      {prompts.map((prompt) => (
        <SectionQaPrompt
          key={prompt.id}
          prompt={prompt}
          slug={slug}
          endpoint={endpoint}
        />
      ))}
    </div>
  );
}

function SectionQaPrompt({
  prompt,
  slug,
  endpoint,
}: {
  prompt: SectionPrompt;
  slug: string;
  endpoint: string;
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PostQaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({
          slug,
          question: trimmedQuestion,
          section_id: prompt.id,
        }),
      });
      if (!response.ok) throw new Error("section qa request failed");
      setResult((await response.json()) as PostQaResult);
      setQuestion("");
    } catch {
      setError(
        "이 부분 질문을 잠시 처리하지 못했어요. 조금 뒤 다시 시도해주세요.",
      );
    } finally {
      setPending(false);
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
    <div
      style={{ top: `${prompt.top}px` }}
      className="pointer-events-auto absolute -left-[22rem] w-80"
    >
      {isFormOpen ? (
        <div className="rounded-2xl border border-gray-200 bg-white/95 p-3 text-left text-xs text-gray-700 shadow-lg backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 dark:text-gray-200">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-950 dark:text-gray-50">
                이 주제에 대한 질문
              </p>
              <p className="mt-1 text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                「{prompt.title}」 부분을 기준으로 오케이징에게 물어봐요.
              </p>
            </div>
            <button
              type="button"
              aria-label="섹션 질문 닫기"
              onClick={() => setIsFormOpen(false)}
              className="rounded-full px-1.5 py-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              ×
            </button>
          </div>
          <textarea
            aria-label={`${prompt.title} 부분에 대해 질문하기`}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={2}
            maxLength={500}
            placeholder="이 흐름이 왜 이렇게 되는지 물어보기"
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-900 outline-none transition focus:border-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[10px] text-gray-400">
              {question.trim().length}/500
            </span>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={submitQuestion}
              className="rounded-full bg-gray-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-300 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
            >
              {pending ? "답 찾는 중..." : "묻기"}
            </button>
          </div>
          {error ? (
            <p
              role="alert"
              className="mt-2 text-[11px] text-red-600 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}
          {result ? (
            <div className="mt-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/70">
              <p className="whitespace-pre-wrap text-[11px] leading-5 text-gray-700 dark:text-gray-200">
                {result.answer}
              </p>
              <button
                type="button"
                onClick={openComments}
                className="mt-2 text-[11px] font-semibold text-gray-900 underline underline-offset-4 dark:text-gray-100"
              >
                이 내용을 댓글로 달아서 서징에게도 물어볼까요?
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="group ml-auto flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white/95 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:w-64 hover:px-4 hover:text-gray-950 hover:shadow-md dark:border-gray-800 dark:bg-gray-950/95 dark:text-gray-200 dark:hover:text-gray-50"
          aria-label="이 부분에 대해 질문하기"
        >
          <span className="hidden whitespace-nowrap text-xs group-hover:inline-flex">
            이 부분에 대해 질문하기
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
