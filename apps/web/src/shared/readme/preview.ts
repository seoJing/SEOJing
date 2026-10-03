export const README_CASE_ID = "social-program-operator" as const;
export const USER_CASE_ID = "user-upload" as const;
export const MAX_RESUME_BYTES = 2_000_000;
export const RESUME_FILE_TYPES = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
} as const;

export function resumeMediaType(filename: string): string | null {
  const extension = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return extension && extension in RESUME_FILE_TYPES
    ? RESUME_FILE_TYPES[extension as keyof typeof RESUME_FILE_TYPES]
    : null;
}

export interface PreviewCriterion {
  id: string;
  label: string;
  source_quote: string;
}

export interface PreviewUnit {
  id: string;
  index: number;
  text: string;
}

export interface PreviewEvent {
  seq: number;
  unit_id: string;
  type: "question" | "evidence" | "resolve" | "note";
  message: string;
  criterion_id?: string;
  question_id?: string;
  evidence_unit_ids?: string[];
}

export interface PreviewFinding {
  text: string;
  unit_ids: string[];
}

export interface ReadmePreview {
  mode: "rules_preview";
  case_id: typeof README_CASE_ID | typeof USER_CASE_ID;
  job: { title: string; text: string; criteria: PreviewCriterion[] };
  resume: { units: PreviewUnit[] };
  events: PreviewEvent[];
  report: {
    strengths: PreviewFinding[];
    open_questions: PreviewFinding[];
    next_steps: PreviewFinding[];
  };
  limitations: string[];
}

// Fictional, fixed and public. Snapshot of the backend synthetic case.
export const syntheticPreview: ReadmePreview = {
  mode: "rules_preview",
  case_id: "social-program-operator",
  job: {
    title: "지역 프로그램 운영 지원 담당자 (합성 공고)",
    text: "참여자 일정 조정과 안내문 작성 경험, 운영 기록과 검수 문서 작성 경험을 우대합니다.",
    criteria: [
      {
        id: "c_schedule",
        label: "참여자 일정 조정·안내",
        source_quote: "참여자 일정 조정과 안내문 작성 경험",
      },
      {
        id: "c_record",
        label: "운영 기록·검수 문서",
        source_quote: "운영 기록과 검수 문서 작성 경험",
      },
    ],
  },
  resume: {
    units: [
      {
        id: "u1",
        index: 0,
        text: "지역 프로그램 운영을 지원했습니다.",
      },
      {
        id: "u2",
        index: 1,
        text: "참여자 일정 조정과 안내문 작성을 직접 담당했습니다.",
      },
      {
        id: "u3",
        index: 2,
        text: "진행표와 안내문 검수 체크리스트를 작성했습니다.",
      },
      {
        id: "u4",
        index: 3,
        text: "참여자 만족도를 개선했습니다.",
      },
    ],
  },
  events: [
    {
      seq: 1,
      unit_id: "u1",
      type: "question",
      question_id: "q_role",
      criterion_id: "c_schedule",
      message: "직접 맡은 운영 업무의 범위는 무엇일까요?",
      evidence_unit_ids: ["u1"],
    },
    {
      seq: 2,
      unit_id: "u2",
      type: "resolve",
      question_id: "q_role",
      criterion_id: "c_schedule",
      message: "일정 조정과 안내문 작성으로 앞선 역할 질문이 구체화됩니다.",
      evidence_unit_ids: ["u1", "u2"],
    },
    {
      seq: 3,
      unit_id: "u3",
      type: "evidence",
      criterion_id: "c_record",
      message: "운영 기록과 검수 문서의 구체적 산출물이 보입니다.",
      evidence_unit_ids: ["u3"],
    },
    {
      seq: 4,
      unit_id: "u4",
      type: "question",
      question_id: "q_basis",
      message: "만족도 개선을 확인할 비교 기준이나 자료가 있나요?",
      evidence_unit_ids: ["u4"],
    },
  ],
  report: {
    strengths: [
      {
        text: "일정 조정과 안내문 작성의 직접 담당 범위가 뒤 문장에서 설명됩니다.",
        unit_ids: ["u1", "u2"],
      },
      {
        text: "진행표와 검수 체크리스트라는 산출물이 명시됩니다.",
        unit_ids: ["u3"],
      },
    ],
    open_questions: [
      {
        text: "만족도 개선의 비교 기준·측정 범위는 이 문서에서 확인되지 않습니다.",
        unit_ids: ["u4"],
      },
    ],
    next_steps: [
      {
        text: "실제 측정 근거가 있다면 방법과 기간을, 없다면 단정적 표현을 조정해 보세요.",
        unit_ids: ["u4"],
      },
    ],
  },
  limitations: [
    "합성 사례에 대한 규칙 기반 시연입니다. Laya 모델은 연결되지 않았습니다.",
    "실제 채용담당자의 판단, 합격 가능성, 고용24 경력 인증을 의미하지 않습니다.",
  ],
};

export function isReadmePreview(
  value: unknown,
  expectedCaseId?: ReadmePreview["case_id"],
): value is ReadmePreview {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ReadmePreview>;
  return (
    candidate.mode === "rules_preview" &&
    (candidate.case_id === README_CASE_ID ||
      candidate.case_id === USER_CASE_ID) &&
    (!expectedCaseId || candidate.case_id === expectedCaseId) &&
    !!candidate.job &&
    typeof candidate.job.title === "string" &&
    Array.isArray(candidate.job.criteria) &&
    Array.isArray(candidate.resume?.units) &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.report?.strengths) &&
    Array.isArray(candidate.report?.open_questions) &&
    Array.isArray(candidate.report?.next_steps) &&
    Array.isArray(candidate.limitations)
  );
}
