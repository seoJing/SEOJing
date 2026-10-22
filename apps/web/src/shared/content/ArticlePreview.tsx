import { ArticleContentView } from "./ArticleContentView";
import {
  toBackendArticleContentData,
  type BackendArticleApiResponse,
} from "./article-adapter";

/** Accept only the backend's explicit public projection, never editor blocks. */
export function ArticlePreview({
  article,
}: {
  article: BackendArticleApiResponse;
}) {
  return <ArticleContentView content={toBackendArticleContentData(article)} />;
}
