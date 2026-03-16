"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { cn } from "@app/utils";
import type { CarouselProps } from "./carousel.types";

const SIZE_CLASSES: Record<string, string> = {
  sm: "h-56",
  md: "h-56",
  lg: "h-72",
};

export function Carousel({
  items,
  autoPlayInterval = 4000,
  showIndicators = true,
  showArrows = true,
  size = "md",
  className,
  ...props
}: CarouselProps) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = items.length;

  const goTo = useCallback(
    (index: number) => {
      setCurrent(((index % total) + total) % total);
    },
    [total],
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  // 자동 스크롤
  useEffect(() => {
    if (autoPlayInterval <= 0 || total <= 1) return;

    timerRef.current = setInterval(next, autoPlayInterval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoPlayInterval, next, total]);

  // 마우스 hover 시 자동 스크롤 일시정지
  function handleMouseEnter() {
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function handleMouseLeave() {
    if (autoPlayInterval > 0 && total > 1) {
      timerRef.current = setInterval(next, autoPlayInterval);
    }
  }

  if (total === 0) return null;

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-lg", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {/* 슬라이드 트랙 */}
      <div
        className={cn(
          "flex transition-transform duration-500 ease-in-out",
          SIZE_CLASSES[size],
        )}
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {items.map((item) => (
          <div key={item.id} className="w-full shrink-0">
            {item.content}
          </div>
        ))}
      </div>

      {/* 좌우 화살표 */}
      {showArrows && total > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className={cn(
              "absolute top-1/2 left-2 -translate-y-1/2",
              "flex size-8 items-center justify-center rounded-full",
              "bg-black/30 text-white backdrop-blur-sm",
              "hover:bg-black/50 transition-colors cursor-pointer",
            )}
            aria-label="이전"
          >
            <IoChevronBack className="size-4" />
          </button>
          <button
            type="button"
            onClick={next}
            className={cn(
              "absolute top-1/2 right-2 -translate-y-1/2",
              "flex size-8 items-center justify-center rounded-full",
              "bg-black/30 text-white backdrop-blur-sm",
              "hover:bg-black/50 transition-colors cursor-pointer",
            )}
            aria-label="다음"
          >
            <IoChevronForward className="size-4" />
          </button>
        </>
      )}

      {/* 인디케이터 */}
      {showIndicators && total > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(i)}
              className={cn(
                "size-2 rounded-full transition-all cursor-pointer",
                i === current
                  ? "bg-white scale-125"
                  : "bg-white/50 hover:bg-white/75",
              )}
              aria-label={`슬라이드 ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
