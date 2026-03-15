import { Suspense } from "react";
import { cn } from "@app/utils";
import { PaperErrorBoundary } from "./paper-error";
import {
  PAPER_MAX_WIDTHS,
  PAPER_PADDINGS,
  PAPER_RADII,
  PAPER_ELEVATIONS,
} from "./paper.constants";
import type { PaperProps } from "./paper.types";

function PaperSkeleton() {
  return (
    <div className="animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800">
      <div className="aspect-[1/1.414] w-full" />
    </div>
  );
}

function PaperInner({
  variant = "default",
  size = "md",
  padding = "md",
  elevation = 1,
  radius = "md",
  aspectRatio = false,
  animated = true,
  className,
  children,
  ...props
}: Omit<PaperProps, "fallback" | "errorFallback">) {
  const variantClasses: Record<string, string> = {
    default: "bg-paper-light dark:bg-paper-dark",
    outlined:
      "bg-paper-light dark:bg-paper-dark border border-gray-200 dark:border-gray-700",
    elevated: "bg-paper-light dark:bg-paper-dark",
  };

  return (
    <section
      className={cn(
        "mx-auto w-full flex flex-col",
        PAPER_MAX_WIDTHS[size],
        PAPER_PADDINGS[padding],
        PAPER_RADII[radius],
        variantClasses[variant],
        variant === "elevated" && PAPER_ELEVATIONS[elevation],
        aspectRatio && "aspect-[1/1.414]",
        animated && "animate-elliptic-in",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function Paper({
  fallback,
  errorFallback,
  children,
  ...props
}: PaperProps) {
  return (
    <PaperErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback ?? <PaperSkeleton />}>
        <PaperInner {...props}>{children}</PaperInner>
      </Suspense>
    </PaperErrorBoundary>
  );
}
