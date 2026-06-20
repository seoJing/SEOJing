import type { HTMLAttributes, ReactNode } from "react";

export type AttachmentTone = "neutral" | "image" | "document" | "code";

export interface AttachmentItem {
  id: string;
  name: string;
  meta?: ReactNode;
  preview?: ReactNode;
  tone?: AttachmentTone;
}

export interface AttachmentStripProps extends HTMLAttributes<HTMLDivElement> {
  items: AttachmentItem[];
  onRemove?: (item: AttachmentItem) => void;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AttachmentStrip({
  items,
  onRemove,
  className,
  ...props
}: AttachmentStripProps) {
  return (
    <div className={cx("sj-attachment-strip", className)} {...props}>
      {items.map((item) => (
        <div
          className={cx(
            "sj-attachment",
            item.tone && `sj-attachment--${item.tone}`,
          )}
          key={item.id}
        >
          <div className="sj-attachment__preview" aria-hidden="true">
            {item.preview ?? "□"}
          </div>
          <div className="sj-attachment__copy">
            <span className="sj-attachment__name">{item.name}</span>
            {item.meta ? (
              <span className="sj-attachment__meta">{item.meta}</span>
            ) : null}
          </div>
          {onRemove ? (
            <button
              aria-label={`${item.name} 제거`}
              className="sj-attachment__remove"
              onClick={() => onRemove(item)}
              type="button"
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
