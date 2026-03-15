"use client";

import { cn } from "@app/utils";
import {
  TOGGLE_TRACK_SIZES,
  TOGGLE_THUMB_SIZES,
  TOGGLE_TRANSLATE,
  TOGGLE_LABEL_SIZES,
} from "./toggle.constants";
import type { ToggleProps } from "./toggle.types";

export function Toggle({
  checked,
  onCheckedChange,
  size = "md",
  label,
  disabled = false,
  className,
  ...props
}: ToggleProps) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        {...props}
      />

      {/* Track */}
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center rounded-full",
          "transition-colors duration-200",
          checked
            ? "bg-(--color-cloud-dancer) dark:bg-(--color-cloud-dancer)/80"
            : "bg-gray-300 dark:bg-gray-600",
          TOGGLE_TRACK_SIZES[size],
        )}
      >
        {/* Thumb */}
        <span
          className={cn(
            "inline-block rounded-full shadow-sm",
            checked ? "bg-gray-700 dark:bg-gray-900" : "bg-white",
            "transition-transform duration-200",
            "translate-x-0.5",
            checked && TOGGLE_TRANSLATE[size],
            TOGGLE_THUMB_SIZES[size],
          )}
        />
      </span>

      {label && (
        <span
          className={cn(
            "text-gray-700 dark:text-gray-300",
            TOGGLE_LABEL_SIZES[size],
          )}
        >
          {label}
        </span>
      )}
    </label>
  );
}
