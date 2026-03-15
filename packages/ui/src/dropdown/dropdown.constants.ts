import type { DropdownSize, DropdownPadding } from "./dropdown.types";

export const DROPDOWN_TEXT_SIZES: Record<DropdownSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export const DROPDOWN_ICON_SIZES: Record<DropdownSize, string> = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
};

export const DROPDOWN_GAPS: Record<DropdownSize, string> = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-3",
};

export const DROPDOWN_PADDINGS: Record<DropdownPadding, string> = {
  none: "px-0 py-0",
  sm: "px-3 py-1.5",
  md: "px-4 py-2",
  lg: "px-5 py-2.5",
};
