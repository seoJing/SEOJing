import type { HTMLAttributes } from "react";

/** 폴더 데이터 */
export interface FolderData {
  type: "folder";
  /** 폴더 이름 */
  name: string;
  /** 하위 아이템 수 */
  itemCount?: number;
}

/** 파일 데이터 */
export interface FileData {
  type: "file";
  /** 파일 이름 (확장자 포함) */
  name: string;
  /** 파일 확장자 (예: "mdx", "pdf") */
  extension: string;
  /** 상세 페이지 링크 */
  href: string;
  /** 파일 크기 (예: "3.4 MB") */
  size?: string;
  /** 작성일 */
  date?: string;
  /** 방문(열람) 여부 */
  visited?: boolean;
}

export type ExplorerItem = FolderData | FileData;

export type FileExplorerSize = "sm" | "md" | "lg";

export interface FileExplorerProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** 현재 경로의 아이템 목록 */
  items: ExplorerItem[];
  /** 현재 경로 (예: "/blog/tech") */
  currentPath: string;
  /** 홈 경로 (예: "/study") */
  homePath?: string;
  /** 웨이 파인딩 용 경로 (예: "/study/html/html1") */
  wayFindingPath?: string;
  /** 폴더 클릭 시 경로 변경 콜백 */
  onNavigate: (path: string) => void;
  /** 상단 툴바 표시 여부 */
  showToolbar?: boolean;
  /** 경로 바 표시 여부 */
  showPathBar?: boolean;
  /** 위로가기 버튼 표시 여부 */
  showGoUp?: boolean;
  /** 새로고침 버튼 표시 여부 */
  showRefresh?: boolean;
  /** 보기설정 버튼 표시 여부 */
  showViewSettings?: boolean;
  /** 현재 언어 */
  language?: Language;
  /** 언어 변경 콜백 */
  onLanguageChange?: (language: Language) => void;
  /** 새로고침 콜백 */
  onRefresh?: () => void;
  /** 사이즈 프리셋 */
  size?: FileExplorerSize;
}

export interface FileExplorerToolbarProps {
  currentPath: string;
  homePath: string;
  onNavigate: (path: string) => void;
  showPathBar?: boolean;
  showGoUp?: boolean;
  showRefresh?: boolean;
  showViewSettings?: boolean;
  onRefresh?: () => void;
  onViewSettings?: () => void;
  size?: FileExplorerSize;
}

export interface FolderItemProps {
  folder: FolderData;
  onClick: () => void;
  size?: FileExplorerSize;
}

export interface FileItemProps {
  file: FileData;
  size?: FileExplorerSize;
  isHighLighting: boolean;
}

export type Language = "ko" | "en";

export interface ViewSettingsModalProps {
  /** 모달 열림 상태 */
  open: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 현재 언어 */
  language?: Language;
  /** 언어 변경 콜백 */
  onLanguageChange?: (language: Language) => void;
}
