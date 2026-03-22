"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "@app/ui";
import {
  IoArrowBack,
  IoChatbubbleOutline,
  IoEaselOutline,
} from "react-icons/io5";
import { CommentModal } from "@/widgets/comment";
import { PresentationView } from "@/widgets/presentation";
import {
  markAsRead,
  updateReadProgress,
} from "@/widgets/recently-read/RecentlyRead";
import { markAsCommented } from "@/widgets/comment/comment-tracker";

interface ArticleToolbarProps {
  slug: string;
  title: string;
}

/**
 * 글 하단 플로팅 툴바. 댓글/뒤로가기 + 읽기 진행률 추적을 담당한다.
 *
 * @example
 * ```tsx
 * <ArticleToolbar slug="study/react" title="React 시작하기" />
 * ```
 */
export function ArticleToolbar({ slug, title }: ArticleToolbarProps) {
  const router = useRouter();
  const [commentOpen, setCommentOpen] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const articleSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    markAsRead(`/blog/${slug}`, title);
  }, [slug, title]);

  useEffect(() => {
    articleSectionRef.current = toolbarRef.current?.closest("section") ?? null;
  }, []);

  // 스크롤 진행률 추적
  useEffect(() => {
    const href = `/blog/${slug}`;
    const article = toolbarRef.current?.closest("section");
    if (!article) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = article.getBoundingClientRect();
        const scrolled = -rect.top;
        const total = rect.height - window.innerHeight;
        if (total > 0) {
          const progress = Math.min(
            100,
            Math.max(0, Math.round((scrolled / total) * 100)),
          );
          updateReadProgress(href, progress);
        }
        ticking = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [slug]);

  const handleComment = useCallback(() => {
    markAsCommented(`/blog/${slug}`);
  }, [slug]);

  return (
    <>
      <div
        ref={toolbarRef}
        className="sticky bottom-6 z-20 flex justify-center"
      >
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-background/80 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-gray-700 dark:bg-[#0a0a0a]/80">
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="프레젠테이션"
            onClick={() => setPresentationOpen(true)}
          >
            <IoEaselOutline className="size-5" />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="댓글"
            onClick={() => setCommentOpen(true)}
          >
            <IoChatbubbleOutline className="size-5" />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="뒤로가기"
            onClick={() => router.back()}
          >
            <IoArrowBack className="size-5" />
          </IconButton>
        </div>
      </div>
      <CommentModal
        open={commentOpen}
        onClose={() => setCommentOpen(false)}
        slug={slug}
        onComment={handleComment}
      />
      {presentationOpen && (
        <PresentationView
          articleRef={articleSectionRef}
          onClose={() => setPresentationOpen(false)}
        />
      )}
    </>
  );
}
