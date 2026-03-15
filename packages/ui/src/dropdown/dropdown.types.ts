import type { ReactNode, HTMLAttributes } from "react";

export interface DropdownItem {
  /** 메뉴 아이템 아이콘 */
  icon?: ReactNode;
  /** 메뉴 아이템 라벨 */
  label: string;
  /** 이동할 경로 */
  href: string;
}

export type DropdownSize = "sm" | "md" | "lg";
export type DropdownPadding = "none" | "sm" | "md" | "lg";

export interface DropdownProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** 트리거 아이콘 */
  icon: ReactNode;
  /** 트리거 타이틀 */
  title: string;
  /** 드롭다운 메뉴 아이템 목록 */
  items: DropdownItem[];
  /** 사이즈 프리셋 */
  size?: DropdownSize;
  /** 트리거 및 메뉴 아이템 내부 패딩 */
  padding?: DropdownPadding;
}
