"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";
import { cn } from "@app/utils";
import { IconButton } from "../icon-button";
import { MODAL_SIZES } from "./modal.constants";
import type { ModalProps } from "./modal.types";

export function Modal({
  open,
  onClose,
  title,
  size = "md",
  closeOnBackdrop = true,
  children,
  className,
  ...props
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "relative z-10 mx-2 w-full rounded-2xl animate-modal-in",
          "bg-background border border-gray-200 dark:border-gray-700",
          "shadow-xl",
          MODAL_SIZES[size],
          className,
        )}
        {...props}
      >
        {/* Header */}
        {title != null && (
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h2 className="font-heading text-lg font-bold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="닫기"
              onClick={onClose}
            >
              <IoClose className="size-5" />
            </IconButton>
          </div>
        )}

        {/* Header 없을 때 닫기 버튼 */}
        {title == null && (
          <div className="absolute right-3 top-3">
            <IconButton
              variant="ghost"
              size="sm"
              aria-label="닫기"
              onClick={onClose}
            >
              <IoClose className="size-5" />
            </IconButton>
          </div>
        )}

        {/* Body */}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
