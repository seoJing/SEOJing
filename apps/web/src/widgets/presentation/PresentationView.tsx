"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { IoCloseOutline } from "react-icons/io5";

const LONG_PRESS_MS = 1500;
const SLIDE_PADDING_Y = 96; // PC 상하 패딩 (px)
const SLIDE_PADDING_Y_MOBILE = 96; // 모바일 상하 패딩 (py-12 = 48*2)
const BOTTOM_BAR_HEIGHT = 48; // 하단 인디케이터 높이 (px)
/** 화면 높이에 따라 채움 비율을 반환 — 큰 화면일수록 보수적으로 채움 */
function getFillRatio(viewH: number): number {
  if (viewH <= 600) return 0.92; // 작은 화면: 최대한 활용
  if (viewH <= 900) return 0.82; // 일반 노트북
  if (viewH <= 1200) return 0.72; // 데스크탑/빔프로젝터
  return 0.65; // 대형 모니터/TV
}

const SPLITTABLE_LIST_TAGS = new Set(["UL", "OL"]);

function extractSlides(
  article: HTMLElement,
  availableHeight: number,
  slideWidth: number,
): HTMLDivElement[] {
  const allChildren = Array.from(article.children);

  const chapters: Element[][] = [];
  let currentChapter: Element[] = [];

  for (const child of allChildren) {
    const tag = child.tagName.toLowerCase();

    if (
      child.classList.contains("sticky") ||
      tag === "nav" ||
      child.getAttribute("data-presentation-skip") != null
    ) {
      continue;
    }

    if (tag === "h2" && currentChapter.length > 0) {
      chapters.push(currentChapter);
      currentChapter = [];
    }

    if (tag === "hr") {
      if (currentChapter.length > 0) {
        chapters.push(currentChapter);
        currentChapter = [];
      }
      continue;
    }

    currentChapter.push(child);
  }

  if (currentChapter.length > 0) {
    chapters.push(currentChapter);
  }

  const slides: HTMLDivElement[] = [];

  const measurer = document.createElement("div");
  measurer.style.cssText = `
    position: fixed; top: -9999px; left: -9999px;
    width: ${slideWidth}px;
    visibility: hidden; pointer-events: none;
  `;
  document.body.appendChild(measurer);

  const measure = (node: Node): number => {
    measurer.innerHTML = "";
    measurer.appendChild(node.cloneNode(true));
    return measurer.firstElementChild!.getBoundingClientRect().height;
  };

  const flush = (slide: HTMLDivElement): [HTMLDivElement, number] => {
    if (slide.children.length > 0) slides.push(slide);
    return [document.createElement("div"), 0];
  };

  for (const chapter of chapters) {
    let currentSlide = document.createElement("div");
    let currentHeight = 0;

    for (const element of chapter) {
      const cloned = element.cloneNode(true) as HTMLElement;
      const elementHeight = measure(cloned);

      if (
        elementHeight > availableHeight &&
        SPLITTABLE_LIST_TAGS.has(element.tagName)
      ) {
        if (currentSlide.children.length > 0) {
          [currentSlide, currentHeight] = flush(currentSlide);
        }

        const listItems = Array.from(cloned.children);
        for (const li of listItems) {
          const liHeight = measure(li);

          if (
            currentHeight + liHeight > availableHeight &&
            currentSlide.children.length > 0
          ) {
            [currentSlide, currentHeight] = flush(currentSlide);
          }

          let listWrapper = currentSlide.querySelector(
            `:scope > ${element.tagName.toLowerCase()}:last-child`,
          );
          if (!listWrapper) {
            listWrapper = document.createElement(element.tagName.toLowerCase());
            listWrapper.className = cloned.className;
            currentSlide.appendChild(listWrapper);
          }
          listWrapper.appendChild(li.cloneNode(true));
          currentHeight += liHeight;
        }
        continue;
      }

      if (
        currentHeight + elementHeight > availableHeight &&
        currentSlide.children.length > 0
      ) {
        [currentSlide, currentHeight] = flush(currentSlide);
      }

      currentSlide.appendChild(cloned);
      currentHeight += elementHeight;
    }

    if (currentSlide.children.length > 0) {
      slides.push(currentSlide);
    }
  }

  document.body.removeChild(measurer);

  return slides;
}

interface PresentationViewProps {
  articleRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function PresentationView({
  articleRef,
  onClose,
}: PresentationViewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartTime = useRef(0);
  const slideContentRef = useRef<HTMLDivElement>(null);

  const [isMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });

  const [slides, setSlides] = useState<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!articleRef.current) return;
    const viewH = isMobile ? window.innerWidth : window.innerHeight;
    const padding = isMobile ? SLIDE_PADDING_Y_MOBILE : SLIDE_PADDING_Y;
    const available =
      (viewH - padding - BOTTOM_BAR_HEIGHT) * getFillRatio(viewH);
    const slideW = isMobile
      ? window.innerHeight - 64
      : Math.min(window.innerWidth - 64, 896);
    setSlides(extractSlides(articleRef.current, available, slideW));
  }, [articleRef, isMobile]);

  const totalSlides = slides.length;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide((p) => Math.min(p + 1, totalSlides - 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentSlide((p) => Math.max(p - 1, 0));
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, totalSlides]);

  useEffect(() => {
    if (!slideContentRef.current || !slides[currentSlide]) return;
    slideContentRef.current.innerHTML = "";
    const slide = slides[currentSlide];
    slideContentRef.current.appendChild(slide.cloneNode(true));
  }, [currentSlide, slides]);

  const goToNext = useCallback(() => {
    setCurrentSlide((p) => Math.min(p + 1, totalSlides - 1));
  }, [totalSlides]);

  const goToPrev = useCallback(() => {
    setCurrentSlide((p) => Math.max(p - 1, 0));
  }, []);

  const handlePointerDown = useCallback(() => {
    if (!isMobile) return;
    pressStartTime.current = Date.now();
    setPressing(true);
    timerRef.current = setTimeout(() => {
      setPressing(false);
      onClose();
    }, LONG_PRESS_MS);
  }, [onClose, isMobile]);

  const handlePointerUp = useCallback(
    (side: "left" | "right") => {
      if (!isMobile) return;
      setPressing(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const elapsed = Date.now() - pressStartTime.current;
      if (elapsed < LONG_PRESS_MS) {
        if (side === "left") goToPrev();
        else goToNext();
      }
    },
    [goToPrev, goToNext, isMobile],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (totalSlides === 0) return null;

  const containerStyle = isMobile
    ? {
        width: "100vh" as const,
        height: "100vw" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%) rotate(90deg)",
      }
    : {
        width: "100%",
        height: "100%",
      };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-950">
      <div className="absolute flex flex-col" style={containerStyle}>
        {/* 슬라이드 콘텐츠 */}
        <div className="flex flex-1 items-center justify-center overflow-hidden px-8 py-12">
          <div
            ref={slideContentRef}
            className="w-full max-w-4xl overflow-hidden"
          />
        </div>

        {/* 네비게이션 영역 (투명 오버레이) */}
        <div
          className="absolute inset-0 flex"
          style={{ bottom: `${BOTTOM_BAR_HEIGHT}px` }}
        >
          <button
            type="button"
            className="h-full w-1/2 cursor-w-resize opacity-0"
            onClick={isMobile ? undefined : goToPrev}
            onPointerDown={handlePointerDown}
            onPointerUp={() => handlePointerUp("left")}
            onPointerCancel={() => handlePointerUp("left")}
            aria-label="이전 슬라이드"
          />
          <button
            type="button"
            className="h-full w-1/2 cursor-e-resize opacity-0"
            onClick={isMobile ? undefined : goToNext}
            onPointerDown={handlePointerDown}
            onPointerUp={() => handlePointerUp("right")}
            onPointerCancel={() => handlePointerUp("right")}
            aria-label="다음 슬라이드"
          />
        </div>

        {/* 하단 바 */}
        <div
          className="flex shrink-0 items-center justify-between px-6 bg-gray-100 dark:bg-gray-900"
          style={{ height: `${BOTTOM_BAR_HEIGHT}px` }}
        >
          <span className="text-xs text-gray-500">
            {pressing
              ? "놓지 마세요..."
              : isMobile
                ? `화면을 ${LONG_PRESS_MS / 1000}초간 누르면 종료`
                : ""}
          </span>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {currentSlide + 1} / {totalSlides}
          </span>
          {!isMobile ? (
            <button
              type="button"
              className="flex size-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              onClick={onClose}
              aria-label="프레젠테이션 종료"
            >
              <IoCloseOutline className="size-5" />
            </button>
          ) : (
            <span className="w-7" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
