"use client";

import Link from "next/link";
import { Paper, Subtitle } from "@app/ui";
import { cn } from "@app/utils";
import type { ContentNode } from "@app/utils";
import contentTree from "@/generated/content-tree.json";
import { getCommentedPosts } from "@/widgets/comment/comment-tracker";
import {
  getReadPosts,
  collectHrefs,
  getSubTree,
  buildDescriptionMap,
} from "./recently-read.utils";

export {
  getReadPosts,
  markAsRead,
  updateReadProgress,
} from "./recently-read.utils";
export type { ReadRecord } from "./recently-read.utils";

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
