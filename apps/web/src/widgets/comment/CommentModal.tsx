"use client";
import { Modal } from "@app/ui";
import { GiscusComment } from "./GiscusComment";

export function CommentModal({
  open,
  onClose,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="댓글" size="xl">
      <div className="max-h-[70vh] overflow-y-auto">
        {open && <GiscusComment key={slug} slug={slug} />}
      </div>
    </Modal>
  );
}
