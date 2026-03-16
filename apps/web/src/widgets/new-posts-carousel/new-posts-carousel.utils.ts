import type { ContentNode } from "@app/utils";

export interface PostInfo {
  title: string;
  description: string;
  date: string;
  tags: string[];
  href: string;
}

/** 트리에서 특정 경로의 서브트리를 반환 */
export function getSubTree(
  tree: ContentNode[],
  rootPath: string,
): ContentNode[] {
  if (rootPath === "/" || rootPath === "") return tree;
  const segments = rootPath.replace(/^\//, "").split("/");
  let current = tree;
  for (const segment of segments) {
    const folder = current.find(
      (node) => node.type === "folder" && node.name === segment,
    );
    if (!folder?.children) return [];
    current = folder.children;
  }
  return current;
}

/** 모든 파일을 평탄화하여 최신순 정렬 */
export function getRecentPosts(nodes: ContentNode[], limit = 5): PostInfo[] {
  const posts: PostInfo[] = [];

  function collect(items: ContentNode[]) {
    for (const node of items) {
      if (node.type === "file" && node.frontmatter) {
        posts.push({
          title: node.frontmatter.title,
          description: node.frontmatter.description,
          date: node.frontmatter.date,
          tags: node.frontmatter.tags,
          href: `/blog${node.path.replace(/\.mdx?$/, "")}`,
        });
      }
      if (node.type === "folder" && node.children) {
        collect(node.children);
      }
    }
  }

  collect(nodes);
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return posts.slice(0, limit);
}
