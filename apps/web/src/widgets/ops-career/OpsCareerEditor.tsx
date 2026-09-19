"use client";

import { useState } from "react";

export function OpsCareerEditor({
  selectedSlug,
  initialDocument,
}: {
  selectedSlug: string;
  initialDocument?: unknown;
}) {
  const [payload, setPayload] = useState(() =>
    initialDocument ? JSON.stringify(initialDocument, null, 2) : "",
  );
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!selectedSlug) return;
    setBusy(true);
    setStatus("불러오는 중…");
    try {
      const response = await fetch(
        `/api/ops/career?slug=${encodeURIComponent(selectedSlug)}`,
        { cache: "no-store" },
      );
      const body = (await response.json()) as unknown;
      if (!response.ok) throw new Error(`조회 실패 (${response.status})`);
      setPayload(JSON.stringify(body, null, 2));
      setStatus("백엔드 원본을 불러왔습니다.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "조회에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selectedSlug || !payload.trim()) return;
    setBusy(true);
    setStatus("저장하는 중…");
    try {
      const document = JSON.parse(payload) as unknown;
      const response = await fetch("/api/ops/career", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug, document }),
      });
      const body = (await response.json()) as unknown;
      if (!response.ok) throw new Error(`저장 실패 (${response.status})`);
      setPayload(JSON.stringify(body, null, 2));
      setStatus("초안을 저장했습니다. 공개 전 snapshot 갱신이 필요합니다.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "저장에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!selectedSlug || !payload.trim()) return;
    setBusy(true);
    setStatus("새 초안을 만드는 중…");
    try {
      const document = JSON.parse(payload) as unknown;
      const response = await fetch("/api/ops/career", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          slug: selectedSlug,
          document,
        }),
      });
      const body = (await response.json()) as unknown;
      if (!response.ok) throw new Error(`생성 실패 (${response.status})`);
      setPayload(JSON.stringify(body, null, 2));
      setStatus("초안을 만들었습니다. 검토 후 별도로 공개하세요.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "생성에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!selectedSlug) return;
    setBusy(true);
    setStatus("공개 상태로 전환하는 중…");
    try {
      const response = await fetch("/api/ops/career", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish", slug: selectedSlug }),
      });
      if (!response.ok) throw new Error(`공개 실패 (${response.status})`);
      setStatus(
        "백엔드에 공개했습니다. career:snapshot 실행과 프론트 배포 뒤 공개 페이지가 갱신됩니다.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "공개에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white/85 p-5 dark:border-zinc-800 dark:bg-zinc-950/75 md:p-7">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={load}
          disabled={busy || !selectedSlug}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-zinc-700"
        >
          백엔드 원본 불러오기
        </button>
        <button
          type="button"
          onClick={create}
          disabled={busy || !selectedSlug || !payload.trim()}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-zinc-700"
        >
          새 초안 생성
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !selectedSlug || !payload.trim()}
          className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
        >
          초안 저장
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={busy || !selectedSlug}
          className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-200"
        >
          공개
        </button>
      </div>

      <label className="mt-5 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Career admin document JSON
        <textarea
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          spellCheck={false}
          className="mt-2 min-h-[32rem] w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-6 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          placeholder="백엔드 원본을 불러오거나 { aggregate, metadata? } JSON을 입력하세요."
        />
      </label>
      <p
        aria-live="polite"
        className="mt-3 text-sm text-zinc-500 dark:text-zinc-400"
      >
        {status}
      </p>
    </section>
  );
}
