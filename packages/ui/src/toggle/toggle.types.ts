import type { InputHTMLAttributes } from "react";

export type ToggleSize = "sm" | "md" | "lg";

export interface ToggleProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "type"
> {
  /** 토글 상태 */
  checked: boolean;
  /** 상태 변경 콜백 */
  onCheckedChange: (checked: boolean) => void;
  /** 토글 크기 */
  size?: ToggleSize;
  /** 라벨 텍스트 */
  label?: string;
}
