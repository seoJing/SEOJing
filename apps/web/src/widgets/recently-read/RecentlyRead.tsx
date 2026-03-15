"use client";

import Link from "next/link";
import { Paper, Subtitle } from "@app/ui";
import { cn } from "@app/utils";
import type { ContentNode } from "@app/utils";
import contentTree from "@/generated/content-tree.json";
import { getCommentedPosts } from "@/widgets/comment/comment-tracker";

const STORAGE_KEY = "seojing-read-posts";

export interface ReadRecord {
  href: string;
  title: string;
  readAt: number;
  progress?: number;
}

/**
 * localStorage에서 읽은 글 목록을 가져온다.
 *
 * @example
 * ```ts
 * const posts = getReadPosts();
 * // [{ href: "/blog/react", title: "React", readAt: 1710000000000, progress: 80 }]
 * ```
 */
export function getReadPosts(): ReadRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReadRecord[]) : [];
  } catch {
    return [];
  }
}

/**
 * 읽은 글로 기록한다. 최대 20개까지 유지된다.
 *
 * @example
 * ```ts
 * markAsRead("/blog/react", "React 시작하기");
 * ```
 */
export function markAsRead(href: string, title: string) {
  try {
    const existing = getReadPosts();
    const prev = existing.find((p) => p.href === href);
    const filtered = existing.filter((p) => p.href !== href);
    filtered.unshift({
      href,
      title,
      readAt: Date.now(),
      progress: prev?.progress ?? 0,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, 20)));
  } catch {
    // localStorage 사용 불가 시 무시
  }
}

/**
 * 읽은 진행률을 업데이트한다. 기존 기록이 있을 때만 동작한다.
 *
 * @example
 * ```ts
 * updateReadProgress("/blog/react", 75);
 * ```
 */
export function updateReadProgress(href: string, progress: number) {
  try {
    const posts = getReadPosts();
    const target = posts.find((p) => p.href === href);
    if (!target) return;
    target.progress = Math.max(target.progress ?? 0, progress);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch {
    // localStorage 사용 불가 시 무시
  }
}

// 트리에서 모든 파일의 href를 수집
function collectHrefs(nodes: ContentNode[]): Set<string> {
  const hrefs = new Set<string>();
  function walk(items: ContentNode[]) {
    for (const node of items) {
      if (node.type === "file" && node.frontmatter) {
        hrefs.add(`/blog${node.path.replace(/\.mdx?$/, "")}`);
      }
      if (node.type === "folder" && node.children) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return hrefs;
}

// 트리에서 특정 경로의 서브트리를 반환
function getSubTree(tree: ContentNode[], rootPath: string): ContentNode[] {
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

// 트리에서 href → description 맵을 구축
function buildDescriptionMap(nodes: ContentNode[]): Map<string, string> {
  const map = new Map<string, string>();
  function walk(items: ContentNode[]) {
    for (const node of items) {
      if (node.type === "file" && node.frontmatter) {
        const href = `/blog${node.path.replace(/\.mdx?$/, "")}`;
        map.set(href, node.frontmatter.description);
      }
      if (node.type === "folder" && node.children) {
        walk(node.children);
      }
    }
  }
  walk(nodes);
  return map;
}

interface RecentlyReadProps {
  rootPath?: string;
}

/**
 * 최근 읽은 글 목록을 가로 스크롤 카드 형태로 표시한다.
 *
 * @example
 * ```tsx
 * <RecentlyRead rootPath="/study" />
 * ```
 */
export function RecentlyRead({ rootPath = "/" }: RecentlyReadProps) {
  const readPosts = getReadPosts();
  const commentedPosts = getCommentedPosts();

  const subTree = getSubTree(contentTree as ContentNode[], rootPath);
  const validHrefs = collectHrefs(subTree);
  const filteredPosts = readPosts.filter((p) => validHrefs.has(p.href));
  const descriptionMap = buildDescriptionMap(contentTree as ContentNode[]);

  return (
    <section className="flex flex-col gap-4">
      <Subtitle>최근 읽은 글</Subtitle>
      {filteredPosts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          열람한 페이지가 없습니다.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-3 sm:gap-3 scrollbar-h">
          {filteredPosts.map((post) => {
            const description = descriptionMap.get(post.href) ?? "";
            const hasCommented = commentedPosts.has(post.href);
            const isFullyRead = (post.progress ?? 0) >= 100;
            return (
              <Link key={post.href} href={post.href} className="shrink-0">
                <div
                  className={cn(
                    "w-28 rounded-lg overflow-hidden sm:w-36",
                    "bg-paper-light dark:bg-paper-dark",
                    "border border-gray-200 dark:border-gray-700",
                    "shadow-sm hover:shadow-md transition-shadow",
                  )}
                >
                  <div className="relative flex aspect-[1/1.414] items-center justify-center p-1">
                    <Paper
                      size="2xs"
                      padding="none"
                      radius="sm"
                      elevation={1}
                      animated={false}
                      className="flex h-full w-full items-center justify-center"
                    >
                      <p className="line-clamp-2 text-xs font-medium leading-tight text-gray-800 dark:text-gray-200">
                        {post.title}
                      </p>
                      {description && (
                        <p className="mt-1 line-clamp-1 text-[10px] text-gray-500">
                          {description}
                        </p>
                      )}
                      {isFullyRead && (
                        <div className="absolute right-5 top-28 lg:right-6 lg:top-38 z-10 -rotate-12">
                          <img
                            src="/redSilling.png"
                            alt="완독"
                            className="size-10 lg:size-15"
                          />
                        </div>
                      )}
                      {hasCommented && (
                        <div className="absolute left-17 lg:left-21 top-25 lg:top-32 z-10 rotate-12">
                          <img
                            src="/purpleSilling.png"
                            alt="댓글 완료"
                            className="size-10 lg:size-15"
                          />
                        </div>
                      )}
                    </Paper>
                  </div>
                  <div className="h-1 w-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full bg-gray-400 dark:bg-gray-500 transition-all"
                      style={{ width: `${post.progress ?? 0}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
