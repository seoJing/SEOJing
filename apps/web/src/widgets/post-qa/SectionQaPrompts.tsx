"use client";

import { useEffect, useState } from "react";

type SectionPrompt = {
  id: string;
  title: string;
  top: number;
};

interface SectionQaPromptsProps {
  articleSelector?: string;
}

const MIN_SECTION_HEIGHT = 160;

/**
 * Renders small out-of-flow prompts near the end of each H2 section.
 * The MDX tree is server-rendered, so this client helper measures headings after
 * hydration instead of changing every MDX component contract.
 */
export function SectionQaPrompts({
  articleSelector = "[data-article-content]",
}: SectionQaPromptsProps) {
  const [prompts, setPrompts] = useState<SectionPrompt[]>([]);

  useEffect(() => {
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
  }, [articleSelector]);

  if (prompts.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 hidden xl:block">
      {prompts.map((prompt) => (
        <button
          key={prompt.id}
          type="button"
          onClick={() => openSectionQa(prompt.title)}
          style={{ top: `${prompt.top}px` }}
          className="pointer-events-auto absolute -left-64 flex w-56 items-center justify-between gap-3 rounded-full border border-gray-200 bg-white/95 px-4 py-2 text-left text-xs font-semibold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-400 hover:text-gray-950 hover:shadow-md dark:border-gray-800 dark:bg-gray-950/95 dark:text-gray-200 dark:hover:border-gray-600"
        >
          <span className="line-clamp-1">이 부분에 대해 질문하기</span>
          <span aria-hidden="true">→</span>
        </button>
      ))}
    </div>
  );
}

function openSectionQa(sectionTitle: string) {
  window.dispatchEvent(
    new CustomEvent("seojing:qa-context", {
      detail: { sectionTitle },
    }),
  );
}
