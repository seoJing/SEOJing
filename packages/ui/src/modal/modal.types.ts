import type { HTMLAttributes, ReactNode } from "react";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface ModalProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** 모달 열림 상태 */
  open: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 모달 제목 */
  title?: ReactNode;
  /** 모달 크기 */
  size?: ModalSize;
  /** 백드롭 클릭으로 닫기 허용 */
  closeOnBackdrop?: boolean;
  /** 자식 요소 */
  children: ReactNode;
}
