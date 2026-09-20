import type { BlogEvidenceChecklistItem } from "@/shared/career/blog-evidence";

interface BlogEvidenceChecklistProps {
  items: BlogEvidenceChecklistItem[];
}

export function BlogEvidenceChecklist({ items }: BlogEvidenceChecklistProps) {
  const evidenceItems = items.filter(
    (item) => item.classification === "EVIDENCE_AVAILABLE",
  );
  const gapItems = items.filter((item) => item.classification === "NEEDS_WORK");

  return (
    <section
      aria-labelledby="blog-evidence-checklist-title"
      className="min-w-0 overflow-hidden rounded-3xl border border-zinc-200 bg-white/85 p-6 dark:border-zinc-800 dark:bg-zinc-950/75 md:p-8"
    >
      <p className="text-xs font-semibold tracking-[0.14em] text-slate-600 uppercase dark:text-slate-300">
        작성자 정리 · 블로그 검색
      </p>
      <h2
        id="blog-evidence-checklist-title"
        className="mt-2 text-2xl font-bold text-zinc-950 dark:text-zinc-50"
      >
        지원 준비 체크리스트
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
        확인된 지원 요건과 준비 메모에서 키워드를 정해 기존 글을 연결했습니다.
        연결된 글은 설명에 활용할 수 있는 기록일 뿐, 해당 역량의 숙련도를
        확정하지 않습니다.
      </p>

      <div className="mt-6 grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        <ChecklistGroup
          id="blog-evidence-available"
          title="블로그 근거로 어필 가능"
          description="관련 기록이 있는 항목입니다. 실제 기여와 결과가 글에 드러나는지 다시 확인하세요."
          items={evidenceItems}
          emptyMessage="현재 키워드 기준으로 바로 연결할 기존 글을 찾지 못했습니다."
        />
        <ChecklistGroup
          id="blog-evidence-gaps"
          title="추가 보완 추천"
          description="기존 글에서 충분한 연결 근거를 찾지 못한 항목입니다. 아래 행동부터 기록으로 남겨보세요."
          items={gapItems}
          emptyMessage="현재 추출된 항목에는 모두 연결 가능한 글이 있습니다. 다만 실제 기여와 결과는 각 글에서 다시 검토하세요."
        />
      </div>
    </section>
  );
}

function ChecklistGroup({
  id,
  title,
  description,
  items,
  emptyMessage,
}: {
  id: string;
  title: string;
  description: string;
  items: BlogEvidenceChecklistItem[];
  emptyMessage: string;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h3 id={id} className="text-lg font-bold text-zinc-950 dark:text-zinc-50">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        {description}
      </p>

      {items.length ? (
        <ul className="mt-4 space-y-4">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <ChecklistCard item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-4 text-sm leading-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

function ChecklistCard({ item }: { item: BlogEvidenceChecklistItem }) {
  const titleId = `blog-evidence-item-${item.id}`;

  return (
    <article
      aria-labelledby={titleId}
      className="min-w-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <h4
        id={titleId}
        className="break-words font-bold text-zinc-950 dark:text-zinc-50"
      >
        {item.title}
      </h4>

      <ul aria-label="핵심 키워드" className="mt-3 flex flex-wrap gap-2">
        {item.keywords.map((keyword) => (
          <li
            key={keyword}
            className="max-w-full rounded-full bg-white px-3 py-1 text-xs font-medium break-words text-slate-700 dark:bg-zinc-950 dark:text-slate-200"
          >
            {keyword}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <h5 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          왜 중요한가
        </h5>
        <p className="mt-1 text-sm leading-6 break-words text-zinc-700 dark:text-zinc-300">
          {item.whyItMatters}
        </p>
      </div>

      <div className="mt-4">
        <h5 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          연결할 블로그 글
        </h5>
        {item.evidenceLinks.length ? (
          <ul className="mt-2 space-y-2">
            {item.evidenceLinks.map((link) => (
              <li key={link.slug} className="min-w-0">
                <a
                  href={link.href}
                  className="block min-w-0 break-words text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-slate-200 dark:hover:text-white"
                >
                  {link.title}
                </a>
                <span className="mt-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  {link.evidenceKind === "PROJECT_RECORD"
                    ? "프로젝트·운영 기록"
                    : "학습 기록"}
                </span>
                {link.heading && link.heading !== link.title ? (
                  <span className="mt-1 block break-words text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    관련 섹션: {link.heading}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            연결 가능한 기존 글을 찾지 못했습니다.
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <h5 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          다음 행동
        </h5>
        <p className="mt-1 text-sm leading-6 break-words text-zinc-700 dark:text-zinc-300">
          {item.nextAction}
        </p>
      </div>
    </article>
  );
}
