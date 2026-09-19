import type { Metadata } from "vinext/shims/metadata";

import { absoluteUrl } from "@/shared/config/site";
import { listCareerOpportunities } from "@/shared/career/data";
import { CareerStatusBadge } from "@/widgets/career/CareerStatusBadge";

export const metadata: Metadata = {
  title: "Frontend Opportunity Radar",
  description:
    "프론트엔드 인턴과 신입 기회의 공식 모집 기록, 현재 상태, 준비 포인트를 출처와 함께 확인합니다.",
  alternates: { canonical: absoluteUrl("/career") },
  openGraph: {
    title: "Frontend Opportunity Radar",
    description:
      "현재 공고와 공식 모집 기록을 근거로 다음 프론트엔드 기회를 준비합니다.",
    url: absoluteUrl("/career"),
    type: "website",
  },
};

export default function CareerPage() {
  const opportunities = listCareerOpportunities();

  return (
    <div className="pb-16">
      <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-[#fffdf8] via-white to-[#d3e4f1]/60 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-slate-900 md:p-10">
        <p className="text-sm font-semibold tracking-[0.16em] text-slate-600 uppercase dark:text-slate-300">
          Career intelligence · Frontend
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-zinc-950 md:text-6xl dark:text-zinc-50">
          다음 공고를 기다리는 대신, 지금부터 준비합니다.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600 md:text-lg dark:text-zinc-300">
          공식 채용 페이지에서 확인한 현재 모집과 과거 기록을 한곳에 모으고,
          사실과 예측을 분리해 보여주는 Frontend Opportunity Radar입니다.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="career-opportunities-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Verified opportunities
            </p>
            <h2
              id="career-opportunities-title"
              className="mt-1 text-2xl font-bold text-zinc-950 dark:text-zinc-50"
            >
              확인된 기회
            </h2>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {opportunities.length}개 Opportunity
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {opportunities.map((opportunity) => (
            <a
              key={opportunity.slug}
              href={`/career/opportunities/${opportunity.slug}`}
              className="group rounded-3xl border border-zinc-200 bg-white/85 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950/75 dark:hover:border-slate-600"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {opportunity.company.name}
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-zinc-950 group-hover:text-slate-700 dark:text-zinc-50 dark:group-hover:text-slate-200">
                    {opportunity.title}
                  </h3>
                </div>
                <CareerStatusBadge status={opportunity.recruitmentStatus} />
              </div>
              <p className="mt-5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {opportunity.forecast
                  ? `${opportunity.forecast.expectedOpenFrom ?? "미정"}부터 ${opportunity.forecast.expectedOpenTo ?? "미정"} 사이의 패턴을 확인했어요.`
                  : opportunity.recruitmentStatus === "OPEN"
                    ? "현재 공식 공고가 열려 있어 예측 대신 확인된 모집 정보를 우선 표시합니다."
                    : "예측하기에 충분한 모집 기록을 아직 확인하지 못했습니다."}
              </p>
              <p className="mt-5 text-xs text-zinc-500 dark:text-zinc-400">
                최종 확인 {formatKoreanDate(opportunity.updatedAt)}
              </p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatKoreanDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
