"use client";

import Link from "next/link";
import { Carousel, Subtitle } from "@app/ui";
import type { CarouselItem } from "@app/ui";
import type { ContentNode } from "@app/utils";
import contentTree from "@/generated/content-tree.json";
import { getSubTree, getRecentPosts } from "./new-posts-carousel.utils";

interface NewPostsCarouselProps {
  rootPath?: string;
}

/**
 * 최신 포스트를 캐러셀 형태로 표시한다.
 *
 * @example
 * ```tsx
 * <NewPostsCarousel rootPath="/study" />
 * ```
 */
export function NewPostsCarousel({ rootPath = "/" }: NewPostsCarouselProps) {
  const subTree = getSubTree(contentTree as ContentNode[], rootPath);
  const recentPosts = getRecentPosts(subTree);

  if (recentPosts.length === 0) return null;

  const carouselItems: CarouselItem[] = recentPosts.map((post) => ({
    id: post.href,
    content: (
      <Link href={post.href} className="block h-full">
        <div className="flex h-full flex-col justify-end bg-linear-to-br bg-(--color-cloud-dancer) dark:bg-gray-800 p-4 sm:p-6">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 dark:bg-gray-900 px-2 py-0.5 text-xs backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
          <h3 className="font-heading text-lg font-bold leading-tight text-gray-900 sm:text-xl dark:text-gray-100 line-clamp-2">
            {post.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-xs text-gray-700 sm:text-sm dark:text-gray-300">
            {post.description}
          </p>
          <time className="mt-2 text-xs">{post.date}</time>
        </div>
      </Link>
    ),
  }));

  return (
    <section className="flex flex-col gap-4">
      <Subtitle>새 글 알람</Subtitle>
      <Carousel
        items={carouselItems}
        autoPlayInterval={5000}
        size="sm"
        showArrows={false}
        showIndicators
      />
    </section>
  );
}
