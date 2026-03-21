import {
  Subtitle,
  Paragraph,
  ArticleImage,
  ArticleHeader,
  ArticleTable,
  Anchor,
  ArticleQuiz,
  ArticleQuizItem,
  CodeBlock,
} from "@app/ui";
import { cn } from "@app/utils";
import type { ComponentPropsWithoutRef } from "react";

/**
 * MDX 요소를 커스텀 Article 컴포넌트로 매핑한다.
 *
 * @example
 * ```tsx
 * <MDXRemote source={mdxSource} components={mdxComponents} />
 * ```
 */
export const mdxComponents: Record<string, unknown> = {
  ArticleHeader,
  ArticleImage,
  ArticleQuiz,
  ArticleQuizItem,
  Subtitle,
  Paragraph,
  Anchor,
  table: (props: ComponentPropsWithoutRef<"table">) => (
    <ArticleTable {...props} />
  ),
  thead: ({ className, ...props }: ComponentPropsWithoutRef<"thead">) => (
    <thead className={className} {...props} />
  ),
  th: ({ className, ...props }: ComponentPropsWithoutRef<"th">) => (
    <th
      className={cn(
        "whitespace-nowrap border-b border-r border-gray-300 bg-white px-4 py-2.5 text-left text-sm font-semibold text-gray-900 last:border-r-0 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: ComponentPropsWithoutRef<"td">) => (
    <td
      className={cn(
        "whitespace-nowrap border-b border-r border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 last:border-r-0 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300",
        className,
      )}
      {...props}
    />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <Subtitle level={2} {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <Subtitle level={3} {...props} />
  ),
  img: ({ src, alt, ...props }: ComponentPropsWithoutRef<"img">) => (
    <ArticleImage src={src ?? ""} alt={alt ?? ""} {...props} />
  ),
  pre: ({
    children,
    className: preClassName,
    ...props
  }: ComponentPropsWithoutRef<"pre">) => {
    if (children && typeof children === "object" && "props" in children) {
      const codeProps = children.props as {
        className?: string;
        children?: React.ReactNode;
      };
      const findLang = (cls?: string) =>
        cls
          ?.split(" ")
          .find((c: string) => c.startsWith("language-"))
          ?.replace("language-", "");
      const language =
        findLang(codeProps.className) ?? findLang(preClassName as string);

      return (
        <CodeBlock language={language} {...props}>
          {codeProps.children}
        </CodeBlock>
      );
    }
    return (
      <pre className={preClassName} {...props}>
        {children}
      </pre>
    );
  },
  a: ({ className, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a
      className={cn(
        "font-medium text-blue-600 underline decoration-blue-400/30 underline-offset-2 hover:decoration-blue-600 dark:text-blue-400 dark:decoration-blue-500/30 dark:hover:decoration-blue-400",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({
    className,
    ...props
  }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className={cn(
        "my-6 border-l-4 border-gray-300 pl-4 text-gray-600 dark:border-gray-700 dark:text-gray-400",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }: ComponentPropsWithoutRef<"ul">) => (
    <ul
      className={cn(
        "my-4 list-disc space-y-2 pl-5 text-base leading-7 text-gray-700 sm:my-6 sm:space-y-3 sm:pl-6 sm:text-lg sm:leading-8 dark:text-gray-300",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }: ComponentPropsWithoutRef<"ol">) => (
    <ol
      className={cn(
        "my-4 list-decimal space-y-2 pl-5 text-base leading-7 text-gray-700 sm:my-6 sm:space-y-3 sm:pl-6 sm:text-lg sm:leading-8 dark:text-gray-300",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }: ComponentPropsWithoutRef<"hr">) => (
    <hr
      className={cn("my-8 border-gray-200 dark:border-gray-800", className)}
      {...props}
    />
  ),
  code: ({ className, ...props }: ComponentPropsWithoutRef<"code">) => {
    const isInCodeBlock =
      className
        ?.split(" ")
        .some(
          (c: string) => c.startsWith("language-") || c === "code-highlight",
        ) ?? false;
    if (isInCodeBlock) {
      return <code className={cn("font-mono", className)} {...props} />;
    }
    return (
      <code
        className={cn(
          "rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-gray-800 dark:bg-gray-800 dark:text-gray-200",
          className,
        )}
        {...props}
      />
    );
  },
};
