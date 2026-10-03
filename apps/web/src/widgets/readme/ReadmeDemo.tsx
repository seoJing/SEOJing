"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { trackReadmeInterest } from "@/shared/readme/analytics";
import {
  MAX_RESUME_BYTES,
  README_CASE_ID,
  USER_CASE_ID,
  isReadmePreview,
  resumeMediaType,
  syntheticPreview,
  type PreviewFinding,
  type ReadmePreview,
} from "@/shared/readme/preview";

const steps = [
  { key: "job", eyebrow: "01 / TARGET", title: "공고 입력" },
  { key: "resume", eyebrow: "02 / DOCUMENT", title: "이력서 입력" },
  { key: "reading", eyebrow: "03 / READING", title: "순차 독해" },
  { key: "report", eyebrow: "04 / REPORT", title: "최종 리포트" },
] as const;

type Step = (typeof steps)[number]["key"];
type DataSource = "fixture" | "backend";
type DemoMode = "example" | "user";

function fileValidationMessage(file: File | null): string | null {
  if (!file) return null;
  if (
    file.name.length < 1 ||
    file.name.length > 120 ||
    /[/\\]/.test(file.name)
  ) {
    return "파일 이름은 1~120자로 확인해 주세요.";
  }
  if (
    !resumeMediaType(file.name) ||
    file.size === 0 ||
    file.size > MAX_RESUME_BYTES
  ) {
    return "2 MB 이하의 PDF·DOCX·TXT·MD 파일을 선택해 주세요.";
  }
  return null;
}

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.onload = () => {
      const data = reader.result;
      if (typeof data !== "string" || !data.includes(",")) {
        reject(new Error("file_read_failed"));
        return;
      }
      resolve(data.slice(data.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

function uploadErrorMessage(error: string): string {
  switch (error) {
    case "too_large":
    case "invalid_file":
    case "docx_too_large":
      return "파일이 너무 큽니다. 2 MB 이하로 줄여 주세요.";
    case "unsupported_file":
    case "invalid_media_type":
      return "PDF·DOCX·TXT·MD 파일만 읽을 수 있습니다.";
    case "invalid_pdf":
    case "invalid_docx":
      return "파일 형식이 올바르지 않습니다. PDF 또는 DOCX 문서를 다시 저장해 주세요.";
    case "docx_too_complex":
      return "DOCX 구조가 너무 복잡합니다. TXT 또는 단순한 DOCX로 다시 시도해 주세요.";
    case "unreadable_pdf":
    case "pdf_text_missing":
      return "PDF에서 분석할 만큼 충분한 텍스트를 찾지 못했습니다. 스캔 이미지 PDF라면 OCR된 PDF나 TXT 파일로 다시 시도해 주세요.";
    case "unreadable_document":
      return "문서에서 읽을 수 있는 텍스트를 찾지 못했습니다. 텍스트가 포함된 파일로 다시 시도해 주세요.";
    case "unreadable_docx":
      return "DOCX에서 읽을 수 있는 문장을 찾지 못했습니다. 텍스트를 확인한 뒤 다시 시도해 주세요.";
    case "text_too_short":
      return "분석할 문장이 너무 짧습니다. 내용을 확인한 뒤 다시 시도해 주세요.";
    case "text_too_long":
      return "추출된 문서 텍스트가 너무 깁니다. 핵심 경력만 담아 다시 시도해 주세요.";
    case "invalid_filename":
      return "파일 이름을 확인하고 다시 선택해 주세요.";
    case "invalid_text_encoding":
      return "TXT·MD 파일은 UTF-8 인코딩으로 저장해 주세요.";
    case "too_many_units":
      return "이력서 문장이 너무 많습니다. 핵심 경력만 남겨 다시 시도해 주세요.";
    case "busy":
    case "rate_limited":
    case "analysis_busy":
      return "분석 요청이 많습니다. 잠시 후 다시 시도해 주세요.";
    case "analysis_timeout":
      return "문서 분석 시간이 초과되었습니다. 잠시 후 TXT 또는 더 단순한 파일로 다시 시도해 주세요.";
    case "analysis_resource_limit":
      return "문서 분석 자원 한도를 초과했습니다. TXT 또는 더 단순한 파일로 다시 시도해 주세요.";
    default:
      return "분석 결과를 만들지 못했습니다. 파일과 연결 상태를 확인하고 다시 시도해 주세요.";
  }
}

const stepIndex = (value: Step) =>
  steps.findIndex((step) => step.key === value);

function SectionHeading({
  index,
  title,
  description,
  headingRef,
}: {
  index: string;
  title: string;
  description: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="mb-8">
      <p className="text-xs font-bold tracking-[0.24em] text-teal-700 uppercase dark:text-teal-300">
        {index}
      </p>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 font-heading text-3xl font-bold tracking-tight text-slate-950 focus-visible:outline-2 focus-visible:outline-teal-500 sm:text-4xl dark:text-white"
      >
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base dark:text-slate-300">
        {description}
      </p>
    </div>
  );
}

function Citation({
  finding,
  preview,
}: {
  finding: PreviewFinding;
  preview: ReadmePreview;
}) {
  if (finding.unit_ids.length === 0) return null;
  const units = finding.unit_ids
    .map((id) => preview.resume.units.find((unit) => unit.id === id))
    .filter((unit) => unit !== undefined);
  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60">
      <summary className="cursor-pointer text-xs font-semibold text-teal-800 marker:text-teal-600 dark:text-teal-300">
        {preview.case_id === USER_CASE_ID
          ? "참조한 이력서 문장"
          : "이력서 원문 근거"}{" "}
        · {finding.unit_ids.join(" + ")}
      </summary>
      <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        {units.map((unit) => (
          <p
            key={unit.id}
            className="text-sm leading-6 text-slate-600 dark:text-slate-300"
          >
            <span className="mr-2 font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
              {unit.id}
            </span>
            {unit.text}
          </p>
        ))}
      </div>
    </details>
  );
}

function FindingGroup({
  label,
  heading,
  findings,
  preview,
  tone,
}: {
  label: string;
  heading: string;
  findings: PreviewFinding[];
  preview: ReadmePreview;
  tone: "green" | "amber" | "blue";
}) {
  const stripe = {
    green: "border-l-emerald-500",
    amber: "border-l-amber-500",
    blue: "border-l-sky-500",
  }[tone];
  return (
    <section aria-label={heading} className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-heading text-xl font-bold text-slate-950 dark:text-white">
          {heading}
        </h3>
        <span className="font-mono text-xs text-slate-400">{label}</span>
      </div>
      {findings.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          이 항목에 연결된 문장 근거가 아직 없습니다.
        </p>
      )}
      {findings.map((finding, index) => (
        <article
          key={`${label}-${index}`}
          className={`rounded-2xl border border-slate-200 border-l-4 ${stripe} bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/70`}
        >
          <p className="text-sm leading-7 text-slate-800 dark:text-slate-100">
            {finding.text}
          </p>
          <Citation finding={finding} preview={preview} />
        </article>
      ))}
    </section>
  );
}

export function ReadmeDemo({ contestOnly = false }: { contestOnly?: boolean }) {
  const [mode, setMode] = useState<DemoMode>("example");
  const [step, setStep] = useState<Step>("job");
  const [preview, setPreview] = useState<ReadmePreview>(syntheticPreview);
  const [source, setSource] = useState<DataSource>("fixture");
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [jobText, setJobText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    trackReadmeInterest(undefined, "example", contestOnly ? "contest" : "blog");
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [contestOnly]);

  useEffect(() => {
    if (!playing || step !== "reading") return;
    if (revealed >= preview.events.length) return;
    const timer = window.setTimeout(
      () => {
        setRevealed(revealed + 1);
        if (revealed + 1 >= preview.events.length) setPlaying(false);
      },
      reducedMotion ? 900 : 1650,
    );
    return () => window.clearTimeout(timer);
  }, [playing, preview.events.length, revealed, reducedMotion, step]);

  const goTo = useCallback(
    (next: Step) => {
      setStep(next);
      setPlaying(false);
      setError(null);
      trackReadmeInterest(next, mode, contestOnly ? "contest" : "blog");
    },
    [mode, contestOnly],
  );

  const invalidateAnalysis = useCallback(() => {
    setPreview(syntheticPreview);
    setSource("fixture");
    setRevealed(0);
    setPlaying(false);
  }, []);

  const changeMode = useCallback(
    (next: DemoMode) => {
      if (contestOnly && next === "user") return;
      setMode(next);
      setStep("job");
      setPreview(syntheticPreview);
      setSource("fixture");
      setJobText("");
      setResumeFile(null);
      setFileInputKey((current) => current + 1);
      setRevealed(0);
      setPlaying(false);
      setError(null);
      trackReadmeInterest("job", next, contestOnly ? "contest" : "blog");
    },
    [contestOnly],
  );

  const beginReading = useCallback(async () => {
    if (mode === "user") {
      if (jobText.trim().length < 20 || jobText.length > 6_000) {
        goTo("job");
        setError("공고 본문을 20~6,000자로 입력해 주세요.");
        return;
      }
      const fileProblem = fileValidationMessage(resumeFile);
      if (!resumeFile || fileProblem) {
        setError(fileProblem ?? "이력서 파일을 선택해 주세요.");
        return;
      }
    }
    setLoading(true);
    setError(null);
    setRevealed(0);
    setPlaying(false);
    let nextPreview = syntheticPreview;
    let nextSource: DataSource = "fixture";
    try {
      const endpoint =
        mode === "user" ? "/readme/api/analyze" : "/readme/api/preview";
      const payload =
        mode === "user" && resumeFile
          ? {
              job_text: jobText.trim(),
              resume_filename: resumeFile.name,
              resume_media_type: resumeMediaType(resumeFile.name),
              resume_base64: await fileAsBase64(resumeFile),
            }
          : { case_id: README_CASE_ID };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        const errorCode =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "analyze_unavailable";
        throw new Error(errorCode);
      }
      const data: unknown = await response.json();
      if (
        !isReadmePreview(data, mode === "user" ? USER_CASE_ID : README_CASE_ID)
      ) {
        throw new Error("invalid_backend_response");
      }
      nextPreview = data;
      nextSource =
        mode === "user" || response.headers.get("x-readme-source") === "backend"
          ? "backend"
          : "fixture";
    } catch (caught) {
      if (mode === "user") {
        setError(
          uploadErrorMessage(
            caught instanceof Error ? caught.message : "analyze_unavailable",
          ),
        );
        setLoading(false);
        return;
      }
      // The fictional example alone may safely fall back to its matching fixture.
    }
    setPreview(nextPreview);
    setSource(nextSource);
    setLoading(false);
    goTo("reading");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(true);
    }
  }, [goTo, jobText, mode, resumeFile]);

  const lastEvent = preview.events[revealed - 1];
  const visibleUnitCount = useMemo(() => {
    if (!lastEvent) return 0;
    return Math.max(
      0,
      preview.resume.units.findIndex((unit) => unit.id === lastEvent.unit_id) +
        1,
    );
  }, [lastEvent, preview.resume.units]);

  return (
    <div className="pb-12">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#102a3a] px-6 py-9 text-white shadow-[0_24px_70px_-30px_rgba(16,42,58,0.7)] sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-44 left-1/3 size-80 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-[0.18em] uppercase">
            <span className="rounded-full border border-teal-200/40 bg-teal-200/10 px-3 py-1.5 text-teal-100">
              {contestOnly ? "README · 공모전용 화면" : "README · 공개 시연"}
            </span>
            <span className="rounded-full border border-white/20 px-3 py-1.5 text-slate-200">
              {mode === "example" ? "합성 사례 1건" : "내 문서로 직접 확인"}
            </span>
          </div>
          <h1 className="mt-7 max-w-3xl font-heading text-4xl font-extrabold leading-[1.2] tracking-tight sm:text-6xl">
            이력서는 읽히는 순서에 따라
            <br />
            <span className="text-teal-200">다르게 이해됩니다.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
            공고의 문장과 이력서의 문장을 나란히 놓고, 앞에서 생긴 질문이 뒤에서
            어떻게 풀리는지 확인하세요. 점수 대신 원문 근거와 남은 질문을
            남깁니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-xs font-medium text-slate-100">
            <span className="rounded-lg bg-white/10 px-3 py-2">
              규칙 기반 시연 · 순차 재생
            </span>
            <span className="rounded-lg bg-white/10 px-3 py-2">
              Laya 미연결
            </span>
            <span className="rounded-lg bg-white/10 px-3 py-2">
              고용24 데이터 미연결
            </span>
          </div>
          {!contestOnly && (
            <div className="mt-8">
              <div
                role="group"
                className="flex flex-wrap gap-2"
                aria-label="분석 방식 선택"
              >
                <button
                  type="button"
                  disabled={loading}
                  aria-pressed={mode === "example"}
                  onClick={() => changeMode("example")}
                  className={`rounded-xl px-5 py-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200 ${mode === "example" ? "bg-teal-200 text-slate-950" : "border border-white/40 text-white hover:bg-white/10"}`}
                >
                  가상 사례 체험
                </button>
                <button
                  type="button"
                  disabled={loading}
                  aria-pressed={mode === "user"}
                  onClick={() => changeMode("user")}
                  className={`rounded-xl px-5 py-3 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-200 ${mode === "user" ? "bg-teal-200 text-slate-950" : "border border-white/40 text-white hover:bg-white/10"}`}
                >
                  내 공고·이력서로 시작
                </button>
              </div>
              <a
                href="/readme/contest"
                className="mt-4 inline-block text-xs font-semibold text-teal-100 underline underline-offset-4 hover:text-white"
              >
                공모전 제출용 합성 화면 보기 →
              </a>
            </div>
          )}
          {contestOnly && (
            <p className="mt-8 max-w-2xl rounded-xl border border-teal-200/40 bg-white/10 px-4 py-3 text-xs leading-6 text-teal-50">
              이 경로는 공모전 제출 화면용 합성 사례만 표시합니다. 실제 이력서
              입력·업로드는 제공하지 않습니다.
            </p>
          )}
        </div>
      </section>

      <nav
        aria-label="시연 단계"
        className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {steps.map((item, index) => {
          const active = item.key === step;
          const accessible =
            index <= stepIndex(step) ||
            item.key === "job" ||
            (item.key === "resume" &&
              (mode === "example" || jobText.trim().length >= 20)) ||
            (item.key === "reading" && revealed > 0) ||
            (item.key === "report" && revealed >= preview.events.length);
          return (
            <button
              key={item.key}
              type="button"
              disabled={!accessible || loading}
              aria-current={active ? "step" : undefined}
              onClick={() => goTo(item.key)}
              className={`rounded-2xl border px-4 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-teal-400 bg-teal-50 text-teal-950 shadow-sm dark:bg-teal-950/60 dark:text-teal-100" : "border-slate-200 bg-white text-slate-600 hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"}`}
            >
              <span className="block font-mono text-[10px] tracking-wider opacity-70">
                {item.eyebrow}
              </span>
              <span className="mt-2 block text-sm font-bold sm:text-base">
                {item.title}
              </span>
            </button>
          );
        })}
      </nav>

      <section className="mt-7 min-h-[36rem] rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-9 dark:border-slate-800 dark:bg-slate-950">
        {step === "job" && (
          <>
            <SectionHeading
              headingRef={stepHeadingRef}
              index="STEP 01 · JOB POSTING"
              title="먼저 공고의 언어를 확인합니다"
              description={
                mode === "example"
                  ? "공개용 가상 공고를 선택한 상태입니다. 분석은 이 공고에 실제 적힌 요건만 사용합니다."
                  : "지원할 공고의 직무와 요건 본문을 붙여 넣으세요. 입력한 내용은 분석을 위해 맥미니 서버로 전송됩니다."
              }
            />
            {mode === "example" ? (
              <>
                <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                  <article className="rounded-2xl border border-slate-200 bg-[#f7faf8] p-6 dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold tracking-wider text-teal-800 uppercase dark:text-teal-300">
                        Synthetic posting
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        가상 사례
                      </span>
                    </div>
                    <h3 className="mt-5 font-heading text-2xl font-bold text-slate-900 dark:text-white">
                      {preview.job.title}
                    </h3>
                    <p className="mt-5 whitespace-pre-line text-sm leading-8 text-slate-700 dark:text-slate-200">
                      {preview.job.text}
                    </p>
                  </article>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      공고에 명시된 판단 기준
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      숨은 선호나 합격 기준은 만들지 않습니다.
                    </p>
                    <ul className="mt-4 space-y-3">
                      {preview.job.criteria.map((criterion) => (
                        <li
                          key={criterion.id}
                          className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
                        >
                          <div className="flex items-start gap-3">
                            <span className="rounded-md bg-teal-100 px-2 py-1 font-mono text-xs font-bold text-teal-900 dark:bg-teal-900 dark:text-teal-100">
                              {criterion.id}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {criterion.label}
                              </p>
                              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                “{criterion.source_quote}”
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <ActionButton onClick={() => goTo("resume")}>
                    가상 이력서 확인 <span aria-hidden="true">→</span>
                  </ActionButton>
                </div>
              </>
            ) : (
              <div className="max-w-3xl">
                <label
                  htmlFor="readme-job-text"
                  className="text-sm font-bold text-slate-900 dark:text-white"
                >
                  공고 본문
                </label>
                <textarea
                  id="readme-job-text"
                  value={jobText}
                  onChange={(event) => {
                    setJobText(event.target.value);
                    setError(null);
                    invalidateAnalysis();
                  }}
                  maxLength={6_000}
                  rows={10}
                  placeholder="직무, 주요 업무, 필수·우대 요건이 포함된 공고 본문을 붙여 넣어 주세요."
                  className="mt-3 w-full resize-y rounded-2xl border border-slate-300 bg-white p-5 text-sm leading-7 text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-2 focus:outline-teal-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:outline-teal-900"
                />
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>20~6,000자 · 공고 문장 일부를 비교합니다.</span>
                  <span>{jobText.length.toLocaleString()} / 6,000</span>
                </div>
                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                  >
                    {error}
                  </p>
                )}
                <div className="mt-7 flex justify-end">
                  <ActionButton
                    onClick={() => {
                      if (jobText.trim().length < 20) {
                        setError("공고 본문을 20자 이상 입력해 주세요.");
                        return;
                      }
                      goTo("resume");
                    }}
                  >
                    이력서 파일 선택 <span aria-hidden="true">→</span>
                  </ActionButton>
                </div>
              </div>
            )}
          </>
        )}

        {step === "resume" && (
          <>
            <SectionHeading
              headingRef={stepHeadingRef}
              index="STEP 02 · RESUME"
              title={
                mode === "example"
                  ? "이력서를 문장 단위로 고정합니다"
                  : "이력서 파일을 선택합니다"
              }
              description={
                mode === "example"
                  ? "가상의 지원자 사례입니다. 표시된 문장의 순서와 원문을 유지한 채 읽습니다."
                  : "PDF·DOCX·TXT·MD 파일을 최대 2 MB까지 사용할 수 있습니다. 문서 텍스트를 일시 처리하며, 서비스 DB에 저장하거나 모델 학습에 쓰지 않습니다."
              }
            />
            {mode === "example" ? (
              <>
                <div className="space-y-3">
                  {preview.resume.units.map((unit) => (
                    <div
                      key={unit.id}
                      className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <span className="pt-0.5 font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                        {unit.id}
                      </span>
                      <p className="text-sm leading-7 text-slate-800 sm:text-base dark:text-slate-100">
                        {unit.text}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                    분석 요청에는 사례 ID만 전송됩니다. 실제 이력서 본문은
                    전송하지 않습니다.
                  </p>
                  <ActionButton
                    onClick={() => void beginReading()}
                    disabled={loading}
                  >
                    {loading ? "시연 준비 중…" : "순차 독해 시작"}{" "}
                    <span aria-hidden="true">→</span>
                  </ActionButton>
                </div>
              </>
            ) : (
              <div className="max-w-3xl">
                <label
                  htmlFor="readme-resume-file"
                  className="block text-sm font-bold text-slate-900 dark:text-white"
                >
                  이력서 파일
                </label>
                <input
                  key={fileInputKey}
                  id="readme-resume-file"
                  type="file"
                  disabled={loading}
                  accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setResumeFile(file);
                    setError(fileValidationMessage(file));
                    invalidateAnalysis();
                  }}
                  className="mt-3 block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-100 file:px-4 file:py-2 file:font-semibold file:text-teal-900 hover:file:bg-teal-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:file:bg-teal-900 dark:file:text-teal-100"
                />
                <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
                  선택 파일:{" "}
                  {resumeFile
                    ? `${resumeFile.name} · ${(resumeFile.size / 1024).toFixed(0)} KB`
                    : "없음"}
                </p>
                <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-xs leading-6 text-slate-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-slate-200">
                  <p className="font-bold">업로드 전 확인</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    <li>
                      공고와 이력서가 맥미니 백엔드로 전송되어 메모리에서 일시
                      분석됩니다.
                    </li>
                    <li>
                      이 서비스의 DB 저장과 모델 학습에는 사용하지 않습니다.
                      분석 이벤트에는 문서·파일명·인용을 보내지 않습니다.
                    </li>
                    <li>
                      네트워크 중계 및 브라우저 환경의 보존 정책은 별개입니다.
                      제출용 공개 화면은 가상 사례를 사용합니다.
                    </li>
                  </ul>
                </div>
                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                  >
                    {error}
                  </p>
                )}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => goTo("job")}
                    className="text-sm font-semibold text-slate-600 underline underline-offset-4 disabled:opacity-50 dark:text-slate-300"
                  >
                    공고 수정
                  </button>
                  <ActionButton
                    onClick={() => void beginReading()}
                    disabled={
                      loading ||
                      !resumeFile ||
                      !!fileValidationMessage(resumeFile)
                    }
                  >
                    {loading ? "문서를 읽는 중…" : "내 문서 분석 시작"}{" "}
                    <span aria-hidden="true">→</span>
                  </ActionButton>
                </div>
              </div>
            )}
          </>
        )}

        {step === "reading" && (
          <>
            <SectionHeading
              headingRef={stepHeadingRef}
              index="STEP 03 · READING"
              title="읽는 순간의 질문을 따라갑니다"
              description={
                mode === "example"
                  ? "결과를 미리 계산한 규칙 기반 이벤트를 순서대로 재생합니다. 아직 보지 않은 문장은 화면에 공개하지 않습니다. 실제 모델 스트리밍이 아닙니다."
                  : "업로드한 문서의 규칙 기반 분석 결과를 순서대로 재생합니다. 이미 계산된 결과를 보여주는 것이며 실제 모델 스트리밍은 아닙니다."
              }
            />
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-medium text-teal-900 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200">
              <span>규칙 기반 시연 · 순차 재생 / Laya 미연결</span>
              <span>
                {mode === "user"
                  ? "규칙 기반 · 내 문서 / 맥미니 백엔드 응답"
                  : source === "backend"
                    ? "규칙 기반 · 가상 사례 / 맥미니 백엔드 응답"
                    : "규칙 기반 · 로컬 합성 예시 / 백엔드 미사용"}
              </span>
            </div>
            {mode === "user" && (
              <details className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                  비교에 사용한 공고 문장 {preview.job.criteria.length}개
                </summary>
                <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs leading-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  {preview.job.criteria.map((criterion) => (
                    <li key={criterion.id}>
                      <span className="mr-2 font-mono font-bold text-teal-700 dark:text-teal-300">
                        {criterion.id}
                      </span>
                      {criterion.source_quote}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>이력서 원문</span>
                  <span>
                    {visibleUnitCount} / {preview.resume.units.length} 문장
                  </span>
                </div>
                <div className="space-y-3">
                  {preview.resume.units
                    .slice(0, visibleUnitCount)
                    .map((unit) => (
                      <div
                        key={unit.id}
                        className={`rounded-xl border px-4 py-4 ${unit.id === lastEvent?.unit_id ? "border-teal-400 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/50" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"}`}
                      >
                        <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                          {unit.id}
                        </span>
                        <p className="mt-1 text-sm leading-7 text-slate-800 dark:text-slate-100">
                          {unit.text}
                        </p>
                      </div>
                    ))}
                  {visibleUnitCount === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                      재생을 누르면 {preview.resume.units[0]?.id ?? "첫 문장"}
                      부터 공개됩니다.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>독해 기록</span>
                  <span>
                    {revealed} / {preview.events.length} 이벤트
                  </span>
                </div>
                <ol className="space-y-3">
                  {preview.events.slice(0, revealed).map((event) => (
                    <li
                      key={event.seq}
                      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="font-mono text-teal-700 dark:text-teal-300">
                          {event.unit_id}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span
                          className={
                            event.type === "question"
                              ? "text-amber-700 dark:text-amber-300"
                              : event.type === "resolve"
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-sky-700 dark:text-sky-300"
                          }
                        >
                          {event.type === "question"
                            ? "질문"
                            : event.type === "resolve"
                              ? mode === "user"
                                ? "뒤 문장 행동 표현 후보"
                                : "나중에 설명됨"
                              : event.type === "evidence"
                                ? mode === "user"
                                  ? "공고 표현 겹침 후보"
                                  : "직접 근거"
                                : "관찰"}
                        </span>
                        {event.criterion_id && (
                          <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 font-mono text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            공고 {event.criterion_id}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-7 text-slate-700 dark:text-slate-200">
                        {event.message}
                      </p>
                      {event.evidence_unit_ids && (
                        <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {mode === "user" ? "참조 문장" : "근거"}{" "}
                          {event.evidence_unit_ids.join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                  {revealed === 0 && (
                    <li className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                      독해 이벤트를 기다리는 중입니다.
                    </li>
                  )}
                </ol>
                <p className="sr-only" aria-live="polite" aria-atomic="true">
                  {lastEvent
                    ? `${lastEvent.unit_id}: ${lastEvent.message}`
                    : "독해 재생 준비"}
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (revealed >= preview.events.length) setRevealed(0);
                  setPlaying(!playing);
                }}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-500 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                {playing
                  ? "일시정지"
                  : revealed >= preview.events.length
                    ? "다시 재생"
                    : "재생"}
              </button>
              <button
                type="button"
                disabled={revealed >= preview.events.length}
                onClick={() => {
                  setPlaying(false);
                  setRevealed((current) =>
                    Math.min(current + 1, preview.events.length),
                  );
                }}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                다음 이벤트
              </button>
              <div className="flex-1" />
              <ActionButton
                onClick={() => goTo("report")}
                disabled={revealed < preview.events.length}
              >
                최종 리포트 보기 <span aria-hidden="true">→</span>
              </ActionButton>
            </div>
          </>
        )}

        {step === "report" && (
          <>
            <SectionHeading
              headingRef={stepHeadingRef}
              index="STEP 04 · REPORT"
              title="점수보다, 고칠 위치를 남깁니다"
              description={
                mode === "user"
                  ? "규칙이 찾은 표현 겹침 후보와 남은 질문을 구분합니다. 해당 경험의 사실성이나 기여도를 확인한 결과는 아닙니다."
                  : "공고 문장과 이력서 원문을 근거로 잘 전달된 부분과 아직 답이 없는 질문을 구분합니다. 실제 지원자 평가나 합격 예측이 아닙니다."
              }
            />
            <div className="grid gap-8 lg:grid-cols-2">
              <FindingGroup
                label={mode === "user" ? "CANDIDATES" : "CONNECTED"}
                heading={
                  mode === "user" ? "공고와 겹치는 후보 문장" : "잘 전달된 설명"
                }
                findings={preview.report.strengths}
                preview={preview}
                tone="green"
              />
              <FindingGroup
                label="UNRESOLVED"
                heading="남은 질문"
                findings={preview.report.open_questions}
                preview={preview}
                tone="amber"
              />
            </div>
            <div className="mt-9">
              <FindingGroup
                label="NEXT EDIT"
                heading="보강하면 좋은 문장"
                findings={preview.report.next_steps}
                preview={preview}
                tone="blue"
              />
            </div>
            <aside className="mt-9 rounded-2xl bg-slate-100 p-5 dark:bg-slate-900">
              <h3 className="font-bold text-slate-900 dark:text-white">
                이 리포트의 한계
              </h3>
              <ul className="mt-3 list-inside list-disc space-y-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
                {preview.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </aside>
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  changeMode(mode);
                }}
                className="text-sm font-semibold text-teal-700 underline underline-offset-4 hover:text-teal-900 dark:text-teal-300"
              >
                처음부터 다시 보기
              </button>
            </div>
          </>
        )}
      </section>

      <p className="mt-5 text-center text-xs leading-6 text-slate-500 dark:text-slate-400">
        {contestOnly
          ? "공모전 제출용 합성 사례 · 실제 개인정보를 입력하거나 업로드할 수 없습니다."
          : "공개 프로토타입 · 공모전 제출 예시는 가상 자료만 사용합니다. 내 문서 분석은 규칙 기반입니다."}{" "}
        고용24의 공식 서비스 또는 인증 결과가 아닙니다.
      </p>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#0d665e] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0b514b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}
