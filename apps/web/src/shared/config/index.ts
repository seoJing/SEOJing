import contentTree from "@/generated/content-tree.json";
import type { ContentTree } from "@app/utils";

export { contentTree };
export { loadContent, type ContentData } from "@/generated/content-loader";

export function isSlugFolder(slug: string[]): boolean {
  let current: ContentTree = contentTree as ContentTree;
  for (const segment of slug) {
    const folder = current.find(
      (n) => n.type === "folder" && n.name === segment,
    );
    if (!folder?.children) return false;
    current = folder.children;
  }
  return true;
}
