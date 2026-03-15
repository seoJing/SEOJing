import type { ReactNode, HTMLAttributes } from "react";

export type PaperVariant = "default" | "outlined" | "elevated";
export type PaperSize = "2xs" | "xs" | "sm" | "md" | "lg" | "full";
export type PaperPadding = "none" | "sm" | "md" | "lg" | "xl";
export type PaperElevation = 0 | 1 | 2 | 3;
export type PaperRadius = "none" | "sm" | "md" | "lg";

export interface PaperProps extends HTMLAttributes<HTMLElement> {
  /** Visual variant */
  variant?: PaperVariant;
  /** Max-width size preset */
  size?: PaperSize;
  /** Internal padding */
  padding?: PaperPadding;
  /** Shadow elevation level */
  elevation?: PaperElevation;
  /** Border radius */
  radius?: PaperRadius;
  /** Maintain A4 aspect ratio (1:√2) */
  aspectRatio?: boolean;
  /** Slide-up animation on mount */
  animated?: boolean;
  /** Suspense fallback UI */
  fallback?: ReactNode;
  /** Error fallback render function */
  errorFallback?: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}
