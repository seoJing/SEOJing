import type { MDXRemoteProps } from "next-mdx-remote/rsc";
import {
  Subtitle,
  Paragraph,
  CodeBlock,
  ArticleImage,
  ArticleHeader,
  Anchor,
} from "@app/ui";
import { cn } from "@app/utils";
import { codeToHtml } from "shiki";
import type { ComponentPropsWithoutRef } from "react";

/**
 * MDX 요소를 커스텀 Article 컴포넌트로 매핑한다.
 *
 * @example
 * ```tsx
 * <MDXRemote source={mdxSource} components={mdxComponents} />
 * ```
 */
export const mdxComponents: MDXRemoteProps["components"] = {
  ArticleHeader,
  ArticleImage,
  Subtitle,
  Paragraph,
  Anchor,
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <Subtitle level={2} {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <Subtitle level={3} {...props} />
  ),
  img: ({ src, alt, ...props }: ComponentPropsWithoutRef<"img">) => (
    <ArticleImage src={src ?? ""} alt={alt ?? ""} {...props} />
  ),
  pre: async ({ children, ...props }: ComponentPropsWithoutRef<"pre">) => {
    if (children && typeof children === "object" && "props" in children) {
      const codeProps = children.props as {
        className?: string;
        children?: string;
      };
      const language = codeProps.className?.replace("language-", "");
      const codeString = String(codeProps.children ?? "").trimEnd();

      const highlighted = await codeToHtml(codeString, {
        lang: language ?? "text",
        theme: "github-dark",
      });
      // shiki 출력에서 <code> 안의 innerHTML만 추출
      const innerHtml = highlighted
        .replace(/^<pre[^>]*><code[^>]*>/, "")
        .replace(/<\/code><\/pre>$/, "");

      return <CodeBlock code={innerHtml} language={language} />;
    }
    return <pre {...props}>{children}</pre>;
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
        "my-6 border-l-4 border-gray-300 pl-4 italic text-gray-600 dark:border-gray-700 dark:text-gray-400",
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
  code: ({ className, ...props }: ComponentPropsWithoutRef<"code">) => (
    <code
      className={cn(
        "rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-gray-800 dark:bg-gray-800 dark:text-gray-200",
        className,
      )}
      {...props}
    />
  ),
};
