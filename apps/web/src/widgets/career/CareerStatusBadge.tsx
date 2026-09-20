import type { CareerRecruitmentStatus } from "@/shared/career/types";

const statusLabel: Record<CareerRecruitmentStatus, string> = {
  OPEN: "모집 중",
  CLOSED: "모집 종료",
  UPCOMING: "모집 예정",
  UNKNOWN: "확인 중",
};

const statusClassName: Record<CareerRecruitmentStatus, string> = {
  OPEN: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  CLOSED:
    "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  UPCOMING:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200",
  UNKNOWN:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

export function CareerStatusBadge({
  status,
}: {
  status: CareerRecruitmentStatus;
}) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusClassName[status]}`}
    >
      {statusLabel[status]}
    </span>
  );
}
