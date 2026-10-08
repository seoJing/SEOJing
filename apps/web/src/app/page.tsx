import { ArticleHeader, Paper } from "@app/ui";
import { calculateReadingTime } from "@app/utils";
import { ArticleToolbar } from "@/widgets/article-toolbar/ArticleToolbar";
import { BackendArticleDocument } from "@/shared/content/backend-article-document";
import { documentPlainText } from "@/shared/content/backend-article";
import resume from "@/shared/content/resume-document.json";

export default function Home() {
  const text = documentPlainText(resume.document);

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
          title={resume.frontmatter.title}
          date={resume.frontmatter.date}
          tags={resume.frontmatter.tags}
          readingTime={calculateReadingTime(text)}
        />
        <div className="article-prose" data-article-content>
          <BackendArticleDocument document={resume.document} />
        </div>
        <ArticleToolbar slug={"resume"} title={resume.frontmatter.title} />
      </Paper>
    </>
  );
}
