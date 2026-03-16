import type { ContentNode } from "@app/utils";

export interface SearchResult {
  title: string;
  description: string;
  path: string;
  tags: string[];
}

/** ContentTree에서 모든 파일 노드를 평탄화 */
export function flattenFiles(nodes: ContentNode[]): SearchResult[] {
  const results: SearchResult[] = [];

  for (const node of nodes) {
    if (node.type === "file" && node.frontmatter) {
      results.push({
        title: node.frontmatter.title,
        description: node.frontmatter.description,
        path: node.path,
        tags: node.frontmatter.tags,
      });
    }
    if (node.type === "folder" && node.children) {
      results.push(...flattenFiles(node.children));
    }
  }

  return results;
}

/** MDX 경로를 블로그 URL로 변환 */
export function toPostHref(mdxPath: string) {
  return `/blog${mdxPath.replace(/\.mdx?$/, "")}`;
}
