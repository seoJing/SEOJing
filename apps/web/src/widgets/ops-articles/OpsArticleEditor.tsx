"use client";

import { useEffect, useMemo, useState } from "react";

type EditorArticle = {
  slug?: string;
  title?: string;
  description?: string | null;
  status?: string;
  sourceFormat?: string;
  sourceText?: string;
  currentRevisionNumber?: number | null;
  publishedAt?: string | null;
  updatedAt?: string;
};

type PublicReadback = {
  status?: number;
  title?: string;
  updatedAt?: string;
  publishedAt?: string | null;
  htmlLength?: number;
  missing?: boolean;
};

type EditorPayload = {
  ok?: boolean;
  article?: EditorArticle;
  publicReadback?: PublicReadback;
  error?: string;
};

type MutationPayload = {
  ok?: boolean;
  article?: EditorArticle;
  error?: string;
  status?: number;
};

export function OpsArticleEditor({ selectedSlug }: { selectedSlug: string }) {
  const [payload, setPayload] = useState<EditorPayload | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "saving" | "publishing"
  >("idle");
  const [message, setMessage] = useState("");

  const isBusy = status !== "idle";
  const article = payload?.article;
  const publicReadback = payload?.publicReadback;
  const hasSelection = selectedSlug.trim().length > 0;

  useEffect(() => {
    if (!hasSelection) return;
    const controller = new AbortController();
    fetch(`/api/ops/articles?slug=${encodeURIComponent(selectedSlug)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as EditorPayload;
        if (!response.ok || !body.ok) {
          throw new Error(body.error ?? `read failed: ${response.status}`);
        }
        setPayload(body);
        setSourceText(body.article?.sourceText ?? "");
        setTitle(body.article?.title ?? "");
        setDescription(body.article?.description ?? "");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const text = error instanceof Error ? error.message : "unknown error";
        setPayload({ ok: false, error: text });
        setMessage(`불러오기 실패: ${text}`);
      })
      .finally(() => {
        if (!controller.signal.aborted) setStatus("idle");
      });

    return () => controller.abort();
  }, [hasSelection, selectedSlug]);

  const dirty = useMemo(() => {
    return (
      sourceText !== (article?.sourceText ?? "") ||
      title !== (article?.title ?? "") ||
      description !== (article?.description ?? "")
    );
  }, [article, description, sourceText, title]);

  async function mutate(action: "saveRevision" | "publish") {
    setStatus(action === "saveRevision" ? "saving" : "publishing");
    setMessage("");
    try {
      const response = await fetch("/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          slug: selectedSlug,
          title,
          description,
          sourceText,
        }),
      });
      const body = (await response.json()) as MutationPayload;
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? `request failed: ${response.status}`);
      }
      setMessage(
        action === "saveRevision"
          ? "revision 저장 완료. 아직 공개 본문은 publish 전까지 유지됩니다."
          : "publish 완료. public API/body readback을 다시 불러옵니다.",
      );
      await reload();
    } catch (error) {
      const text = error instanceof Error ? error.message : "unknown error";
      setMessage(
        `${action === "saveRevision" ? "저장" : "발행"} 실패: ${text}`,
      );
    } finally {
      setStatus("idle");
    }
  }

  async function reload() {
    const response = await fetch(
      `/api/ops/articles?slug=${encodeURIComponent(selectedSlug)}`,
      { cache: "no-store" },
    );
    const body = (await response.json()) as EditorPayload;
    if (!response.ok || !body.ok) {
      throw new Error(body.error ?? `reload failed: ${response.status}`);
    }
    setPayload(body);
    setSourceText(body.article?.sourceText ?? "");
    setTitle(body.article?.title ?? "");
    setDescription(body.article?.description ?? "");
  }

  if (!hasSelection) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-8 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-300">
        왼쪽 목록에서 글을 고르거나 URL에 <code>?slug=...</code>를 붙이면 editor
        state를 불러옵니다.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border border-zinc-200 bg-white/80 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Selected article
            </p>
            <h2 className="mt-1 break-all text-2xl font-semibold">
              {selectedSlug}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <StatusPill label="status" value={article?.status ?? "-"} />
            <StatusPill
              label="revision"
              value={String(article?.currentRevisionNumber ?? "-")}
            />
            <StatusPill
              label="public"
              value={
                publicReadback?.missing
                  ? "missing"
                  : String(publicReadback?.status ?? "-")
              }
            />
          </div>
        </div>
        {message ? (
          <p className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {message}
          </p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white/80 p-5 dark:border-zinc-800 dark:bg-zinc-950/70">
        <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-300">
          title
          <input
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isBusy}
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-zinc-600 dark:text-zinc-300">
          description
          <input
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isBusy}
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-zinc-600 dark:text-zinc-300">
          MDX source
          <textarea
            className="mt-2 min-h-[32rem] w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 font-mono text-sm leading-6 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            disabled={isBusy}
            spellCheck={false}
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 dark:bg-zinc-50 dark:text-zinc-950"
            onClick={() => void mutate("saveRevision")}
            disabled={isBusy || !dirty || !sourceText.trim()}
          >
            {status === "saving" ? "저장 중" : "revision 저장"}
          </button>
          <button
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-700 dark:text-zinc-100"
            onClick={() => void mutate("publish")}
            disabled={isBusy}
          >
            {status === "publishing" ? "발행 중" : "latest revision 발행"}
          </button>
          <button
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-45 dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={() => void reload()}
            disabled={isBusy}
          >
            다시 불러오기
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          저장은 새 revision만 만들고, 공개 본문은 발행 버튼을 누를 때 바뀝니다.
          ADMIN_API_TOKEN은 이 화면에 내려오지 않고 `/api/ops/articles` 서버
          프록시에서만 사용합니다.
        </p>
      </div>
    </section>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      {label}:{" "}
      <strong className="text-zinc-950 dark:text-zinc-50">{value}</strong>
    </span>
  );
}
