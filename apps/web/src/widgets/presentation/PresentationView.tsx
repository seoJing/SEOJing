"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
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
  IoListOutline,
  IoExpandOutline,
  IoContractOutline,
} from "react-icons/io5";
import { FullscreenView } from "@app/ui";
import {
  extractSlideOutlineFromSlides,
  extractSlides,
  getFillRatio,
} from "./presentation.utils";

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
const DECK_SIDEBAR_WIDTH = 288;
const DECK_MAIN_PADDING_X = 80;
const DECK_MAIN_PADDING_Y = 64;
const DECK_CARD_PADDING_X = 112;
const DECK_CARD_PADDING_Y = 128;
const DECK_MAX_CARD_WIDTH = 1152;
const MIN_FILL_RATIO = 0.3;
const MAX_FILL_RATIO = 1.0;
const FILL_RATIO_STEP = 0.05;

function getPresentationSource(article: HTMLElement): HTMLElement {
  const firstChild = article.firstElementChild;

  if (firstChild instanceof HTMLElement) {
    return firstChild;
  }

  return article;
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
  const [isFullscreenCanvas, setIsFullscreenCanvas] = useState(false);

  useEffect(() => {
    if (!articleRef.current) return;
    // 모바일: 회전 레이아웃이므로 물리적 width가 슬라이드 높이가 됨
    // visualViewport을 우선 사용해 브라우저 UI(주소창·하단바)를 제외한 실제 영역 반영
    const vv = window.visualViewport;
    // needsRotation: 축이 뒤집힘 (물리적 width→높이, height→폭)
    const viewH = needsRotation
      ? (vv?.width ?? window.innerWidth)
      : (vv?.height ?? window.innerHeight);
    const scale = isMobile || !isFullscreenCanvas ? 1 : pcScale;
    let visibleHeight = viewH - bottomBarHeight;
    let slideW = needsRotation
      ? (vv?.height ?? window.innerHeight) - 64
      : Math.min(window.innerWidth - 128, 1024);

    if (!isMobile && !isFullscreenCanvas) {
      const deckMainWidth = Math.max(
        320,
        window.innerWidth - DECK_SIDEBAR_WIDTH - DECK_MAIN_PADDING_X,
      );
      const deckMainHeight = Math.max(
        240,
        viewH - bottomBarHeight - DECK_MAIN_PADDING_Y,
      );
      const cardWidth = Math.min(
        DECK_MAX_CARD_WIDTH,
        deckMainWidth,
        deckMainHeight * (16 / 9),
      );
      const cardHeight = Math.min(deckMainHeight, cardWidth * (9 / 16));
      visibleHeight = cardHeight - DECK_CARD_PADDING_Y;
      slideW = cardWidth - DECK_CARD_PADDING_X;
    } else {
      const padding = isMobile ? SLIDE_PADDING_Y_MOBILE : SLIDE_PADDING_Y;
      visibleHeight = viewH - padding - bottomBarHeight;
    }

    const ratio = fillRatioOverride ?? getFillRatio(viewH);
    const available = visibleHeight * ratio;
    const presentationSource = getPresentationSource(articleRef.current);
    // scale 적용 시 콘텐츠는 원래 크기로 측정되므로, 가용 공간을 scale로 나눠서 전달
    setSlides(
      extractSlides(presentationSource, available / scale, slideW / scale),
    );
  }, [
    articleRef,
    isMobile,
    needsRotation,
    bottomBarHeight,
    pcScale,
    fillRatioOverride,
    isFullscreenCanvas,
  ]);

  const totalSlides = slides.length;
  const slideOutline = useMemo(
    () => extractSlideOutlineFromSlides(slides),
    [slides],
  );
  const headingOutline = useMemo(
    () =>
      slideOutline.filter(
        (item) => item.kind === "heading" && item.level >= 1 && item.level <= 2,
      ),
    [slideOutline],
  );
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

  const goToSlide = useCallback((slideIndex: number) => {
    setCurrentSlide(slideIndex);
  }, []);

  const toggleFullscreenCanvas = useCallback(() => {
    setIsFullscreenCanvas((prev) => !prev);
    setCurrentSlide(0);
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
      if (e.key === "Home") {
        e.preventDefault();
        setCurrentSlide(0);
      }
      if (e.key === "End") {
        e.preventDefault();
        setCurrentSlide(Math.max(totalSlides - 1, 0));
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
      const scale = isMobile || !isFullscreenCanvas ? 1 : pcScale;
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
  }, [currentSlide, slides, isMobile, pcScale, isFullscreenCanvas]);

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
        {/* 덱 레이아웃: PC 기본은 좌측 목차 + 우측 카드 슬라이스, 전체화면 모드는 기존 꽉찬 캔버스 */}
        {isFullscreenCanvas || isMobile ? (
          <div
            className={`flex flex-1 items-center justify-center overflow-hidden py-12 ${isMobile ? "px-5" : "px-16"}`}
          >
            <div
              ref={slideContentRef}
              className="mx-auto w-full max-w-5xl overflow-hidden"
              style={isMobile ? undefined : { zoom: pcScale }}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden bg-[var(--color-cloud-dancer)] text-black dark:bg-black dark:text-white">
            <aside className="relative z-20 flex w-72 shrink-0 flex-col border-r border-black/10 bg-white/75 px-4 py-5 text-black shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/80 dark:text-white">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-[-0.01em]">
                <IoListOutline className="size-4" />
                슬라이드 목차
              </div>

              <div className="mb-4 rounded-xl bg-[var(--color-cloud-dancer)] px-3 py-2 text-[11px] font-medium text-black/55 ring-1 ring-black/10 dark:bg-white/10 dark:text-white/55 dark:ring-white/10">
                H1/H2 목차 {headingOutline.length}개 · 본문 슬라이드{" "}
                {totalSlides}장
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                {headingOutline.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`group flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                      item.slideIndex === currentSlide
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-transparent hover:border-black/10 hover:bg-[var(--color-cloud-dancer)] dark:hover:border-white/10 dark:hover:bg-white/10"
                    }`}
                    onClick={() => goToSlide(item.slideIndex)}
                    aria-current={
                      item.slideIndex === currentSlide ? "step" : undefined
                    }
                  >
                    <span className="mt-0.5 min-w-[2ch] text-xs tabular-nums text-current opacity-45 group-hover:opacity-70">
                      {item.slideIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-xs font-medium leading-5">
                        {item.title}
                      </span>
                      <span className="mt-1 text-[10px] text-current opacity-70">
                        H{item.level}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <main
              className={`relative z-0 flex flex-1 items-center justify-center overflow-hidden ${
                isMobile ? "px-5 py-12" : "px-10 py-8"
              }`}
            >
              <div className="relative aspect-[16/9] w-full max-w-6xl overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-2xl shadow-black/10 dark:border-white/10 dark:bg-black dark:shadow-black/40">
                <div className="pointer-events-none absolute left-7 top-5 z-10 rounded-full bg-[var(--color-cloud-dancer)] px-3 py-1 text-xs font-medium text-black/60 ring-1 ring-black/10 dark:bg-white/10 dark:text-white/65 dark:ring-white/10">
                  Deck {currentSlide + 1} / {totalSlides}
                </div>
                <div className="flex h-full items-center justify-center px-14 py-16">
                  <div
                    ref={slideContentRef}
                    className="mx-auto w-full max-w-5xl overflow-hidden"
                    style={
                      isMobile || !isFullscreenCanvas
                        ? undefined
                        : { zoom: pcScale }
                    }
                  />
                </div>
              </div>
            </main>
          </div>
        )}

        {/* 네비게이션 영역 (양쪽 사이드만, 가운데는 콘텐츠 클릭 가능) */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-10 flex"
          style={{
            bottom: `${bottomBarHeight}px`,
            left: isMobile || isFullscreenCanvas ? 0 : DECK_SIDEBAR_WIDTH,
          }}
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
          className={`relative z-30 flex shrink-0 items-center border-t border-black/10 bg-[var(--color-cloud-dancer)] text-black dark:border-white/10 dark:bg-black dark:text-white ${isMobile ? "px-4" : "px-6"}`}
          style={{ height: `${bottomBarHeight}px` }}
        >
          <span className="flex items-center gap-2 text-xs text-black/55 dark:text-white/55">
            {pressing ? (
              "놓지 마세요..."
            ) : isMobile ? (
              `화면을 ${LONG_PRESS_MS / 1000}초간 누르면 종료`
            ) : overflowing ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-blue-950 ring-1 ring-black/10 dark:bg-white/10 dark:text-white dark:ring-white/10">
                ⚠ 화면 넘침 — 표시 영역을 줄이세요
              </span>
            ) : (
              ""
            )}
          </span>

          <span className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-black/65 dark:text-white/65">
            {currentSlide + 1} / {totalSlides}
          </span>

          <div className="ml-auto flex items-center gap-1">
            {!isMobile && (
              <button
                type="button"
                className="mr-1 flex size-7 items-center justify-center rounded-full text-black/55 transition-colors hover:bg-white hover:text-blue-950 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
                onClick={toggleFullscreenCanvas}
                aria-pressed={isFullscreenCanvas}
                aria-label={
                  isFullscreenCanvas
                    ? "카드 목차 모드로 전환"
                    : "전체화면 슬라이드로 전환"
                }
                title={
                  isFullscreenCanvas
                    ? "카드 목차 모드로 전환"
                    : "전체화면 슬라이드로 전환"
                }
              >
                {isFullscreenCanvas ? (
                  <IoContractOutline className="size-4" />
                ) : (
                  <IoExpandOutline className="size-4" />
                )}
              </button>
            )}
            <button
              type="button"
              className="mr-1 flex size-7 items-center justify-center rounded-full text-black/55 transition-colors hover:bg-white hover:text-black dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
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
                  className="flex size-7 items-center justify-center rounded-full text-black/55 transition-colors hover:bg-white hover:text-black disabled:opacity-30 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
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
                  className="min-w-[3ch] text-center text-xs tabular-nums text-black/55 dark:text-white/55"
                  title="글자 배율"
                >
                  {pcScale.toFixed(1)}
                </span>
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-full text-black/55 transition-colors hover:bg-white hover:text-black disabled:opacity-30 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
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
                <span className="mx-1 h-4 w-px bg-black/15 dark:bg-white/15" />
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-full text-black/55 transition-colors hover:bg-white hover:text-black disabled:opacity-30 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
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
                  className="min-w-[3.5ch] text-center text-xs tabular-nums text-black/55 dark:text-white/55"
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
                  className="flex size-7 items-center justify-center rounded-full text-black/55 transition-colors hover:bg-white hover:text-black disabled:opacity-30 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
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
              className="ml-1 flex size-7 items-center justify-center rounded-full text-black/55 transition-colors hover:bg-white hover:text-black dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
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
