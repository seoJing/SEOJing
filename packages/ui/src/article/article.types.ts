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

/** ArticleImage 크기 프리셋 */
export type ArticleImageSize = "sm" | "md" | "lg" | "full";

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
  /** 이미지 최대 너비 프리셋 (기본: "full") */
  size?: ArticleImageSize;
}

/** 퀴즈 타입 */
export type ArticleQuizMode = "multiple" | "description";

/** ArticleQuizItem — 개별 퀴즈 항목 */
export interface ArticleQuizItemProps extends HTMLAttributes<HTMLDivElement> {
  /** 객관식 / 주관식 모드 */
  mode: ArticleQuizMode;
  /** 질문 텍스트 */
  question: string;
  /** 객관식 보기 (mode가 "multiple"일 때 필수) */
  choices?: string[];
  /** 정답 (객관식은 보기의 index(0부터 시작), 주관식은 텍스트) */
  answer: string | number;
  /** 풀이 해설 */
  explanation?: string | React.ReactNode;
  stepIndex?: number;
  currentStep?: number;
  onResult?: (isCorrect: boolean) => void;
  onNext?: () => void;
}

/** ArticleQuiz — 퀴즈 래퍼 */
export interface ArticleQuizProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}
