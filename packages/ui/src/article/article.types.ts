import type {
  HTMLAttributes,
  ImgHTMLAttributes,
  TableHTMLAttributes,
} from "react";

/** 포스트 타입 (카테고리 태그) */
export type ArticleTag = string;

/** ArticleHeader — 포스트 상단 헤더 */
export interface ArticleHeaderProps extends HTMLAttributes<HTMLElement> {
  /** 포스트 메인 타이틀 */
  title: string;
  /** 작성 일자 (Date 또는 문자열) */
  date: Date | string;
  /** 포스트 타입/카테고리 태그 */
  tags?: ArticleTag[];
  /** 작성자 이름 */
  author?: string;
  /** 읽기 예상 시간 (분) */
  readingTime?: number;
}

/** Subtitle — 섹션 소제목 (h2) */
export interface SubtitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** h2 | h3 레벨 선택 */
  level?: 2 | 3;
}

/** Paragraph — 본문 텍스트 */
export type ParagraphProps = HTMLAttributes<HTMLDivElement>;

/** CodeBlock — 코드 블록 */
export interface CodeBlockProps extends HTMLAttributes<HTMLPreElement> {
  /** 코드 문자열 */
  code: string;
  /** 언어 표시 (우측 상단 라벨) */
  language?: string;
}

/** ArticleTable — 가로 스크롤 지원 테이블 래퍼 */
export type ArticleTableProps = TableHTMLAttributes<HTMLTableElement>;

/** ArticleImage — 이미지 + 캡션 */
export interface ArticleImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "children"
> {
  /** 이미지 src */
  src: string;
  /** alt 텍스트 */
  alt: string;
  /** 이미지 하단 캡션 */
  caption?: string;
}
