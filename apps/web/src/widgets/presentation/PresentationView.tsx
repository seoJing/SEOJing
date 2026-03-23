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
import { extractSlides, getFillRatio } from "./presentation.utils";

const LONG_PRESS_MS = 1500;
const LONG_PRESS_THRESHOLD_MS = 300; // 롱프레스 판단 최소 시간
const SLIDE_PADDING_Y = 96; // PC 상하 패딩 (px)
const SLIDE_PADDING_Y_MOBILE = 96; // 모바일 상하 패딩 (py-12 = 48*2)
const BOTTOM_BAR_HEIGHT_PC = 48;
const BOTTOM_BAR_HEIGHT_MOBILE = 36;

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
  const thresholdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartTime = useRef(0);
  const slideContentRef = useRef<HTMLDivElement>(null);
  const [fullscreenCode, setFullscreenCode] = useState<{
    html: string;
    language: string;
  } | null>(null);

  const [isMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });

  const bottomBarHeight = isMobile
    ? BOTTOM_BAR_HEIGHT_MOBILE
    : BOTTOM_BAR_HEIGHT_PC;

  const [slides, setSlides] = useState<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!articleRef.current) return;
    const viewH = isMobile ? window.innerWidth : window.innerHeight;
    const padding = isMobile ? SLIDE_PADDING_Y_MOBILE : SLIDE_PADDING_Y;
    const available = (viewH - padding - bottomBarHeight) * getFillRatio(viewH);
    const slideW = isMobile
      ? window.innerHeight - 64
      : Math.min(window.innerWidth - 64, 896);
    setSlides(extractSlides(articleRef.current, available, slideW));
  }, [articleRef, isMobile, bottomBarHeight]);

  const totalSlides = slides.length;
  const closingRef = useRef(false);

  const safeClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    requestAnimationFrame(() => onClose());
  }, [onClose]);

  const goToNext = useCallback(() => {
    setCurrentSlide((p) => {
      if (p >= totalSlides - 1) return p;
      return p + 1;
    });
    if (currentSlide >= totalSlides - 1) {
      safeClose();
    }
  }, [totalSlides, safeClose, currentSlide]);

  const goToPrev = useCallback(() => {
    setCurrentSlide((p) => Math.max(p - 1, 0));
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (fullscreenCode) {
          setFullscreenCode(null);
        } else {
          safeClose();
        }
        return;
      }
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goToNext();
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
  }, [safeClose, totalSlides, fullscreenCode, goToNext]);

  useEffect(() => {
    if (!slideContentRef.current || !slides[currentSlide]) return;
    slideContentRef.current.innerHTML = "";
    const slide = slides[currentSlide];
    const clonedSlide = slide.cloneNode(true) as HTMLElement;
    slideContentRef.current.appendChild(clonedSlide);

    const codeButtons = clonedSlide.querySelectorAll(
      "[data-presentation-code-fullscreen]",
    );
    const handlers: Array<() => void> = [];
    codeButtons.forEach((btn) => {
      const handler = (e: Event) => {
        e.stopPropagation();
        const codeHtml = btn.getAttribute("data-code-html") ?? "";
        const language = btn.getAttribute("data-code-language") ?? "";
        setFullscreenCode({ html: codeHtml, language });
      };
      btn.addEventListener("click", handler);
      handlers.push(() => btn.removeEventListener("click", handler));
    });

    return () => {
      handlers.forEach((cleanup) => cleanup());
    };
  }, [currentSlide, slides]);

  const handlePointerDown = useCallback(() => {
    if (!isMobile) return;
    pressStartTime.current = Date.now();

    thresholdTimerRef.current = setTimeout(() => {
      setPressing(true);
    }, LONG_PRESS_THRESHOLD_MS);

    timerRef.current = setTimeout(() => {
      setPressing(false);
      onClose();
    }, LONG_PRESS_MS);
  }, [onClose, isMobile]);

  const handlePointerUp = useCallback(
    (side: "left" | "right") => {
      if (!isMobile) return;
      setPressing(false);

      if (thresholdTimerRef.current) {
        clearTimeout(thresholdTimerRef.current);
        thresholdTimerRef.current = null;
      }
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
      if (thresholdTimerRef.current) clearTimeout(thresholdTimerRef.current);
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

  const fullscreenContainerStyle = isMobile
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
        <div
          className={`flex flex-1 items-center justify-center overflow-hidden py-12 ${isMobile ? "px-5" : "px-8"}`}
        >
          <div
            ref={slideContentRef}
            className="w-full max-w-4xl overflow-hidden"
          />
        </div>

        {/* 네비게이션 영역 (양쪽 사이드만, 가운데는 콘텐츠 클릭 가능) */}
        <div
          className="pointer-events-none absolute inset-0 flex"
          style={{ bottom: `${bottomBarHeight}px` }}
        >
          <button
            type="button"
            className="pointer-events-auto h-full w-1/4 cursor-w-resize opacity-0"
            onClick={isMobile ? undefined : goToPrev}
            onPointerDown={handlePointerDown}
            onPointerUp={() => handlePointerUp("left")}
            onPointerCancel={() => handlePointerUp("left")}
            aria-label="이전 슬라이드"
          />
          <div className="h-full w-1/2" />
          <button
            type="button"
            className="pointer-events-auto h-full w-1/4 cursor-e-resize opacity-0"
            onClick={isMobile ? undefined : goToNext}
            onPointerDown={handlePointerDown}
            onPointerUp={() => handlePointerUp("right")}
            onPointerCancel={() => handlePointerUp("right")}
            aria-label="다음 슬라이드"
          />
        </div>

        {/* 하단 바 */}
        <div
          className={`relative flex shrink-0 items-center bg-gray-100 dark:bg-gray-900 ${isMobile ? "px-4" : "px-6"}`}
          style={{ height: `${bottomBarHeight}px` }}
        >
          <span className="text-xs text-gray-500">
            {pressing
              ? "놓지 마세요..."
              : isMobile
                ? `화면을 ${LONG_PRESS_MS / 1000}초간 누르면 종료`
                : ""}
          </span>

          <span className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-gray-600 dark:text-gray-400">
            {currentSlide + 1} / {totalSlides}
          </span>

          <div className="ml-auto">
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
      </div>

      {/* 전체화면 코드 뷰어 */}
      {fullscreenCode && (
        <div className="fixed inset-0 z-60 bg-gray-900">
          <div
            className="absolute flex flex-col"
            style={fullscreenContainerStyle}
          >
            <pre className="flex-1 overflow-auto bg-gray-900 p-4 text-sm leading-6 text-gray-100">
              <code
                className="font-mono"
                dangerouslySetInnerHTML={{ __html: fullscreenCode.html }}
              />
            </pre>
            <div className="flex shrink-0 items-center justify-between bg-gray-800 px-4 py-2">
              <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                {fullscreenCode.language}
              </span>
              <button
                type="button"
                className="text-xs text-gray-400 transition-colors hover:text-gray-200"
                onClick={() => setFullscreenCode(null)}
              >
                닫기 (ESC)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
