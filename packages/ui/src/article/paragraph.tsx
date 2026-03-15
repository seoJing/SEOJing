import { cn } from "@app/utils";
import type { ParagraphProps } from "./article.types";

export function Paragraph({ children, className, ...props }: ParagraphProps) {
  return (
    <div
      className={cn(
        "mb-4 text-base leading-7 text-gray-700 sm:mb-6 sm:text-lg sm:leading-8 dark:text-gray-300",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
