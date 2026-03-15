"use client";

import { Modal } from "@app/ui";
import { GiscusComment } from "./GiscusComment";

interface CommentModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  onComment?: () => void;
}

/**
 * 댓글 모달. Giscus 댓글 위젯을 Modal 안에 렌더링한다.
 *
 * @example
 * ```tsx
 * <CommentModal open={isOpen} onClose={() => setOpen(false)} slug="study/react" />
 * ```
 */
export function CommentModal({
  open,
  onClose,
  slug,
  onComment,
}: CommentModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="댓글" size="xl">
      <div className="max-h-[70vh] overflow-y-auto">
        {open && <GiscusComment slug={slug} onComment={onComment} />}
      </div>
    </Modal>
  );
}
