/** Calendar dates are literal; instants use Asia/Seoul. Locale: ko-KR.
 * Offset-less datetimes and invalid values are rejected to avoid host-TZ drift.
 */
const formatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function formatDateOnly(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  if (typeof value === "string") {
    const date = /^(\d{4}-\d{2}-\d{2})$/.exec(value);
    if (date) {
      return isCalendarDate(value)
        ? formatter.format(new Date(`${value}T00:00:00Z`))
        : "—";
    }
    const instant =
      /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
        value,
      );
    if (!instant || !isCalendarDate(instant[1])) return "—";
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : formatter.format(parsed);
}
