"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  IoCloseOutline,
  IoAddOutline,
  IoRemoveOutline,
  IoPhonePortraitOutline,
  IoDesktopOutline,
} from "react-icons/io5";
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
const MIN_FILL_RATIO = 0.3;
const MAX_FILL_RATIO = 1.0;
const FILL_RATIO_STEP = 0.05;

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
  const fullscreenCodeRef = useRef<{ html: string; language: string } | null>(
    null,
  );
  useEffect(() => {
    fullscreenCodeRef.current = fullscreenCode;
  });
  const [pcScale, setPcScale] = useState(DEFAULT_pcScale);
  // null이면 getFillRatio 기본값 사용, 숫자면 덮어쓰기
  const [fillRatioOverride, setFillRatioOverride] = useState<number | null>(
    null,
  );
  const [overflowing, setOverflowing] = useState(false);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    // pointer: coarse (터치 입력) 우선, 없으면 짧은 변으로 폴백
    if (window.matchMedia?.("(pointer: coarse)").matches) return true;
    const short = Math.min(window.innerWidth, window.innerHeight);
    return short <= 768;
  });

  // portrait(세로) 상태에서만 회전 필요. 이미 landscape면 그대로 사용
  const [needsRotation, setNeedsRotation] = useState(() => {
    if (typeof window === "undefined") return false;
    return isMobile && window.innerHeight > window.innerWidth;
  });

  const toggleDeviceMode = useCallback(() => {
    setIsMobile((prev) => {
      const next = !prev;
      // 모바일 모드로 전환할 때만 현재 화면 방향 기준으로 회전 여부 재계산
      if (next && typeof window !== "undefined") {
        setNeedsRotation(window.innerHeight > window.innerWidth);
      } else {
        setNeedsRotation(false);
      }
      return next;
    });
    setCurrentSlide(0);
  }, []);

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
    const ratio = fillRatioOverride ?? getFillRatio(viewH);
    const available = (viewH - padding - bottomBarHeight) * ratio;
    const scale = isMobile ? 1 : pcScale;
    const slideW = needsRotation
      ? (vv?.height ?? window.innerHeight) - 64
      : Math.min(window.innerWidth - 128, 1024);
    // scale 적용 시 콘텐츠는 원래 크기로 측정되므로, 가용 공간을 scale로 나눠서 전달
    setSlides(
      extractSlides(articleRef.current, available / scale, slideW / scale),
    );
  }, [
    articleRef,
    isMobile,
    needsRotation,
    bottomBarHeight,
    pcScale,
    fillRatioOverride,
  ]);

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
        if (fullscreenCodeRef.current) {
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
  }, [safeClose, totalSlides, goToNext]);

  useEffect(() => {
    if (!slideContentRef.current || !slides[currentSlide]) return;
    slideContentRef.current.innerHTML = "";
    const slide = slides[currentSlide];
    const clonedSlide = slide.cloneNode(true) as HTMLElement;
    slideContentRef.current.appendChild(clonedSlide);

    // 렌더 후 실제 콘텐츠 높이가 컨테이너(부모)를 넘치면 경고 표시
    requestAnimationFrame(() => {
      const el = slideContentRef.current;
      const parent = el?.parentElement;
      if (!el || !parent) return;
      const scale = isMobile ? 1 : pcScale;
      const contentH = el.scrollHeight * scale;
      const parentH = parent.clientHeight;
      setOverflowing(contentH > parentH + 1);
    });

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
  }, [currentSlide, slides, isMobile, pcScale]);

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
          <span className="flex items-center gap-2 text-xs text-gray-500">
            {pressing ? (
              "놓지 마세요..."
            ) : isMobile ? (
              `화면을 ${LONG_PRESS_MS / 1000}초간 누르면 종료`
            ) : overflowing ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                ⚠ 화면 넘침 — 표시 영역을 줄이세요
              </span>
            ) : (
              ""
            )}
          </span>

          <span className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-gray-600 dark:text-gray-400">
            {currentSlide + 1} / {totalSlides}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="mr-1 flex size-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              onClick={toggleDeviceMode}
              aria-label={
                isMobile ? "데스크탑 모드로 전환" : "모바일 모드로 전환"
              }
              title={isMobile ? "데스크탑 모드로 전환" : "모바일 모드로 전환"}
            >
              {isMobile ? (
                <IoDesktopOutline className="size-4" />
              ) : (
                <IoPhonePortraitOutline className="size-4" />
              )}
            </button>
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
                  aria-label="글자 크기 축소"
                  title="글자 크기 축소"
                >
                  <IoRemoveOutline className="size-4" />
                </button>
                <span
                  className="min-w-[3ch] text-center text-xs tabular-nums text-gray-500"
                  title="글자 배율"
                >
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
                  aria-label="글자 크기 확대"
                  title="글자 크기 확대"
                >
                  <IoAddOutline className="size-4" />
                </button>

                {/* 표시 영역 조절 (미러링 등으로 화면 잘릴 때 사용) */}
                <span className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-700" />
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  onClick={() => {
                    setFillRatioOverride((r) => {
                      const base = r ?? getFillRatio(window.innerHeight);
                      return (
                        Math.round(
                          Math.max(MIN_FILL_RATIO, base - FILL_RATIO_STEP) *
                            100,
                        ) / 100
                      );
                    });
                    setCurrentSlide(0);
                  }}
                  disabled={
                    (fillRatioOverride ?? 1) <= MIN_FILL_RATIO &&
                    fillRatioOverride !== null
                  }
                  aria-label="표시 영역 줄이기"
                  title="표시 영역 줄이기 (미러링에서 잘릴 때)"
                >
                  <IoRemoveOutline className="size-3.5 opacity-70" />
                </button>
                <span
                  className="min-w-[3.5ch] text-center text-xs tabular-nums text-gray-500"
                  title="슬라이드 표시 영역 비율"
                >
                  {Math.round(
                    (fillRatioOverride ??
                      (typeof window !== "undefined"
                        ? getFillRatio(window.innerHeight)
                        : 0.7)) * 100,
                  )}
                  %
                </span>
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  onClick={() => {
                    setFillRatioOverride((r) => {
                      const base = r ?? getFillRatio(window.innerHeight);
                      return (
                        Math.round(
                          Math.min(MAX_FILL_RATIO, base + FILL_RATIO_STEP) *
                            100,
                        ) / 100
                      );
                    });
                    setCurrentSlide(0);
                  }}
                  disabled={(fillRatioOverride ?? 0) >= MAX_FILL_RATIO}
                  aria-label="표시 영역 늘리기"
                  title="표시 영역 늘리기"
                >
                  <IoAddOutline className="size-3.5 opacity-70" />
                </button>
              </>
            )}
            <button
              type="button"
              className="ml-1 flex size-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              onClick={onClose}
              aria-label="프레젠테이션 종료"
            >
              <IoCloseOutline className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 전체화면 코드 뷰어 */}
      {fullscreenCode &&
        createPortal(
          <FullscreenView
            language={fullscreenCode.language}
            onClose={() => setFullscreenCode(null)}
            rotate={needsRotation}
            zIndex={60}
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
