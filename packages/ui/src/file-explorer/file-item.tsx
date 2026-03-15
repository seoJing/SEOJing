import { cn } from "@app/utils";
import {
  FILE_ICON_MAP,
  FILE_ICON_COLORS,
  DefaultFileIcon,
  EXPLORER_TEXT_SIZES,
  EXPLORER_ICON_SIZES,
  EXPLORER_ITEM_PADDINGS,
  EXPLORER_ITEM_GAPS,
} from "./file-explorer.constants";
import type { FileItemProps } from "./file-explorer.types";

export function FileItem({ file, size = "md" }: FileItemProps) {
  const IconComponent = FILE_ICON_MAP[file.extension] ?? DefaultFileIcon;
  const iconColor = FILE_ICON_COLORS[file.extension] ?? "text-gray-400";

  return (
    <a
      href={file.href}
      className={cn(
        "flex w-full items-center",
        "border-b border-gray-200 dark:border-gray-800",
        "hover:bg-gray-100 dark:hover:bg-gray-800/50",
        "cursor-pointer transition-colors",
        EXPLORER_TEXT_SIZES[size],
        EXPLORER_ITEM_PADDINGS[size],
        EXPLORER_ITEM_GAPS[size],
      )}
    >
      <IconComponent
        className={cn("shrink-0", iconColor, EXPLORER_ICON_SIZES[size])}
      />
      <span
        className={cn(
          "flex-1 text-left font-sans truncate",
          file.visited
            ? "text-gray-400 dark:text-gray-500"
            : "text-gray-800 dark:text-gray-200",
        )}
      >
        {file.name}
      </span>
      {file.size && (
        <span className="shrink-0 text-right text-xs text-gray-400 dark:text-gray-500 min-w-12">
          {file.size}
        </span>
      )}
    </a>
  );
}
