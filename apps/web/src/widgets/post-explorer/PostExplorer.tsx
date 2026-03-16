"use client";

import { useState, useSyncExternalStore } from "react";
import { FileExplorer, Subtitle } from "@app/ui";
import type { ContentNode } from "@app/utils";
import contentTree from "@/generated/content-tree.json";
import { getReadPosts } from "@/widgets/recently-read/RecentlyRead";
import { getItemsForPath, toExplorerItems } from "./post-explorer.utils";

const EMPTY_POSTS: ReturnType<typeof getReadPosts> = [];

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
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
  const readPosts = useSyncExternalStore(
    subscribeStorage,
    getReadPosts,
    () => EMPTY_POSTS,
  );
  const visitedHref = new Set(readPosts.map((p) => p.href));

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
