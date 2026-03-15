"use client";

import { useState } from "react";
import { cn } from "@app/utils";
import { FileExplorerToolbar } from "./file-explorer-toolbar";
import { FolderItem } from "./folder-item";
import { FileItem } from "./file-item";
import { ViewSettingsModal } from "./view-settings-modal";
import type { FileExplorerProps } from "./file-explorer.types";

export function FileExplorer({
  items,
  currentPath,
  homePath = "/",
  onNavigate,
  showToolbar = true,
  showPathBar = true,
  showGoUp = true,
  showRefresh = false,
  showViewSettings = false,
  language,
  onLanguageChange,
  onRefresh,
  size,
  className,
  ...props
}: FileExplorerProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const folders = items.filter((item) => item.type === "folder");
  const files = items.filter((item) => item.type === "file");

  function handleFolderClick(folderName: string) {
    const newPath =
      currentPath === "/" || currentPath === ""
        ? `/${folderName}`
        : `${currentPath}/${folderName}`;
    onNavigate(newPath);
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden",
        "rounded-lg border border-gray-200 dark:border-gray-700",
        "bg-paper-light dark:bg-paper-dark",
        className,
      )}
      {...props}
    >
      {/* 툴바 */}
      {showToolbar && (
        <FileExplorerToolbar
          currentPath={currentPath}
          homePath={homePath}
          onNavigate={onNavigate}
          showPathBar={showPathBar}
          showGoUp={showGoUp}
          showRefresh={showRefresh}
          showViewSettings={showViewSettings}
          onRefresh={onRefresh}
          onViewSettings={() => setSettingsOpen(true)}
          size={size}
        />
      )}

      {/* 요약 정보 */}
      <div
        className={cn(
          "px-4 py-2 text-center",
          "text-xs text-gray-400 dark:text-gray-500",
          "border-b border-gray-200 dark:border-gray-700",
          "bg-gray-50/50 dark:bg-gray-900/30",
        )}
      >
        파일 {files.length}개, 폴더 {folders.length}개
      </div>

      {/* 아이템 리스트 */}
      <div>
        {folders.map((folder) => (
          <FolderItem
            key={folder.name}
            folder={folder}
            onClick={() => handleFolderClick(folder.name)}
            size={size}
          />
        ))}
        {files.map((file) => (
          <FileItem key={file.name} file={file} size={size} />
        ))}
      </div>

      {/* 빈 상태 */}
      {items.length === 0 && (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm">
          이 폴더는 비어 있습니다
        </div>
      )}

      {/* 보기 설정 모달 */}
      {showViewSettings && (
        <ViewSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          language={language}
          onLanguageChange={onLanguageChange}
        />
      )}
    </div>
  );
}
