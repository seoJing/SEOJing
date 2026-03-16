import { mdxComponents } from "@/widgets/mdx-renderer/MdxRenderer";
import { loadContent } from "@/shared/config";
import { ArticleHeader, Paper } from "@app/ui";
import { calculateReadingTime } from "@app/utils";
import { ArticleToolbar } from "@/widgets/article-toolbar/ArticleToolbar";

export default async function Home() {
  const content = await loadContent(["resume"]);

  if (!content) {
    return null;
  }

  const MDXContent = content.compiled.default;

  return (
    <>
      <div className="mx-auto max-w-lg px-4 py-8">
        <h1 className="mb-4 text-3xl font-bold">
          SEOJing에 오신 것을 환영합니다!
        </h1>
        <p className="mb-2 text-lg">뭐 이런 저런 내용</p>
      </div>
      <Paper>
        <ArticleHeader
          title={content.frontmatter.title}
          date={content.frontmatter.date}
          tags={content.frontmatter.tags}
          readingTime={calculateReadingTime(content.source)}
        />
        <MDXContent components={mdxComponents} />
        <ArticleToolbar slug={"resume"} title={content.frontmatter.title} />
      </Paper>
    </>
  );
}
