/**
 * 텍스트의 예상 읽기 시간을 분 단위로 계산한다. (한국어 기준 500자/분)
 *
 * @example
 * ```ts
 * calculateReadingTime("안녕하세요 ..."); // 1
 * ```
 */
export function calculateReadingTime(text: string): number {
  const charCount = text.replace(/\s/g, "").length;
  return Math.max(1, Math.round(charCount / 500));
}
