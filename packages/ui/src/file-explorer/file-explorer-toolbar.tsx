import { cn } from "@app/utils";
import { IoChevronUp, IoRefresh, IoSettings, IoHome } from "react-icons/io5";
import { EXPLORER_TEXT_SIZES } from "./file-explorer.constants";
import type { FileExplorerToolbarProps } from "./file-explorer.types";

export function FileExplorerToolbar({
  currentPath,
  homePath,
  onNavigate,
  showPathBar = true,
  showGoUp = true,
  showRefresh = false,
  showViewSettings = false,
  onRefresh,
  onViewSettings,
  size = "md",
}: FileExplorerToolbarProps) {
  const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
  const isRoot = currentPath === homePath || currentPath === "";

  function handleGoUp() {
    if (!isRoot) {
      onNavigate(parentPath);
    }
  }

  function handleGoHome() {
    onNavigate(homePath);
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      {/* 현재 경로 표시 */}
      {showPathBar && (
        <div
          className={cn(
            "px-4 py-2 font-mono",
            "text-gray-500 dark:text-gray-400",
            "bg-gray-50 dark:bg-gray-900/50",
            size === "sm" ? "text-xs" : "text-sm",
          )}
        >
          {currentPath || "/"}
        </div>
      )}

      {/* 툴바 버튼들 */}
      <div
        className={cn(
          "flex items-center",
          "border-t border-gray-200 dark:border-gray-700 whitespace-nowrap",
          EXPLORER_TEXT_SIZES[size],
        )}
      >
        <ToolbarButton onClick={handleGoHome} label="홈">
          <IoHome />
        </ToolbarButton>

        {showRefresh && (
          <ToolbarButton
            onClick={onRefresh}
            label="새로고침"
            className="hidden sm:flex"
            aria-label="새로고침 (장식용 기능)"
            aria-roledescription="장식용 버튼"
          >
            <IoRefresh />
          </ToolbarButton>
        )}

        {showGoUp && (
          <ToolbarButton
            onClick={handleGoUp}
            label="위로이동"
            disabled={isRoot}
          >
            <IoChevronUp />
          </ToolbarButton>
        )}

        {showViewSettings && (
          <ToolbarButton onClick={onViewSettings} label="보기설정">
            <IoSettings />
          </ToolbarButton>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  disabled = false,
  className,
  children,
  ...rest
}: {
  onClick?: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.AriaAttributes) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5",
        "px-3 py-2.5",
        "text-gray-600 dark:text-gray-400",
        "hover:bg-gray-100 dark:hover:bg-gray-800/50",
        "transition-colors cursor-pointer",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "text-sm font-sans",
        className,
      )}
      {...rest}
    >
      <span className="text-base">{children}</span>
      <span>{label}</span>
    </button>
  );
}
