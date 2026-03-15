import type { ToggleSize } from "./toggle.types";

export const TOGGLE_TRACK_SIZES: Record<ToggleSize, string> = {
  sm: "w-8 h-4",
  md: "w-10 h-5",
  lg: "w-12 h-6",
};

export const TOGGLE_THUMB_SIZES: Record<ToggleSize, string> = {
  sm: "size-3",
  md: "size-4",
  lg: "size-5",
};

export const TOGGLE_TRANSLATE: Record<ToggleSize, string> = {
  sm: "translate-x-4",
  md: "translate-x-5",
  lg: "translate-x-6",
};

export const TOGGLE_LABEL_SIZES: Record<ToggleSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};
