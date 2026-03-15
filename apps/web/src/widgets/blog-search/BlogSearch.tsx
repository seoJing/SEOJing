"use client";

import { useEffect, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import { cn } from "@app/utils";
import type { ContentNode } from "@app/utils";
import contentTree from "@/generated/content-tree.json";

interface SearchResult {
  title: string;
  description: string;
  path: string;
  tags: string[];
}

// ContentTree에서 모든 파일 노드를 평탄화
function flattenFiles(nodes: ContentNode[]): SearchResult[] {
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

const allPosts = flattenFiles(contentTree as ContentNode[]);

interface BlogSearchProps {
  onClose: () => void;
}

// MDX 경로를 블로그 URL로 변환
function toPostHref(mdxPath: string) {
  return `/blog${mdxPath.replace(/\.mdx?$/, "")}`;
}

/**
 * 블로그 포스트 검색 UI. 제목/설명/태그를 기반으로 필터링한다.
 *
 * @example
 * ```tsx
 * <BlogSearch onClose={() => setOpen(false)} />
 * ```
 */
export function BlogSearch({ onClose }: BlogSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const lowerQuery = query.toLowerCase().trim();
  const results =
    lowerQuery.length > 0
      ? allPosts.filter(
          (post) =>
            post.title.toLowerCase().includes(lowerQuery) ||
            post.description.toLowerCase().includes(lowerQuery) ||
            post.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)),
        )
      : [];

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-3",
          "border border-gray-200 dark:border-gray-700",
          "bg-paper-light dark:bg-paper-dark",
          "animate-expand-right",
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="포스트 검색..."
          className={cn(
            "min-w-0 flex-1 bg-transparent text-sm outline-none",
            "text-gray-800 dark:text-gray-200",
            "placeholder:text-gray-400 dark:placeholder:text-gray-400",
          )}
        />
        {query && (
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {results.length}건
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
          aria-label="닫기"
        >
          <IoClose className="size-4" />
        </button>
      </div>

      {lowerQuery.length > 0 && (
        <ul
          className={cn(
            "absolute right-0 z-20 mt-1 w-full sm:w-80 max-h-64 overflow-y-auto",
            "rounded-lg border border-gray-200 dark:border-gray-700",
            "bg-paper-light dark:bg-paper-dark",
            "shadow-lg",
          )}
        >
          {results.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500">
              검색 결과가 없습니다.
            </li>
          ) : (
            results.map((post) => (
              <li key={post.path}>
                <a
                  href={toPostHref(post.path)}
                  className={cn(
                    "block px-4 py-3",
                    "hover:bg-gray-100 dark:hover:bg-gray-800",
                    "transition-colors",
                  )}
                >
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {post.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                    {post.description}
                  </p>
                  {post.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </a>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
