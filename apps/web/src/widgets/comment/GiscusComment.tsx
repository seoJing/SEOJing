"use client";

import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useTheme } from "@app/ui";
import { GISCUS_CONFIG } from "@/shared/config/giscus";

const Giscus = lazy(() =>
  import("@giscus/react").then((m) => ({ default: m.default })),
);

interface GiscusCommentProps {
  slug: string;
  onComment?: () => void;
}

/**
 * Giscus 기반 댓글 위젯. 새 댓글 작성 시 onComment 콜백을 호출한다.
 *
 * @example
 * ```tsx
 * <GiscusComment slug="study/react" onComment={() => markAsCommented(href)} />
 * ```
 */
export function GiscusComment({ slug, onComment }: GiscusCommentProps) {
  const { resolvedTheme } = useTheme();
  const [key, setKey] = useState(0);
  const prevCommentCountRef = useRef<number | null>(null);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.origin !== "https://giscus.app") return;

      const data = event.data?.giscus;
      if (data?.discussion) {
        const totalCommentCount = data.discussion.totalCommentCount as
          | number
          | undefined;

        if (totalCommentCount != null) {
          if (
            prevCommentCountRef.current !== null &&
            totalCommentCount > prevCommentCountRef.current
          ) {
            onComment?.();
            setKey((prev) => prev + 1);
          }
          prevCommentCountRef.current = totalCommentCount;
        }
      }
    },
    [onComment],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-8 text-gray-500">
          댓글을 불러오는 중...
        </div>
      }
    >
      <Giscus
        key={key}
        id="comments"
        repo={GISCUS_CONFIG.repo}
        repoId={GISCUS_CONFIG.repoId}
        category={GISCUS_CONFIG.category}
        categoryId={GISCUS_CONFIG.categoryId}
        mapping="specific"
        term={slug}
        strict="0"
        reactionsEnabled="1"
        emitMetadata="1"
        inputPosition="top"
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        lang="ko"
        loading="lazy"
      />
    </Suspense>
  );
}
