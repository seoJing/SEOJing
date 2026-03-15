import {
  AiFillFolder,
  AiFillFile,
  AiFillFileText,
  AiFillFileImage,
} from "react-icons/ai";
import {
  VscFilePdf,
  VscFileCode,
  VscJson,
  VscFileMedia,
} from "react-icons/vsc";
import type { FileExplorerSize } from "./file-explorer.types";

/** 확장자 → 아이콘 컴포넌트 매핑 */
export const FILE_ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  // 문서
  md: AiFillFileText,
  mdx: AiFillFileText,
  txt: AiFillFileText,
  doc: AiFillFileText,
  docx: AiFillFileText,
  // PDF
  pdf: VscFilePdf,
  // 이미지
  png: AiFillFileImage,
  jpg: AiFillFileImage,
  jpeg: AiFillFileImage,
  gif: AiFillFileImage,
  svg: AiFillFileImage,
  webp: AiFillFileImage,
  // 코드
  ts: VscFileCode,
  tsx: VscFileCode,
  js: VscFileCode,
  jsx: VscFileCode,
  py: VscFileCode,
  go: VscFileCode,
  rs: VscFileCode,
  // 데이터
  json: VscJson,
  yaml: VscFileCode,
  yml: VscFileCode,
  // 미디어
  mp4: VscFileMedia,
  mp3: VscFileMedia,
  wav: VscFileMedia,
};

/** 폴더 아이콘 */
export const FolderIcon = AiFillFolder;

/** 기본 파일 아이콘 (매핑 없을 때) */
export const DefaultFileIcon = AiFillFile;

/** 확장자별 아이콘 색상 */
export const FILE_ICON_COLORS: Record<string, string> = {
  md: "text-blue-400",
  mdx: "text-blue-400",
  pdf: "text-red-400",
  png: "text-green-400",
  jpg: "text-green-400",
  jpeg: "text-green-400",
  gif: "text-green-400",
  svg: "text-yellow-400",
  ts: "text-blue-500",
  tsx: "text-blue-500",
  js: "text-yellow-500",
  jsx: "text-yellow-500",
  json: "text-yellow-400",
};

export const FOLDER_ICON_COLOR = "text-yellow-400";

/** 사이즈별 텍스트 크기 */
export const EXPLORER_TEXT_SIZES: Record<FileExplorerSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

/** 사이즈별 아이콘 크기 */
export const EXPLORER_ICON_SIZES: Record<FileExplorerSize, string> = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
};

/** 사이즈별 아이템 패딩 */
export const EXPLORER_ITEM_PADDINGS: Record<FileExplorerSize, string> = {
  sm: "px-2 py-1",
  md: "px-3 py-2",
  lg: "px-4 py-3",
};

/** 사이즈별 아이템 gap */
export const EXPLORER_ITEM_GAPS: Record<FileExplorerSize, string> = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
};
