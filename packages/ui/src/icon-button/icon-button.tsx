import { cn } from "@app/utils";
import {
  ICON_BUTTON_SIZES,
  ICON_BUTTON_VARIANTS,
} from "./icon-button.constants";
import type { IconButtonProps } from "./icon-button.types";

export function IconButton({
  size = "md",
  variant = "solid",
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-colors cursor-pointer",
        "disabled:opacity-50 disabled:pointer-events-none",
        ICON_BUTTON_SIZES[size],
        ICON_BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
