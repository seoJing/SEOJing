import { cn } from "@app/utils";
import { ANCHOR_VARIANTS } from "./anchor.constants";
import type { AnchorProps } from "./anchor.types";

export function Anchor({
  variant = "default",
  external,
  className,
  children,
  ...props
}: AnchorProps) {
  return (
    <a
      className={cn("transition-colors", ANCHOR_VARIANTS[variant], className)}
      {...(external && { target: "_blank", rel: "noopener noreferrer" })}
      {...props}
    >
      {children}
    </a>
  );
}
