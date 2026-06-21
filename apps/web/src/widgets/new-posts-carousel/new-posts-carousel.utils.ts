import type { ContentCover, ContentNode } from "@app/utils";

export interface PostInfo {
  title: string;
  description: string;
  date: string;
  tags: string[];
  href: string;
  category: string;
  cover?: ContentCover;
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

function getCategoryFromPath(path: string): string {
  const firstSegment = path.replace(/^\//, "").split("/")[0];
  if (!firstSegment) return "All Posts";

  const labels: Record<string, string> = {
    SEOJing: "SEO Jing",
    okayJing: "OkayJing",
    clab: "CLAB",
    "kd-team": "KD Team",
    study: "Study",
    spot: "SPOT",
  };

  return labels[firstSegment] ?? firstSegment;
}

function collectPosts(nodes: ContentNode[]): PostInfo[] {
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
          category: getCategoryFromPath(node.path),
          cover: node.frontmatter.cover,
        });
      }
      if (node.type === "folder" && node.children) {
        collect(node.children);
      }
    }
  }

  collect(nodes);
  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return posts;
}

/** 모든 파일을 평탄화하여 최신순 정렬 */
export function getAllPosts(nodes: ContentNode[]): PostInfo[] {
  return collectPosts(nodes);
}

/** 모든 파일을 평탄화하여 최신순 정렬 */
export function getRecentPosts(nodes: ContentNode[], limit = 5): PostInfo[] {
  return collectPosts(nodes).slice(0, limit);
}
