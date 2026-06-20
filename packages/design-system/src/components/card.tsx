import type { HTMLAttributes } from "react";

export type CardElevation = "flat" | "soft" | "raised";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ elevation = "soft", className, ...props }: CardProps) {
  return (
    <div
      className={cx(
        "sj-card",
        elevation === "flat" && "sj-card--flat",
        elevation === "raised" && "sj-card--raised",
        className,
      )}
      {...props}
    />
  );
}
