import { cn } from "@app/utils";
import type { ArticleTableProps } from "./article.types";

export function ArticleTable({
  className,
  children,
  ...props
}: ArticleTableProps) {
  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-600">
      <table
        className={cn("min-w-full border-collapse text-sm", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}
