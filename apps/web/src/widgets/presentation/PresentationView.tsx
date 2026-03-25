"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { IoCloseOutline, IoAddOutline, IoRemoveOutline } from "react-icons/io5";
import { FullscreenView } from "@app/ui";
import { extractSlides, getFillRatio } from "./presentation.utils";

const LONG_PRESS_MS = 1500;
const LONG_PRESS_THRESHOLD_MS = 300; // 롱프레스 판단 최소 시간
const SLIDE_PADDING_Y = 96; // PC 상하 패딩 (px)
const SLIDE_PADDING_Y_MOBILE = 96; // 모바일 상하 패딩 (py-12 = 48*2)
const BOTTOM_BAR_HEIGHT_PC = 48;
const DEFAULT_pcScale = 2;
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const SCALE_STEP = 0.2;
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
  const [pcScale, setPcScale] = useState(DEFAULT_pcScale);

  const [isMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    // 물리적 짧은 변이 768px 이하면 모바일로 판단 (orientation 무관)
    const short = Math.min(window.innerWidth, window.innerHeight);
    return short <= 768;
  });

  // portrait(세로) 상태에서만 회전 필요. 이미 landscape면 그대로 사용
  const [needsRotation] = useState(() => {
    if (typeof window === "undefined") return false;
    return isMobile && window.innerHeight > window.innerWidth;
  });

  const bottomBarHeight = isMobile
    ? BOTTOM_BAR_HEIGHT_MOBILE
    : BOTTOM_BAR_HEIGHT_PC;

  const [slides, setSlides] = useState<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!articleRef.current) return;
    // 모바일: 회전 레이아웃이므로 물리적 width가 슬라이드 높이가 됨
    // visualViewport을 우선 사용해 브라우저 UI(주소창·하단바)를 제외한 실제 영역 반영
    const vv = window.visualViewport;
    // needsRotation: 축이 뒤집힘 (물리적 width→높이, height→폭)
    const viewH = needsRotation
      ? (vv?.width ?? window.innerWidth)
      : (vv?.height ?? window.innerHeight);
    const padding = isMobile ? SLIDE_PADDING_Y_MOBILE : SLIDE_PADDING_Y;
    const available = (viewH - padding - bottomBarHeight) * getFillRatio(viewH);
    const scale = isMobile ? 1 : pcScale;
    const slideW = needsRotation
      ? (vv?.height ?? window.innerHeight) - 64
      : Math.min(window.innerWidth - 128, 1024);
    // scale 적용 시 콘텐츠는 원래 크기로 측정되므로, 가용 공간을 scale로 나눠서 전달
    setSlides(
      extractSlides(articleRef.current, available / scale, slideW / scale),
    );
  }, [articleRef, isMobile, needsRotation, bottomBarHeight, pcScale]);

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

  const containerStyle = needsRotation
    ? {
        width: "100dvh" as const,
        height: "100dvw" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%) rotate(90deg)",
      }
    : {
        width: "100%",
        height: "100%",
      };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-white dark:bg-gray-950"
      style={{ height: "100dvh" }}
    >
      <div className="absolute flex flex-col" style={containerStyle}>
        {/* 슬라이드 콘텐츠 */}
        <div
          className={`flex flex-1 items-center justify-center overflow-hidden py-12 ${isMobile ? "px-5" : "px-16"}`}
        >
          <div
            ref={slideContentRef}
            className="mx-auto w-full max-w-5xl overflow-hidden"
            style={isMobile ? undefined : { zoom: pcScale }}
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

          <div className="ml-auto flex items-center gap-1">
            {!isMobile && (
              <>
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  onClick={() => {
                    setPcScale(
                      (s) =>
                        Math.round(Math.max(MIN_SCALE, s - SCALE_STEP) * 10) /
                        10,
                    );
                    setCurrentSlide(0);
                  }}
                  disabled={pcScale <= MIN_SCALE}
                  aria-label="축소"
                >
                  <IoRemoveOutline className="size-4" />
                </button>
                <span className="min-w-[3ch] text-center text-xs tabular-nums text-gray-500">
                  {pcScale.toFixed(1)}
                </span>
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  onClick={() => {
                    setPcScale(
                      (s) =>
                        Math.round(Math.min(MAX_SCALE, s + SCALE_STEP) * 10) /
                        10,
                    );
                    setCurrentSlide(0);
                  }}
                  disabled={pcScale >= MAX_SCALE}
                  aria-label="확대"
                >
                  <IoAddOutline className="size-4" />
                </button>
                <button
                  type="button"
                  className="ml-1 flex size-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  onClick={onClose}
                  aria-label="프레젠테이션 종료"
                >
                  <IoCloseOutline className="size-5" />
                </button>
              </>
            )}
            {isMobile && <span className="w-7" />}
          </div>
        </div>
      </div>

      {/* 전체화면 코드 뷰어 */}
      {fullscreenCode &&
        createPortal(
          <FullscreenView
            language={fullscreenCode.language}
            onClose={() => setFullscreenCode(null)}
            rotate={false}
          >
            <code
              className="font-mono"
              dangerouslySetInnerHTML={{ __html: fullscreenCode.html }}
            />
          </FullscreenView>,
          document.body,
        )}
    </div>,
    document.body,
  );
}
