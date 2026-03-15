import { cn } from "@app/utils";
import type { CodeBlockProps } from "./article.types";

/**
 * 코드 블록을 렌더링한다. code prop에는 반드시 신뢰된 HTML만 전달해야 한다.
 * (예: shiki 등 코드 하이라이터가 생성한 HTML)
 *
 * @example
 * ```tsx
 * <CodeBlock code="<span class='line'>const x = 1;</span>" language="ts" />
 * ```
 */
export function CodeBlock({
  code,
  language,
  className,
  ...props
}: CodeBlockProps) {
  return (
    <div className="my-8">
      {language && (
        <div className="rounded-t-lg bg-gray-800 px-4 py-2 dark:bg-gray-900">
          <span className="text-xs font-medium tracking-wide text-gray-400 uppercase">
            {language}
          </span>
        </div>
      )}

      <pre
        className={cn(
          "overflow-x-auto bg-gray-900 p-4 text-sm leading-6 text-gray-100 dark:bg-gray-950",
          language ? "rounded-b-lg" : "rounded-lg",
          className,
        )}
        {...props}
      >
        <code
          className="font-mono"
          dangerouslySetInnerHTML={{ __html: code }}
        />
      </pre>
    </div>
  );
}
