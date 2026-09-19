import { notFound } from "next/navigation";
import type { Metadata } from "vinext/shims/metadata";

import { absoluteUrl } from "@/shared/config/site";
import { getCareerOpportunity } from "@/shared/career/data";
import type {
  CareerForecastConfidence,
  CareerRecruitment,
} from "@/shared/career/types";
import { JsonLd } from "@/shared/seo/json-ld";
import { CareerStatusBadge } from "@/widgets/career/CareerStatusBadge";

interface CareerOpportunityPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: CareerOpportunityPageProps): Promise<Metadata> {
  const { slug } = await params;
  const opportunity = getCareerOpportunity(slug);
  if (!opportunity) {
    return {
      title: "Opportunity를 찾을 수 없습니다",
      robots: { index: false, follow: false },
    };
  }

  const title = `${opportunity.company.name} 프론트엔드 인턴 모집 정보`;
  const description = `${opportunity.company.name} ${opportunity.title}의 공식 모집 상태, 전형, 지원 요건과 준비 포인트를 출처와 함께 확인합니다.`;
  const url = absoluteUrl(`/career/opportunities/${opportunity.slug}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function CareerOpportunityPage({
  params,
}: CareerOpportunityPageProps) {
  const { slug } = await params;
  const opportunity = getCareerOpportunity(slug);
  if (!opportunity) notFound();

  const pageUrl = absoluteUrl(`/career/opportunities/${opportunity.slug}`);
  const officialListingUrl = opportunity.recruitments
    .flatMap((recruitment) => recruitment.sources)
    .find((source) => source.type === "OFFICIAL")?.url;
  const applicationUrl = officialListingUrl ?? opportunity.company.careersUrl;

  return (
    <div className="min-w-0 overflow-x-hidden pb-16">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: `${opportunity.company.name} ${opportunity.title}`,
            url: pageUrl,
            dateModified: opportunity.updatedAt,
            isPartOf: {
              "@type": "WebSite",
              name: "SEOJing",
              url: absoluteUrl("/"),
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "SEOJing",
                item: absoluteUrl("/"),
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Career",
                item: absoluteUrl("/career"),
              },
              {
                "@type": "ListItem",
                position: 3,
                name: `${opportunity.company.name} Frontend Internship`,
                item: pageUrl,
              },
            ],
          },
        ]}
      />

      <nav className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        <a href="/career" className="hover:text-zinc-900 dark:hover:text-white">
          Career Radar
        </a>
        <span aria-hidden="true"> / </span>
        <span>{opportunity.company.name}</span>
      </nav>

      <header className="rounded-3xl border border-zinc-200 bg-white/85 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/75 md:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {opportunity.company.name} · {opportunity.category}
            </p>
            <h1 className="mt-3 max-w-3xl break-words text-3xl font-bold tracking-tight text-zinc-950 md:text-5xl dark:text-zinc-50">
              {opportunity.title}
            </h1>
          </div>
          <CareerStatusBadge status={opportunity.recruitmentStatus} />
        </div>
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          최종 확인 {formatKoreanDate(opportunity.updatedAt)} · 사실과 분석을
          분리해 표시합니다.
        </p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <main className="space-y-6">
          <Section title="다음 모집 예상" tone="analysis">
            {opportunity.forecast ? (
              <div className="space-y-4">
                <p className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                  {formatDateRange(
                    opportunity.forecast.expectedOpenFrom,
                    opportunity.forecast.expectedOpenTo,
                  )}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  패턴 강도 {forecastLabel(opportunity.forecast.confidence)} ·
                  확인 기록 {opportunity.forecast.basedOnRecruitmentCount}건 ·
                  분석일 {formatKoreanDate(opportunity.forecast.analyzedAt)}
                </p>
                <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                  {opportunity.forecast.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  아직 다음 모집 시기를 예측하지 않습니다.
                </p>
                <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {opportunity.recruitmentStatus === "OPEN"
                    ? "현재 공식 공고가 열려 있어 예측보다 확인된 일정과 요구사항을 우선합니다. 반복 모집 기록이 충분히 검증된 뒤에만 예상 범위를 제공합니다."
                    : "반복 모집 패턴을 판단할 만큼 공식 기록이 충분하지 않습니다."}
                </p>
              </div>
            )}
          </Section>

          <Section title="확인된 모집 기록" tone="fact">
            <div className="space-y-5">
              {opportunity.recruitments.map((recruitment) => (
                <RecruitmentCard
                  key={recruitment.id}
                  recruitment={recruitment}
                />
              ))}
            </div>
          </Section>

          <Section title="지금 준비할 항목" tone="editorial">
            <ul className="space-y-3">
              {opportunity.preparationNotes.map((note) => (
                <li
                  key={note}
                  className="flex gap-3 text-sm leading-7 text-zinc-700 dark:text-zinc-300"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2.5 size-2 shrink-0 rounded-full bg-slate-500"
                  />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </Section>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/70">
            <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">
              공식 채용 페이지
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              지원 전에는 반드시 원문에서 마감과 세부 조건을 다시 확인하세요.
            </p>
            {applicationUrl ? (
              <a
                href={applicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950"
              >
                당근 채용 열기
              </a>
            ) : null}
          </div>
          <div className="rounded-3xl border border-zinc-200 p-5 text-xs leading-6 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            이 페이지는 채용을 보장하거나 기업을 대신하지 않습니다. 확인일 이후
            공고가 변경·조기 마감될 수 있습니다.
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "fact" | "analysis" | "editorial";
  children: React.ReactNode;
}) {
  const labels = {
    fact: "확인된 정보",
    analysis: "분석",
    editorial: "작성자 정리",
  } as const;
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white/85 p-6 dark:border-zinc-800 dark:bg-zinc-950/75 md:p-8">
      <p className="text-xs font-semibold tracking-[0.14em] text-slate-600 uppercase dark:text-slate-300">
        {labels[tone]}
      </p>
      <h2 className="mt-2 text-2xl font-bold text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function RecruitmentCard({ recruitment }: { recruitment: CareerRecruitment }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {recruitment.year}
          </p>
          <h3 className="mt-1 break-words font-bold text-zinc-950 dark:text-zinc-50">
            {recruitment.title}
          </h3>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {formatRecruitmentPeriod(recruitment)}
        </p>
      </div>

      {recruitment.eligibility.length ? (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            공식 지원 요건에서 확인한 포인트
          </h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {recruitment.eligibility.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {recruitment.process.length ? (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            전형
          </h4>
          <ol className="mt-3 flex flex-wrap gap-2">
            {recruitment.process
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((step, index) => (
                <li
                  key={`${step.order}-${step.label}`}
                  className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                >
                  {index + 1}. {step.label}
                </li>
              ))}
          </ol>
        </div>
      ) : null}

      <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          출처
        </p>
        <ul className="mt-2 space-y-2">
          {recruitment.sources.map((source) => (
            <li key={source.id}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
              >
                {source.title}
              </a>
              <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                {source.publisher ? `${source.publisher} · ` : ""}확인{" "}
                {formatKoreanDate(source.accessedAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function formatRecruitmentPeriod(recruitment: CareerRecruitment): string {
  if (!recruitment.openDate && !recruitment.closeDate) return "일정 미확인";
  if (!recruitment.openDate) {
    return `${formatKoreanDate(recruitment.closeDate!)} 마감`;
  }
  if (!recruitment.closeDate) {
    return `${formatKoreanDate(recruitment.openDate)} 시작`;
  }
  return `${formatKoreanDate(recruitment.openDate)} ~ ${formatKoreanDate(recruitment.closeDate)}`;
}

function formatDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  if (!from && !to) return "시기 미정";
  if (!from) return `${formatKoreanDate(to!)} 이전`;
  if (!to) return `${formatKoreanDate(from)} 이후`;
  return `${formatKoreanDate(from)} ~ ${formatKoreanDate(to)}`;
}

function forecastLabel(value: CareerForecastConfidence) {
  return {
    HIGH: "반복 패턴 강함",
    MEDIUM: "일부 패턴 확인",
    LOW: "근거 부족",
  }[value];
}

function formatKoreanDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}
