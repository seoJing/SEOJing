export const PAPER_COLORS = {
  light: "#F0EEE9",
  dark: "#1A1916",
} as const;

/** A4 aspect ratio: width / height = 1 / √2 ≈ 0.7071 */
export const A4_ASPECT_RATIO = 1 / Math.SQRT2;

export const PAPER_MAX_WIDTHS: Record<string, string> = {
  "2xs": "max-w-24",
  xs: "max-w-xs",
  sm: "max-w-sm",
  md: "max-w-full",
  lg: "max-w-6xl",
  full: "max-w-full",
};

export const PAPER_PADDINGS: Record<string, string> = {
  none: "p-0",
  sm: "p-2 sm:p-3",
  md: "p-4 sm:p-6",
  lg: "p-4 sm:p-6 md:p-8",
  xl: "p-6 sm:p-8 md:p-12",
};

export const PAPER_RADII: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-lg",
  lg: "rounded-2xl",
};

export const PAPER_ELEVATIONS: Record<number, string> = {
  0: "shadow-none",
  1: "shadow-sm",
  2: "shadow-md",
  3: "shadow-lg",
};
