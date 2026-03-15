"use client";

import { useState } from "react";
import { FileExplorer, Subtitle } from "@app/ui";
import type { ExplorerItem } from "@app/ui";
import type { ContentNode } from "@app/utils";
import contentTree from "@/generated/content-tree.json";
import { getReadPosts } from "@/widgets/recently-read/RecentlyRead";

// 트리에서 특정 경로의 아이템 목록을 반환
function getItemsForPath(
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

// ContentNode[]를 ExplorerItem[]로 변환
function toExplorerItems(
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

interface PostExplorerProps {
  rootPath?: string;
}

/**
 * 파일 탐색기 UI로 포스트 목록을 표시한다.
 *
 * @example
 * ```tsx
 * <PostExplorer rootPath="/study" />
 * ```
 */
export function PostExplorer({ rootPath = "/" }: PostExplorerProps) {
  const [currentPath, setCurrentPath] = useState(rootPath);
  const visitedHref = new Set(getReadPosts().map((p) => p.href));

  const nodes = getItemsForPath(contentTree as ContentNode[], currentPath);
  const items = toExplorerItems(nodes, visitedHref);

  return (
    <section className="flex flex-col gap-4">
      <Subtitle>포스트 목록</Subtitle>
      <FileExplorer
        items={items}
        currentPath={currentPath}
        homePath={rootPath}
        onNavigate={setCurrentPath}
        showToolbar
        showPathBar
        showGoUp
        showRefresh
        showViewSettings
        size="md"
      />
    </section>
  );
}
