import type { ContentTree } from "@app/utils";
import {
  loadBackendArticleContent,
  toBackendArticleContentData,
} from "@/shared/content/backend-article";
import type { BackendArticleContentData as ContentData } from "@/shared/content/backend-article";
import {
  getPublicContentTree,
  readPublicArticle,
} from "@/shared/content/public-article-store";

export { getPublicContentTree as getContentTree };
export type { ContentData };

export async function loadContent(slug: string[]): Promise<ContentData | null> {
  const key = slug.join("/");
  if (!key || !/^[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u.test(key))
    return null;
  try {
    const article = await readPublicArticle(key);
    if (article) return toBackendArticleContentData(article);
  } catch (error) {
    console.error("Public article snapshot read failed", { slug: key, error });
  }
  return loadBackendArticleContent(key);
}

export function isSlugFolder(
  slug: string[],
  contentTree: ContentTree,
): boolean {
  let current: ContentTree = contentTree;
  for (const segment of slug) {
    const folder = current.find(
      (n) => n.type === "folder" && n.name === segment,
    );
    if (!folder?.children) return false;
    current = folder.children;
  }
  return true;
}
