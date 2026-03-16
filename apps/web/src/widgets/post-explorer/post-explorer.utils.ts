import type { ContentNode } from "@app/utils";
import type { ExplorerItem } from "@app/ui";

/** 트리에서 특정 경로의 아이템 목록을 반환 */
export function getItemsForPath(
  tree: ContentNode[],
  targetPath: string,
): ContentNode[] {
  if (targetPath === "/" || targetPath === "") return tree;

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

/** ContentNode[]를 ExplorerItem[]로 변환 */
export function toExplorerItems(
  nodes: ContentNode[],
  visitedHrefs: Set<string>,
): ExplorerItem[] {
  return nodes.map((node) => {
    if (node.type === "folder") {
      return {
        type: "folder" as const,
        name: node.name,
        itemCount: node.itemCount,
      };
    }
    const href = `/blog${node.path.replace(/\.mdx?$/, "")}`;
    return {
      type: "file" as const,
      name: node.frontmatter?.title ?? node.name,
      extension: node.extension ?? "mdx",
      href,
      date: node.frontmatter?.date,
      visited: visitedHrefs.has(href),
    };
  });
}
