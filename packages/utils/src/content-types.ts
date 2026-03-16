export interface ContentFrontmatter {
  title: string;
  date: string;
  tags: string[];
  description: string;
}

export interface ContentNode {
  name: string;
  type: "file" | "folder";
  // content/ 기준 상대 경로 (예: "/frontend/react-시작하기.mdx")
  path: string;
  extension?: string;
  frontmatter?: ContentFrontmatter;
  children?: ContentNode[];
  itemCount?: number;
}

export type ContentTree = ContentNode[];

/**
 * ContentTree에서 특정 경로의 아이템 목록을 반환한다.
 *
 * @example
 * ```ts
 * getItemsForPath(tree, "/study/hooks"); // 해당 폴더의 children
 * ```
 */
export function getItemsForPath(
  tree: ContentTree,
  targetPath: string,
): ContentTree {
  if (targetPath === "/" || targetPath === "") {
    return tree;
  }

  const segments = targetPath.replace(/^\//, "").split("/");
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
