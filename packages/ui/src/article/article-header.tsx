import { cn } from "@app/utils";
import type { ArticleHeaderProps } from "./article.types";

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function ArticleHeader({
  title,
  date,
  tags,
  author,
  readingTime,
  className,
  ...props
}: ArticleHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 border-b border-gray-200 pb-6 sm:mb-8 sm:pb-8 dark:border-gray-800",
        className,
      )}
      {...props}
    >
      {/* 태그 */}
      {tags && tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full bg-gray-100 px-3 py-1 text-xs font-medium tracking-wide text-gray-600 uppercase dark:bg-gray-800 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 타이틀 */}
      <h1 className="font-heading text-3xl leading-tight font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-gray-100">
        {title}
      </h1>

      {/* 메타 정보 */}
      <div className="mt-4 flex flex-wrap items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        {author && (
          <>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {author}
            </span>
            <span aria-hidden="true">&middot;</span>
          </>
        )}
        <time dateTime={typeof date === "string" ? date : date.toISOString()}>
          {formatDate(date)}
        </time>
        {readingTime != null && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span>{readingTime}분 읽기</span>
          </>
        )}
      </div>
    </header>
  );
}
