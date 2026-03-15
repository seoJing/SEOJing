import type { IconButtonSize, IconButtonVariant } from "./icon-button.types";

export const ICON_BUTTON_SIZES: Record<IconButtonSize, string> = {
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-12 text-lg",
};

export const ICON_BUTTON_VARIANTS: Record<IconButtonVariant, string> = {
  solid:
    "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300",
  outline:
    "border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800",
  ghost:
    "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
};
