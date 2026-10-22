import type { ReactNode } from "react";
import { calculateReadingTime } from "@app/utils";
import { ArticleLayout } from "./ArticleLayout";
import type { BackendArticleContentData } from "./article-adapter";

/** The public page and editor share the complete content-to-layout adapter. */
export function ArticleContentView({
  content,
  before,
  after,
}: {
  content: BackendArticleContentData;
  before?: ReactNode;
  after?: ReactNode;
}) {
  const Body = content.compiled.default;
  return (
    <ArticleLayout
      frontmatter={content.frontmatter}
      readingTime={calculateReadingTime(content.source)}
      before={before}
      after={after}
    >
      <Body />
    </ArticleLayout>
  );
}
