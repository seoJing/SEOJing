import type { AnchorVariant } from "./anchor.types";

export const ANCHOR_VARIANTS: Record<AnchorVariant, string> = {
  default:
    "text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300",
  subtle:
    "text-blue-600 underline decoration-blue-600/30 underline-offset-2 hover:decoration-blue-600 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:decoration-blue-400",
  muted:
    "text-neutral-700 underline decoration-neutral-400/50 underline-offset-2 hover:text-neutral-900 hover:decoration-neutral-600 dark:text-neutral-300 dark:decoration-neutral-500/50 dark:hover:text-neutral-100 dark:hover:decoration-neutral-300",
};
