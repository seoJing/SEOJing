import type { ReactNode } from "react";
import { ArticleHeader, Paper } from "@app/ui";
import type { ContentFrontmatter } from "@app/utils";
import { SummaryVideo } from "@/widgets/summary-video";

/** Shared public/preview surface. The parent supplies the site's content width. */
export function ArticleLayout({
  frontmatter,
  readingTime,
  children,
  before,
  after,
}: {
  frontmatter: ContentFrontmatter;
  readingTime?: number;
  children: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
}) {
  return (
    <Paper>
      {before}
      <div className="relative min-w-0" data-article-surface>
        <ArticleHeader
          title={frontmatter.title}
          date={frontmatter.date}
          updated={frontmatter.updated}
          tags={frontmatter.tags}
          readingTime={readingTime}
        />
        <SummaryVideo
          video={frontmatter.summaryVideo}
          title={frontmatter.title}
        />
        <div className="article-prose min-w-0" data-article-content>
          {children}
        </div>
      </div>
      {after}
    </Paper>
  );
}
