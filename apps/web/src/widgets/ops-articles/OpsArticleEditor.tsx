"use client";

import { useEffect, useMemo, useState } from "react";

import { ArticleImage, ArticleQuiz, ArticleQuizItem, CodeBlock } from "@app/ui";

import {
  normalizeBlocks,
  toBackendBlocks,
  type ArticleBlock,
  type BlockType,
} from "./ops-article-editor.utils";
import {
  NativeDocumentEditor,
  emptyArticleDocument,
  type ArticleDocument,
} from "./NativeDocumentEditor";

type EditorArticle = {
  slug?: string;
  title?: string;
  description?: string | null;
  category?: string;
  status?: string;
  sourceFormat?: string;
  document?: ArticleDocument | null;
  tags?: string[];
  cover?: { src: string; alt: string; caption?: string; kind?: string } | null;
  summaryVideo?: {
    src: string;
    title?: string;
    caption?: string;
    poster?: string;
    subtitles?: string;
    provider?: string;
  } | null;
  displayDate?: string | null;
  displayUpdatedAt?: string | null;
  editingRevisionId?: string | null;
  sourceText?: string;
  renderedHtml?: string | null;
  previewRenderedHtml?: string | null;
  previewIssues?: Array<{ name: string; line: number }>;
  blocks?: ArticleBlock[];
  currentRevisionNumber?: number | null;
  editingRevisionNumber?: number | null;
  hasUnpublishedChanges?: boolean;
  revisions?: Array<{
    revisionNumber: number;
    sourceFormat?: string;
    changeSummary?: string | null;
    createdAt: string;
    isPublished: boolean;
  }>;
  publishedAt?: string | null;
  updatedAt?: string;
};

type EditorPayload = {
  ok?: boolean;
  article?: EditorArticle;
  error?: string;
};

type MutationPayload = {
  ok?: boolean;
  article?: EditorArticle;
  error?: string;
  status?: number;
  issues?: Array<{ name: string; line: number }>;
  backendPublished?: boolean;
  retryAction?: string;
};

const blockTypes: Array<{ type: BlockType; label: string }> = [
  { type: "PARAGRAPH", label: "본문" },
  { type: "HEADING", label: "제목" },
  { type: "CODE", label: "코드" },
  { type: "IMAGE", label: "이미지" },
  { type: "CALLOUT", label: "메모" },
  { type: "QUIZ", label: "퀴즈" },
];

export function OpsArticleEditor({ selectedSlug }: { selectedSlug: string }) {
  const [payload, setPayload] = useState<EditorPayload | null>(null);
  const [blocks, setBlocks] = useState<ArticleBlock[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("SEOJing");
  const [sourceText, setSourceText] = useState("");
  const [document, setDocument] =
    useState<ArticleDocument>(emptyArticleDocument);
  const [tags, setTags] = useState("");
  const [coverSrc, setCoverSrc] = useState("");
  const [coverAlt, setCoverAlt] = useState("");
  const [displayDate, setDisplayDate] = useState("");
  const [displayUpdatedAt, setDisplayUpdatedAt] = useState("");
  const [summaryVideoSrc, setSummaryVideoSrc] = useState("");
  const [summaryVideoTitle, setSummaryVideoTitle] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "saving" | "publishing"
  >("idle");
  const [message, setMessage] = useState("");
  const [snapshotSyncRequired, setSnapshotSyncRequired] = useState(false);

  const isBusy = status !== "idle";
  const article = payload?.article;
  const hasSelection = selectedSlug.trim().length > 0;
  const isBlockArticle = article?.sourceFormat === "BLOCKS";
  const isDocumentArticle = article?.sourceFormat === "DOCUMENT";

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
        setBlocks(normalizeBlocks(body.article?.blocks));
        setTitle(body.article?.title ?? "");
        setDescription(body.article?.description ?? "");
        setCategory(body.article?.category ?? "SEOJing");
        setSourceText(body.article?.sourceText ?? "");
        setDocument(body.article?.document ?? emptyArticleDocument);
        setTags(body.article?.tags?.join(", ") ?? "");
        setCoverSrc(body.article?.cover?.src ?? "");
        setCoverAlt(body.article?.cover?.alt ?? "");
        setDisplayDate(body.article?.displayDate?.slice(0, 10) ?? "");
        setDisplayUpdatedAt(body.article?.displayUpdatedAt?.slice(0, 10) ?? "");
        setSummaryVideoSrc(body.article?.summaryVideo?.src ?? "");
        setSummaryVideoTitle(body.article?.summaryVideo?.title ?? "");
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
      Boolean(article) &&
      (title !== (article?.title ?? "") ||
        description !== (article?.description ?? "") ||
        category !== (article?.category ?? "SEOJing") ||
        (isDocumentArticle
          ? JSON.stringify(document) !==
              JSON.stringify(article?.document ?? emptyArticleDocument) ||
            tags !== (article?.tags?.join(", ") ?? "") ||
            coverSrc !== (article?.cover?.src ?? "") ||
            coverAlt !== (article?.cover?.alt ?? "") ||
            displayDate !== (article?.displayDate?.slice(0, 10) ?? "") ||
            displayUpdatedAt !==
              (article?.displayUpdatedAt?.slice(0, 10) ?? "") ||
            summaryVideoSrc !== (article?.summaryVideo?.src ?? "") ||
            summaryVideoTitle !== (article?.summaryVideo?.title ?? "")
          : isBlockArticle
            ? JSON.stringify(blocks) !==
              JSON.stringify(normalizeBlocks(article?.blocks))
            : false))
    );
  }, [
    article,
    blocks,
    category,
    description,
    isBlockArticle,
    isDocumentArticle,
    document,
    tags,
    coverSrc,
    coverAlt,
    displayDate,
    displayUpdatedAt,
    summaryVideoSrc,
    summaryVideoTitle,
    title,
  ]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function mutate(
    action:
      | "saveBlocks"
      | "saveRevision"
      | "saveDocument"
      | "restoreRevision"
      | "publish"
      | "syncPublished"
      | "unpublish"
      | "archive"
      | "delete",
    revisionNumber?: number,
  ) {
    setStatus(action === "publish" ? "publishing" : "saving");
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
          category,
          blocks: toBackendBlocks(blocks),
          sourceText,
          document,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          cover: coverSrc
            ? { ...article?.cover, src: coverSrc, alt: coverAlt }
            : null,
          summaryVideo: summaryVideoSrc
            ? {
                ...article?.summaryVideo,
                src: summaryVideoSrc,
                title: summaryVideoTitle,
              }
            : null,
          displayDate: displayDate || null,
          displayUpdatedAt: displayUpdatedAt || null,
          expectedRevisionId: article?.editingRevisionId,
          revisionNumber,
        }),
      });
      const body = (await response.json()) as MutationPayload;
      if (!response.ok || !body.ok) {
        if (body.backendPublished && body.retryAction === "syncPublished") {
          setSnapshotSyncRequired(true);
        }
        const issue = body.issues?.[0];
        throw new Error(
          issue
            ? `${body.error ?? "본문 변환 미완료"} (${issue.name}, ${issue.line}행)`
            : (body.error ?? `request failed: ${response.status}`),
        );
      }
      setSnapshotSyncRequired(false);
      if (action === "delete") {
        window.location.assign("/ops/articles");
        return;
      }
      setMessage(
        action === "publish"
          ? "발행 완료. 공개 글과 목록을 다시 불러옵니다."
          : action === "syncPublished"
            ? "공개 사본 동기화가 완료됐습니다."
            : action === "unpublish"
              ? "비공개 초안으로 전환했습니다."
              : action === "archive"
                ? "글을 보관하고 공개 목록에서 내렸습니다."
                : action === "restoreRevision"
                  ? "이전 revision을 새 비공개 수정본으로 복원했습니다. 확인 후 발행하세요."
                  : "revision 저장 완료. 공개 본문은 발행 전까지 유지됩니다.",
      );
      await reload();
    } catch (error) {
      const text = error instanceof Error ? error.message : "unknown error";
      setMessage(`${action === "publish" ? "발행" : "저장"} 실패: ${text}`);
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
    setBlocks(normalizeBlocks(body.article?.blocks));
    setTitle(body.article?.title ?? "");
    setDescription(body.article?.description ?? "");
    setCategory(body.article?.category ?? "SEOJing");
    setSourceText(body.article?.sourceText ?? "");
    setDocument(body.article?.document ?? emptyArticleDocument);
    setTags(body.article?.tags?.join(", ") ?? "");
    setCoverSrc(body.article?.cover?.src ?? "");
    setCoverAlt(body.article?.cover?.alt ?? "");
    setDisplayDate(body.article?.displayDate?.slice(0, 10) ?? "");
    setDisplayUpdatedAt(body.article?.displayUpdatedAt?.slice(0, 10) ?? "");
    setSummaryVideoSrc(body.article?.summaryVideo?.src ?? "");
    setSummaryVideoTitle(body.article?.summaryVideo?.title ?? "");
  }

  if (!hasSelection) {
    return <NewCmsArticleForm />;
  }

  return (
    <section className="space-y-4">
      <ArticleStatusCard
        article={article}
        message={message}
        selectedSlug={selectedSlug}
      />

      {article ? (
        <div className="sm:rounded-3xl sm:border sm:border-zinc-200 sm:bg-white/80 sm:p-5 sm:dark:border-zinc-800 sm:dark:bg-zinc-950/70">
          <ArticleMetadata
            description={description}
            disabled={isBusy || (!isDocumentArticle && !isBlockArticle)}
            onDescriptionChange={setDescription}
            onTitleChange={setTitle}
            title={title}
          />
          <label className="mt-4 block text-sm font-medium text-zinc-600 dark:text-zinc-300">
            category
            <input
              list="cms-article-categories"
              className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 sm:rounded-2xl sm:px-4 sm:py-3"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={isBusy || (!isDocumentArticle && !isBlockArticle)}
              placeholder="Study 또는 새 카테고리 입력"
            />
            <datalist id="cms-article-categories">
              <option value="SEOJing" />
              <option value="Study" />
              <option value="okayJing" />
              <option value="CLAB" />
              <option value="KD Team" />
            </datalist>
          </label>
          {isDocumentArticle ? (
            <>
              <DocumentMetadata
                tags={tags}
                onTagsChange={setTags}
                coverSrc={coverSrc}
                onCoverSrcChange={setCoverSrc}
                coverAlt={coverAlt}
                onCoverAltChange={setCoverAlt}
                displayDate={displayDate}
                onDisplayDateChange={setDisplayDate}
                displayUpdatedAt={displayUpdatedAt}
                onDisplayUpdatedAtChange={setDisplayUpdatedAt}
                summaryVideoSrc={summaryVideoSrc}
                onSummaryVideoSrcChange={setSummaryVideoSrc}
                summaryVideoTitle={summaryVideoTitle}
                onSummaryVideoTitleChange={setSummaryVideoTitle}
                disabled={isBusy}
              />
              <NativeDocumentEditor
                key={`${selectedSlug}:${article.editingRevisionId ?? "draft"}`}
                value={document}
                onChange={setDocument}
                disabled={isBusy}
              />
            </>
          ) : isBlockArticle ? (
            <BlockEditor
              blocks={blocks}
              disabled={isBusy}
              onChange={setBlocks}
            />
          ) : (
            <div className="mt-6 min-w-0 space-y-4">
              <p
                role="status"
                className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              >
                이 글은 이전 형식입니다. JSON 문서 전환을 완료한 뒤
                리치에디터에서 수정·공개할 수 있습니다.
              </p>
              <TextAreaField
                label="이전 원문 (읽기 전용)"
                value={sourceText}
                onChange={() => {}}
                disabled
                mono
                rows={16}
              />
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {snapshotSyncRequired ? (
              <button
                type="button"
                className="rounded-full border border-amber-500 px-5 py-2.5 text-sm font-semibold text-amber-800 disabled:opacity-45"
                disabled={isBusy}
                onClick={() => void mutate("syncPublished")}
              >
                공개 사본 다시 동기화
              </button>
            ) : null}
            <button
              className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 dark:bg-zinc-50 dark:text-zinc-950"
              onClick={() =>
                void mutate(isDocumentArticle ? "saveDocument" : "saveBlocks")
              }
              disabled={
                isBusy ||
                (!isDocumentArticle && !isBlockArticle) ||
                (isDocumentArticle
                  ? !document.content?.length || !title.trim()
                  : blocks.length === 0)
              }
            >
              {status === "saving" ? "저장 중" : "저장"}
            </button>
            <button
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-45 dark:border-zinc-700 dark:text-zinc-100"
              onClick={() => {
                if (
                  article.status === "PUBLISHED" &&
                  !article.hasUnpublishedChanges
                ) {
                  if (window.confirm("이 글을 비공개로 전환할까요?"))
                    void mutate("unpublish");
                } else if (window.confirm("저장된 최신 수정본을 공개할까요?")) {
                  void mutate("publish");
                }
              }}
              disabled={
                isBusy ||
                dirty ||
                (!isDocumentArticle &&
                  !isBlockArticle &&
                  (article.status !== "PUBLISHED" ||
                    article.hasUnpublishedChanges))
              }
            >
              {status === "publishing"
                ? "변경 중"
                : article.status === "PUBLISHED" &&
                    !article.hasUnpublishedChanges
                  ? "공개 → 비공개"
                  : "비공개 → 공개"}
            </button>
            <button
              className="rounded-full border border-rose-400 px-5 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-45"
              onClick={() =>
                window.confirm(
                  "CMS 글과 모든 revision을 영구 삭제합니다. 계속할까요?",
                ) && void mutate("delete")
              }
              disabled={isBusy}
            >
              삭제
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            저장은 새 비공개 revision을 만듭니다. 공개 상태의 글도 저장된 최신
            수정본은 공개로 전환하기 전까지 반영되지 않습니다.
          </p>
          <details className="mt-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <summary className="cursor-pointer text-sm font-semibold">
              revision 기록 ({article.revisions?.length ?? 0})
            </summary>
            <ul className="mt-3 space-y-2">
              {article.revisions?.map((revision) => (
                <li
                  key={revision.revisionNumber}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    #{revision.revisionNumber} ·{" "}
                    {revision.sourceFormat ?? "이전 형식"} ·{" "}
                    {revision.changeSummary ?? "수정"}
                    {revision.isPublished ? " · 현재 공개본" : ""}
                  </span>
                  <button
                    type="button"
                    className="rounded-full border border-zinc-300 px-3 py-1 text-xs disabled:opacity-40 dark:border-zinc-700"
                    disabled={
                      isBusy ||
                      (!isDocumentArticle && !isBlockArticle) ||
                      revision.sourceFormat !== article.sourceFormat ||
                      dirty ||
                      revision.revisionNumber === article.editingRevisionNumber
                    }
                    onClick={() =>
                      window.confirm(
                        `revision #${revision.revisionNumber}을 새 비공개 수정본으로 복원할까요?`,
                      ) &&
                      void mutate("restoreRevision", revision.revisionNumber)
                    }
                  >
                    수정본으로 복원
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : (
        <p className="rounded-2xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
          이 글의 서버 편집본을 찾지 못했습니다. 아직 MDX 저장소에서만 운영 중인
          글일 수 있습니다.
        </p>
      )}
    </section>
  );
}

function NewCmsArticleForm() {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("SEOJing");
  const [document, setDocument] =
    useState<ArticleDocument>(emptyArticleDocument);
  const [tags, setTags] = useState("");
  const [coverSrc, setCoverSrc] = useState("");
  const [coverAlt, setCoverAlt] = useState("");
  const [displayDate, setDisplayDate] = useState("");
  const [displayUpdatedAt, setDisplayUpdatedAt] = useState("");
  const [summaryVideoSrc, setSummaryVideoSrc] = useState("");
  const [summaryVideoTitle, setSummaryVideoTitle] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function createDraft() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/ops/articles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "createDocument",
          slug,
          title,
          description,
          category,
          document,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          cover: coverSrc ? { src: coverSrc, alt: coverAlt } : undefined,
          summaryVideo: summaryVideoSrc
            ? { src: summaryVideoSrc, title: summaryVideoTitle }
            : undefined,
          displayDate: displayDate || undefined,
          displayUpdatedAt: displayUpdatedAt || undefined,
        }),
      });
      const body = (await response.json()) as MutationPayload;
      if (!response.ok || !body.ok || !body.article?.slug) {
        throw new Error(
          body.error ?? `draft create failed: ${response.status}`,
        );
      }
      window.location.assign(
        `/ops/articles/edit?slug=${encodeURIComponent(body.article.slug)}`,
      );
    } catch (error) {
      setMessage(
        `CMS 초안 생성 실패: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-6 dark:border-zinc-700 dark:bg-zinc-950/60">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
        CMS native authoring
      </p>
      <h2 className="mt-2 text-2xl font-semibold">새 CMS 글</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        새 글은 서버의 JSON 문서 revision으로 저장됩니다.
      </p>
      <div className="mt-5">
        <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-300">
          slug
          <input
            className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
            placeholder="okayjing/cms-native-first-post"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            disabled={saving}
          />
        </label>
      </div>
      <ArticleMetadata
        description={description}
        disabled={saving}
        onDescriptionChange={setDescription}
        onTitleChange={setTitle}
        title={title}
      />
      <label className="mt-4 block text-sm font-medium text-zinc-600 dark:text-zinc-300">
        category
        <input
          list="cms-article-categories"
          className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 sm:rounded-2xl sm:px-4 sm:py-3"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          disabled={saving}
          placeholder="Study 또는 새 카테고리 입력"
        />
        <datalist id="cms-article-categories">
          <option value="SEOJing" />
          <option value="Study" />
          <option value="okayJing" />
          <option value="CLAB" />
          <option value="KD Team" />
        </datalist>
      </label>
      <DocumentMetadata
        tags={tags}
        onTagsChange={setTags}
        coverSrc={coverSrc}
        onCoverSrcChange={setCoverSrc}
        coverAlt={coverAlt}
        onCoverAltChange={setCoverAlt}
        displayDate={displayDate}
        onDisplayDateChange={setDisplayDate}
        displayUpdatedAt={displayUpdatedAt}
        onDisplayUpdatedAtChange={setDisplayUpdatedAt}
        summaryVideoSrc={summaryVideoSrc}
        onSummaryVideoSrcChange={setSummaryVideoSrc}
        summaryVideoTitle={summaryVideoTitle}
        onSummaryVideoTitleChange={setSummaryVideoTitle}
        disabled={saving}
      />
      <NativeDocumentEditor
        value={document}
        onChange={setDocument}
        disabled={saving}
      />
      {message ? (
        <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
          {message}
        </p>
      ) : null}
      <button
        className="mt-5 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 dark:bg-zinc-50 dark:text-zinc-950"
        onClick={() => void createDraft()}
        disabled={
          saving || !slug.trim() || !title.trim() || !document.content?.length
        }
      >
        {saving ? "CMS 초안 생성 중" : "CMS 초안 만들기"}
      </button>
    </section>
  );
}

function DocumentMetadata({
  tags,
  onTagsChange,
  coverSrc,
  onCoverSrcChange,
  coverAlt,
  onCoverAltChange,
  displayDate,
  onDisplayDateChange,
  displayUpdatedAt,
  onDisplayUpdatedAtChange,
  summaryVideoSrc,
  onSummaryVideoSrcChange,
  summaryVideoTitle,
  onSummaryVideoTitleChange,
  disabled,
}: {
  tags: string;
  onTagsChange: (value: string) => void;
  coverSrc: string;
  onCoverSrcChange: (value: string) => void;
  coverAlt: string;
  onCoverAltChange: (value: string) => void;
  displayDate: string;
  onDisplayDateChange: (value: string) => void;
  displayUpdatedAt: string;
  onDisplayUpdatedAtChange: (value: string) => void;
  summaryVideoSrc: string;
  onSummaryVideoSrcChange: (value: string) => void;
  summaryVideoTitle: string;
  onSummaryVideoTitleChange: (value: string) => void;
  disabled: boolean;
}) {
  const inputClass =
    "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900";
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        태그 (쉼표로 구분)
        <input
          className={inputClass}
          value={tags}
          onChange={(event) => onTagsChange(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="text-sm">
        표시 날짜
        <input
          type="date"
          className={inputClass}
          value={displayDate}
          onChange={(event) => onDisplayDateChange(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="text-sm">
        수정 표시 날짜
        <input
          type="date"
          className={inputClass}
          value={displayUpdatedAt}
          onChange={(event) => onDisplayUpdatedAtChange(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="text-sm">
        대표 이미지 URL
        <input
          className={inputClass}
          value={coverSrc}
          onChange={(event) => onCoverSrcChange(event.target.value)}
          disabled={disabled}
          placeholder="/images/cover.png"
        />
      </label>
      <label className="text-sm">
        대표 이미지 설명
        <input
          className={inputClass}
          value={coverAlt}
          onChange={(event) => onCoverAltChange(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="text-sm">
        요약 영상 URL
        <input
          className={inputClass}
          value={summaryVideoSrc}
          onChange={(event) => onSummaryVideoSrcChange(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="text-sm">
        요약 영상 제목
        <input
          className={inputClass}
          value={summaryVideoTitle}
          onChange={(event) => onSummaryVideoTitleChange(event.target.value)}
          disabled={disabled}
        />
      </label>
    </div>
  );
}

function ArticleMetadata({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  disabled,
}: {
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      <label className="mt-4 block text-sm font-medium text-zinc-600 dark:text-zinc-300">
        title
        <input
          className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 sm:rounded-2xl sm:px-4 sm:py-3"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label className="mt-4 block text-sm font-medium text-zinc-600 dark:text-zinc-300">
        description
        <input
          className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          disabled={disabled}
        />
      </label>
    </>
  );
}

function BlockEditor({
  blocks,
  onChange,
  disabled,
}: {
  blocks: ArticleBlock[];
  onChange: (blocks: ArticleBlock[]) => void;
  disabled: boolean;
}) {
  function update(index: number, next: ArticleBlock) {
    onChange(
      blocks.map((block, blockIndex) => (blockIndex === index ? next : block)),
    );
  }
  function remove(index: number) {
    onChange(blocks.filter((_, blockIndex) => blockIndex !== index));
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const current = next[index];
    const destination = next[target];
    if (!current || !destination) return;
    next[index] = destination;
    next[target] = current;
    onChange(next);
  }
  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">콘텐츠 블록</h3>
        <div className="flex flex-wrap gap-2">
          {blockTypes.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-45 dark:border-zinc-700 dark:hover:bg-zinc-900"
              onClick={() => onChange([...blocks, defaultBlock(type)])}
              disabled={disabled}
            >
              + {label}
            </button>
          ))}
        </div>
      </div>
      {blocks.map((block, index) => (
        <BlockCard
          block={block}
          disabled={disabled}
          index={index}
          key={block.id ?? `${block.type}-${index}`}
          onChange={(next) => update(index, next)}
          onMoveDown={() => move(index, 1)}
          onMoveUp={() => move(index, -1)}
          onRemove={() => remove(index)}
          canMoveDown={index < blocks.length - 1}
          canMoveUp={index > 0}
        />
      ))}
    </div>
  );
}

function BlockCard({
  block,
  index,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  disabled,
}: {
  block: ArticleBlock;
  index: number;
  onChange: (block: ArticleBlock) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled: boolean;
}) {
  const content = block.content;
  const set = (key: string, value: string | number | string[]) =>
    onChange({ ...block, content: { ...content, [key]: value } });
  const switchType = (type: BlockType) =>
    onChange({ ...block, ...defaultBlock(type) });
  return (
    <article className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-zinc-500">
          block {index + 1}
        </span>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="text-xs text-zinc-600 disabled:opacity-35 dark:text-zinc-300"
            onClick={onMoveUp}
            disabled={disabled || !canMoveUp}
          >
            위로
          </button>
          <button
            type="button"
            className="text-xs text-zinc-600 disabled:opacity-35 dark:text-zinc-300"
            onClick={onMoveDown}
            disabled={disabled || !canMoveDown}
          >
            아래로
          </button>
          <select
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            value={block.type}
            onChange={(event) => switchType(event.target.value as BlockType)}
            disabled={disabled}
          >
            {blockTypes.map(({ type, label }) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="text-xs text-rose-600 disabled:opacity-45"
            onClick={onRemove}
            disabled={disabled}
          >
            삭제
          </button>
        </div>
      </div>
      {block.type === "PARAGRAPH" ? (
        <TextAreaField
          label="본문"
          value={stringValue(content.text)}
          onChange={(value) => set("text", value)}
          disabled={disabled}
        />
      ) : null}
      {block.type === "HEADING" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[7rem_1fr]">
          <label className="text-xs text-zinc-500">
            레벨
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={numberValue(content.level, 2)}
              onChange={(event) => set("level", Number(event.target.value))}
              disabled={disabled}
            >
              {[1, 2, 3, 4].map((level) => (
                <option key={level} value={level}>
                  H{level}
                </option>
              ))}
            </select>
          </label>
          <TextField
            label="제목"
            value={stringValue(content.text)}
            onChange={(value) => set("text", value)}
            disabled={disabled}
          />
        </div>
      ) : null}
      {block.type === "CODE" ? (
        <>
          <TextField
            label="언어"
            value={stringValue(content.language, "ts")}
            onChange={(value) => set("language", value)}
            disabled={disabled}
          />
          <TextAreaField
            label="코드"
            value={stringValue(content.code)}
            onChange={(value) => set("code", value)}
            disabled={disabled}
            mono
          />
        </>
      ) : null}
      {block.type === "IMAGE" ? (
        <>
          <TextField
            label="이미지 URL"
            value={stringValue(content.url)}
            onChange={(value) => set("url", value)}
            disabled={disabled}
          />
          <TextField
            label="대체 텍스트"
            value={stringValue(content.alt)}
            onChange={(value) => set("alt", value)}
            disabled={disabled}
          />
          <TextField
            label="캡션"
            value={stringValue(content.caption)}
            onChange={(value) => set("caption", value)}
            disabled={disabled}
          />
        </>
      ) : null}
      {block.type === "CALLOUT" ? (
        <>
          <TextField
            label="제목 (선택)"
            value={stringValue(content.title)}
            onChange={(value) => set("title", value)}
            disabled={disabled}
          />
          <TextAreaField
            label="메모"
            value={stringValue(content.text)}
            onChange={(value) => set("text", value)}
            disabled={disabled}
          />
        </>
      ) : null}
      {block.type === "QUIZ" ? (
        <>
          <TextAreaField
            label="질문"
            value={stringValue(content.question)}
            onChange={(value) => set("question", value)}
            disabled={disabled}
          />
          <TextAreaField
            label="선택지 (한 줄에 하나, 선택)"
            value={arrayValue(content.choices).join("\n")}
            onChange={(value) =>
              set(
                "choices",
                value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
              )
            }
            disabled={disabled}
          />
          <TextAreaField
            label="정답 또는 해설"
            value={stringValue(content.answer)}
            onChange={(value) => set("answer", value)}
            disabled={disabled}
          />
        </>
      ) : null}
      <div className="article-prose mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <CmsPreviewBlock block={block} />
      </div>
    </article>
  );
}

function CmsPreviewBlock({ block }: { block: ArticleBlock }) {
  const content = block.content;
  if (block.type === "HEADING") {
    const level = numberValue(content.level, 2);
    const text = stringValue(content.text, "제목");
    if (level === 1) return <h1>{text}</h1>;
    if (level === 3) return <h3>{text}</h3>;
    if (level === 4) return <h4>{text}</h4>;
    return <h2>{text}</h2>;
  }
  if (block.type === "PARAGRAPH")
    return <p>{stringValue(content.text, "본문을 입력하세요.")}</p>;
  if (block.type === "CODE") {
    const code = stringValue(content.code, "// 코드를 입력하세요");
    return (
      <CodeBlock
        language={stringValue(content.language, "text")}
        plainText={code}
      >
        {code}
      </CodeBlock>
    );
  }
  if (block.type === "IMAGE") {
    const url = stringValue(content.url);
    return url ? (
      <ArticleImage
        src={url}
        alt={stringValue(content.alt)}
        caption={stringValue(content.caption) || undefined}
      />
    ) : (
      <p className="text-sm text-zinc-500">
        이미지 URL을 입력하면 여기서 확인할 수 있습니다.
      </p>
    );
  }
  if (block.type === "CALLOUT") {
    return (
      <aside data-callout-tone={stringValue(content.tone, "note")}>
        <strong>{stringValue(content.title) || "메모"}</strong>
        <p>{stringValue(content.text, "메모 내용을 입력하세요.")}</p>
      </aside>
    );
  }
  const question = stringValue(content.question, "질문을 입력하세요.");
  return (
    <ArticleQuiz>
      <ArticleQuizItem
        mode={arrayValue(content.choices).length ? "multiple" : "description"}
        question={question}
        choices={arrayValue(content.choices)}
        answer={stringValue(content.answer)}
        explanation={stringValue(content.explanation) || undefined}
      />
    </ArticleQuiz>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="mt-3 block text-xs font-medium text-zinc-500">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}
function TextAreaField({
  label,
  value,
  onChange,
  disabled,
  mono = false,
  minimalMobile = false,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  mono?: boolean;
  minimalMobile?: boolean;
  rows?: number;
}) {
  return (
    <label className="mt-3 block text-xs font-medium text-zinc-500">
      {label}
      <textarea
        rows={rows}
        className={`mt-1 min-h-24 w-full min-w-0 max-w-full resize-y text-sm text-zinc-950 dark:text-zinc-50 ${minimalMobile ? "border-0 border-b border-zinc-200 bg-transparent px-0 py-1 focus:border-zinc-500 focus:outline-none sm:rounded-lg sm:border sm:bg-white sm:px-3 sm:py-2 sm:dark:border-zinc-700 sm:dark:bg-zinc-950" : "rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"} ${mono ? "font-mono" : ""}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
  );
}
function defaultBlock(type: BlockType): ArticleBlock {
  const content: Record<BlockType, Record<string, unknown>> = {
    PARAGRAPH: { text: "" },
    HEADING: { level: 2, text: "" },
    CODE: { language: "ts", code: "" },
    IMAGE: { url: "", alt: "", caption: "" },
    CALLOUT: { tone: "note", title: "", text: "" },
    QUIZ: { question: "", choices: [], answer: "", explanation: "" },
  };
  return { type, content: content[type] };
}
function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}
function arrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function ArticleStatusCard({
  article,
  message,
  selectedSlug,
}: {
  article?: EditorArticle;
  message: string;
  selectedSlug: string;
}) {
  return (
    <div className="sm:rounded-3xl sm:border sm:border-zinc-200 sm:bg-white/80 sm:p-5 sm:shadow-sm sm:dark:border-zinc-800 sm:dark:bg-zinc-950/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            선택한 글 · {selectedSlug}
          </p>
          <h2 className="mt-1 break-all text-2xl font-semibold">
            {article?.title ?? selectedSlug}
          </h2>
          {article && article.status === "PUBLISHED" ? (
            <a
              href={`/blog/${selectedSlug}`}
              className="mt-2 inline-block text-sm underline underline-offset-4"
            >
              공개 글 보기
            </a>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <StatusPill
            label="형식"
            value={
              article?.sourceFormat === "DOCUMENT"
                ? "CMS 문서"
                : article?.sourceFormat === "BLOCKS"
                  ? "기존 CMS 블록"
                  : "이전 형식"
            }
          />
          <StatusPill
            label="상태"
            value={
              article?.status === "PUBLISHED"
                ? "공개"
                : article?.status === "ARCHIVED"
                  ? "보관"
                  : "비공개"
            }
          />
          {article?.hasUnpublishedChanges ? (
            <StatusPill label="수정본" value="저장됨 · 비공개" />
          ) : null}
        </div>
      </div>
      {message ? (
        <p className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {message}
        </p>
      ) : null}
    </div>
  );
}
function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-zinc-600 dark:text-zinc-300 sm:rounded-full sm:border sm:border-zinc-200 sm:bg-zinc-50 sm:px-3 sm:py-1 sm:dark:border-zinc-800 sm:dark:bg-zinc-900">
      {label}:{" "}
      <strong className="text-zinc-950 dark:text-zinc-50">{value}</strong>
    </span>
  );
}
