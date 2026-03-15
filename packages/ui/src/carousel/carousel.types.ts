import type { ReactNode, HTMLAttributes } from "react";

export type CarouselSize = "sm" | "md" | "lg";

export interface CarouselItem {
  /** 고유 키 */
  id: string;
  /** 렌더링할 콘텐츠 */
  content: ReactNode;
}

export interface CarouselProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** 카루셀 아이템 목록 */
  items: CarouselItem[];
  /** 자동 스크롤 간격 (ms). 0이면 비활성화 */
  autoPlayInterval?: number;
  /** 인디케이터 표시 여부 */
  showIndicators?: boolean;
  /** 좌우 화살표 표시 여부 */
  showArrows?: boolean;
  /** 사이즈 프리셋 */
  size?: CarouselSize;
}
