import type { Metadata } from "vinext/shims/metadata";

import { getCareerOpportunity } from "@/shared/career/data";
import { OpsCareerEditor } from "@/widgets/ops-career/OpsCareerEditor";

export const metadata: Metadata = {
  title: "SEOJing Ops Career",
  robots: { index: false, follow: false },
};

interface OpsCareerPageProps {
  searchParams?: Promise<{ slug?: string }>;
}

export default async function OpsCareerPage({
  searchParams,
}: OpsCareerPageProps) {
  const params = searchParams ? await searchParams : {};
  const selectedSlug = params.slug?.trim() || "daangn-frontend-intern";
  const snapshot = getCareerOpportunity(selectedSlug);
  const initialDocument =
    snapshot && snapshot.forecast === null
      ? {
          aggregate: {
            company: snapshot.company,
            opportunity: {
              slug: snapshot.slug,
              title: snapshot.title,
              role: snapshot.role,
              category: snapshot.category,
              recruitmentStatus: snapshot.recruitmentStatus,
              actualStatusAsOf: snapshot.updatedAt,
            },
            forecast: null,
            recruitments: snapshot.recruitments,
            preparationNotes: snapshot.preparationNotes,
            statusSources: Array.from(
              new Map(
                snapshot.recruitments
                  .flatMap((recruitment) => recruitment.sources)
                  .map((source) => [source.id, source]),
              ).values(),
            ),
          },
        }
      : undefined;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 text-zinc-950 dark:text-zinc-50">
      <section className="rounded-3xl border border-zinc-200 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70 md:p-8">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Internal ops · Cloudflare Access 보호 전제
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-5xl">
          Career Radar 운영
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
          구조화된 모집 기록과 출처를 백엔드에서 관리합니다. 공개 후에는 검증된
          snapshot을 갱신하고 프론트를 배포해야 `/career`에 반영됩니다.
        </p>
      </section>

      <form
        className="mt-6 flex flex-wrap items-end gap-2"
        action="/ops/career"
      >
        <label className="min-w-64 flex-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
          Opportunity slug
          <input
            name="slug"
            defaultValue={selectedSlug}
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <button className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950">
          열기
        </button>
      </form>

      <div className="mt-6">
        <OpsCareerEditor
          key={selectedSlug}
          selectedSlug={selectedSlug}
          initialDocument={initialDocument}
        />
      </div>
    </main>
  );
}
