import type { HTMLAttributes, ReactNode } from "react";

export type FileListItemTone = "neutral" | "add" | "modify" | "delete";

export interface FileListItem {
  id: string;
  path: string;
  meta?: ReactNode;
  icon?: ReactNode;
  tone?: FileListItemTone;
  selected?: boolean;
}

export interface FileListProps extends HTMLAttributes<HTMLDivElement> {
  items: FileListItem[];
  onItemClick?: (item: FileListItem) => void;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function FileList({
  items,
  onItemClick,
  className,
  ...props
}: FileListProps) {
  return (
    <div className={cx("sj-file-list", className)} {...props}>
      {items.map((item) => (
        <button
          className={cx(
            "sj-file-list__item",
            item.selected && "sj-file-list__item--selected",
            item.tone &&
              item.tone !== "neutral" &&
              `sj-file-list__item--${item.tone}`,
          )}
          key={item.id}
          onClick={() => onItemClick?.(item)}
          type="button"
        >
          <span className="sj-file-list__icon" aria-hidden="true">
            {item.icon ?? "◇"}
          </span>
          <span className="sj-file-list__path">{item.path}</span>
          {item.meta ? (
            <span className="sj-file-list__meta">{item.meta}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
