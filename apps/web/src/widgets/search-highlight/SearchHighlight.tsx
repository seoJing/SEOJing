"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IoChevronUp, IoChevronDown, IoClose } from "react-icons/io5";
import { cn } from "@app/utils";

interface SearchHighlightProps {
  containerSelector?: string;
  onClose: () => void;
}

const MARK_CLASS = "search-highlight";
const MARK_ACTIVE_CLASS = "search-highlight-active";

/**
 * 페이지 내 텍스트 검색 + 하이라이트 UI. DOM TreeWalker로 텍스트 노드를 탐색한다.
 *
 * @example
 * ```tsx
 * <SearchHighlight containerSelector="main" onClose={() => setOpen(false)} />
 * ```
 */
export function SearchHighlight({
  containerSelector = "main",
  onClose,
}: SearchHighlightProps) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<HTMLElement[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const clearHighlights = useCallback(() => {
    const marks = document.querySelectorAll(`mark.${MARK_CLASS}`);
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(
        document.createTextNode(mark.textContent ?? ""),
        mark,
      );
      parent.normalize();
    });
  }, []);

  const highlightMatches = useCallback(
    (keyword: string) => {
      clearHighlights();

      if (!keyword.trim()) {
        setMatches([]);
        setActiveIndex(0);
        return;
      }

      const container = document.querySelector(containerSelector);
      if (!container) return;

      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null,
      );

      const textNodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        textNodes.push(node as Text);
      }

      const marks: HTMLElement[] = [];
      const lowerKeyword = keyword.toLowerCase();

      for (const textNode of textNodes) {
        const text = textNode.textContent ?? "";
        const lowerText = text.toLowerCase();
        if (!lowerText.includes(lowerKeyword)) continue;

        const parent = textNode.parentNode;
        if (!parent) continue;

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        let idx = lowerText.indexOf(lowerKeyword, lastIndex);
        while (idx !== -1) {
          if (idx > lastIndex) {
            fragment.appendChild(
              document.createTextNode(text.slice(lastIndex, idx)),
            );
          }
          const mark = document.createElement("mark");
          mark.className = MARK_CLASS;
          mark.textContent = text.slice(idx, idx + keyword.length);
          fragment.appendChild(mark);
          marks.push(mark);

          lastIndex = idx + keyword.length;
          idx = lowerText.indexOf(lowerKeyword, lastIndex);
        }

        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        parent.replaceChild(fragment, textNode);
      }

      setMatches(marks);
      setActiveIndex(0);

      if (marks.length > 0) {
        marks[0]!.classList.add(MARK_ACTIVE_CLASS);
        marks[0]!.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [containerSelector, clearHighlights],
  );

  useEffect(() => {
    const timer = setTimeout(() => highlightMatches(query), 200);
    return () => clearTimeout(timer);
  }, [query, highlightMatches]);

  useEffect(() => {
    return () => clearHighlights();
  }, [clearHighlights]);

  const goTo = useCallback(
    (direction: "prev" | "next") => {
      if (matches.length === 0) return;

      matches[activeIndex]?.classList.remove(MARK_ACTIVE_CLASS);

      let next: number;
      if (direction === "next") {
        next = (activeIndex + 1) % matches.length;
      } else {
        next = (activeIndex - 1 + matches.length) % matches.length;
      }

      matches[next]?.classList.add(MARK_ACTIVE_CLASS);
      matches[next]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveIndex(next);
    },
    [matches, activeIndex],
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        goTo(e.shiftKey ? "prev" : "next");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goTo]);

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-lg px-3 py-3",
        "border border-gray-200 dark:border-gray-700",
        "bg-paper-light dark:bg-paper-dark",
        "animate-expand-right",
      )}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="페이지 내 검색..."
        className={cn(
          "min-w-0 flex-1 bg-transparent text-sm outline-none",
          "text-gray-800 dark:text-gray-200",
          "placeholder:text-gray-400 dark:placeholder:text-gray-500",
        )}
      />

      {matches.length > 0 && (
        <span className="shrink-0 text-xs text-gray-500 whitespace-nowrap">
          {activeIndex + 1}/{matches.length}
        </span>
      )}

      <button
        type="button"
        onClick={() => goTo("prev")}
        className="shrink-0 p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
        aria-label="이전"
      >
        <IoChevronUp className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => goTo("next")}
        className="shrink-0 p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
        aria-label="다음"
      >
        <IoChevronDown className="size-4" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
        aria-label="닫기"
      >
        <IoClose className="size-4" />
      </button>
    </div>
  );
}
