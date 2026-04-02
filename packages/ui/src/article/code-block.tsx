"use client";

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  IoClipboardOutline,
  IoCheckmark,
  IoExpand,
  IoChevronDown,
  IoChevronForward,
} from "react-icons/io5";
import { cn } from "@app/utils";
import { IconButton } from "../icon-button";
import type { CodeBlockProps } from "./article.types";

/** HTML 태그 제거 + 엔티티 디코딩 → 순수 텍스트 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

type CodeSegment =
  | { type: "visible"; html: string }
  | { type: "hidden"; html: string };

const HIDDEN_START = /\/\/\s*@hidden-start/;
const HIDDEN_END = /\/\/\s*@hidden-end/;

/** HTML을 줄 단위로 분리하여 hidden 세그먼트 추출 */
function processHiddenSections(html: string): CodeSegment[] {
  const lines = html.split("\n");
  const segments: CodeSegment[] = [];
  let currentLines: string[] = [];
  let inHidden = false;

  const flush = (type: "visible" | "hidden") => {
    if (currentLines.length === 0) return;
    segments.push({ type, html: currentLines.join("\n") });
    currentLines = [];
  };

  for (const line of lines) {
    const text = stripHtmlTags(line);

    if (HIDDEN_START.test(text)) {
      flush("visible");
      inHidden = true;
      continue;
    }

    if (HIDDEN_END.test(text)) {
      flush("hidden");
      inHidden = false;
      continue;
    }

    currentLines.push(line);
  }

  flush(inHidden ? "hidden" : "visible");
  return segments;
}

const LONG_PRESS_MS = 1500;

export function FullscreenView({
  language,
  onClose,
  children,
  rotate,
  zIndex = 50,
}: {
  language?: string;
  onClose: () => void;
  children: ReactNode;
  rotate?: boolean;
  zIndex?: number;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressing, setPressing] = useState(false);

  const [shouldRotate] = useState(() => {
    if (rotate != null) return rotate;
    if (typeof window === "undefined") return false;
    const short = Math.min(window.innerWidth, window.innerHeight);
    return short <= 768 && window.innerHeight > window.innerWidth;
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const handlePressStart = useCallback(() => {
    setPressing(true);
    timerRef.current = setTimeout(() => {
      setPressing(false);
      onClose();
    }, LONG_PRESS_MS);
  }, [onClose]);

  const handlePressEnd = useCallback(() => {
    setPressing(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const rotateStyle = shouldRotate
    ? ({
        width: "100dvh",
        height: "100dvw",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%) rotate(90deg)",
      } as const)
    : undefined;

  return (
    <div
      className="fixed inset-0 bg-gray-900"
      style={{ zIndex }}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressEnd}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
    >
      <div
        className={`flex flex-col ${shouldRotate ? "absolute" : "h-full"}`}
        style={rotateStyle}
      >
        <pre className="flex-1 flex flex-col overflow-auto bg-gray-900 p-6 text-base leading-7 text-gray-100 md:py-32 md:px-[25dvw] md:text-2xl md:leading-8 [&>code]:my-auto [&>code]:mx-auto">
          {children}
        </pre>

        <div className="flex shrink-0 items-center justify-between bg-gray-800 px-4 py-2">
          <span className="text-xs md:text-lg font-medium tracking-wide text-gray-400 uppercase">
            {language}
          </span>
          <div className="flex gap-4 shrink-0 items-center justify-between bg-gray-800 px-4 py-2">
            <span className="text-xs text-gray-500 md:text-lg">
              {pressing
                ? "놓지 마세요..."
                : `화면을 ${LONG_PRESS_MS / 1000}초간 누르면 종료`}
            </span>
            <button
              type="button"
              className="text-xs md:text-lg text-gray-400 transition-colors hover:text-gray-200"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={onClose}
            >
              닫기 (ESC)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 코드 블록을 렌더링한다.
 *
 * - `code` prop: HTML 문자열 모드 (shiki 등 하이라이터 출력)
 * - `children` prop: React 노드 모드 (MDX 코드 블록)
 *
 * 두 가지 모드 모두 복사/전체보기 기능을 지원하며,
 * 코드 가리기(hidden sections)는 `code` 모드에서만 동작한다.
 */
export function CodeBlock({
  code,
  language,
  plainText,
  className,
  children,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [revealedSections, setRevealedSections] = useState<Set<number>>(
    new Set(),
  );
  const codeRef = useRef<HTMLElement>(null);

  const isHtmlMode = code != null;

  const textContent = useMemo(() => {
    if (plainText) return plainText;
    if (isHtmlMode) return stripHtmlTags(code);
    return "";
  }, [plainText, isHtmlMode, code]);

  const segments = useMemo(
    () => (isHtmlMode ? processHiddenSections(code) : []),
    [isHtmlMode, code],
  );
  const hasHidden = segments.some((s) => s.type === "hidden");

  const handleCopy = useCallback(async () => {
    let text = textContent;
    if (!text && codeRef.current) {
      text = codeRef.current.textContent ?? "";
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [textContent]);

  const toggleReveal = useCallback((index: number) => {
    setRevealedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const renderCodeBody = (): ReactNode => {
    if (!isHtmlMode) {
      return (
        <code ref={codeRef} className="font-mono">
          {children}
        </code>
      );
    }

    if (!hasHidden) {
      return (
        <code
          ref={codeRef}
          className="font-mono"
          dangerouslySetInnerHTML={{ __html: code }}
        />
      );
    }

    return (
      <code ref={codeRef} className="font-mono">
        {segments.map((segment, i) => {
          if (segment.type === "visible") {
            return (
              <span
                key={i}
                dangerouslySetInnerHTML={{ __html: segment.html }}
              />
            );
          }

          const isRevealed = revealedSections.has(i);
          return (
            <span key={i} className="block">
              <button
                type="button"
                onClick={() => toggleReveal(i)}
                className="my-1 flex w-full items-center gap-2 rounded bg-gray-800/60 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-700/80 hover:text-gray-400"
              >
                {isRevealed ? (
                  <IoChevronDown className="size-3 shrink-0" />
                ) : (
                  <IoChevronForward className="size-3 shrink-0" />
                )}
                <span>클릭하여 코드 보기</span>
              </button>
              {isRevealed && (
                <span dangerouslySetInnerHTML={{ __html: segment.html }} />
              )}
            </span>
          );
        })}
      </code>
    );
  };

  const renderFullscreenCode = (): ReactNode => {
    if (!isHtmlMode) {
      return <code className="font-mono">{children}</code>;
    }
    return (
      <code className="font-mono" dangerouslySetInnerHTML={{ __html: code }} />
    );
  };

  return (
    <div className="my-8" data-code-block>
      {language && (
        <div className="flex items-center rounded-t-lg bg-gray-800 px-4 py-2 dark:bg-gray-900">
          <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">
            {language}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <IconButton
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              aria-label="전체보기"
              onClick={() => setFullscreenOpen(true)}
            >
              <IoExpand className="size-3.5" />
            </IconButton>

            <IconButton
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              aria-label="코드 복사"
              onClick={handleCopy}
            >
              {copied ? (
                <IoCheckmark className="size-3.5" />
              ) : (
                <IoClipboardOutline className="size-3.5" />
              )}
            </IconButton>
          </div>
        </div>
      )}

      <pre
        className={cn(
          "overflow-x-auto bg-gray-900 p-4 text-sm leading-6 text-gray-100 dark:bg-gray-950",
          language ? "rounded-b-lg" : "rounded-lg",
          className,
        )}
        {...props}
      >
        {renderCodeBody()}
      </pre>

      {fullscreenOpen &&
        createPortal(
          <FullscreenView
            language={language}
            onClose={() => setFullscreenOpen(false)}
          >
            {renderFullscreenCode()}
          </FullscreenView>,
          document.body,
        )}
    </div>
  );
}
