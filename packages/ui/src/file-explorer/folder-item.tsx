import { cn } from "@app/utils";
import {
  FolderIcon,
  FOLDER_ICON_COLOR,
  EXPLORER_TEXT_SIZES,
  EXPLORER_ICON_SIZES,
  EXPLORER_ITEM_PADDINGS,
  EXPLORER_ITEM_GAPS,
} from "./file-explorer.constants";
import type { FolderItemProps } from "./file-explorer.types";

export function FolderItem({ folder, onClick, size = "md" }: FolderItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      <FolderIcon
        className={cn("shrink-0", FOLDER_ICON_COLOR, EXPLORER_ICON_SIZES[size])}
      />
      <span className="flex-1 text-left text-gray-800 dark:text-gray-200 font-sans">
        {folder.name}
      </span>
      {folder.itemCount !== undefined && (
        <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
          {folder.itemCount}개
        </span>
      )}
    </button>
  );
}
