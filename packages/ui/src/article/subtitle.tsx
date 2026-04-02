import { cn } from "@app/utils";
import type { SubtitleProps } from "./article.types";

const levelClasses = {
  2: "text-xl font-bold sm:text-2xl md:text-3xl",
  3: "text-lg font-semibold sm:text-xl md:text-2xl",
  4: "text-base font-semibold sm:text-lg md:text-xl",
} as const;

export function Subtitle({
  level = 2,
  children,
  className,
  ...props
}: SubtitleProps) {
  const Tag = `h${level}` as const;

  return (
    <Tag
      className={cn(
        "font-heading mt-8 mb-3 leading-tight tracking-tight text-gray-900 sm:mt-10 sm:mb-4 md:mt-12 dark:text-gray-100",
        levelClasses[level],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
