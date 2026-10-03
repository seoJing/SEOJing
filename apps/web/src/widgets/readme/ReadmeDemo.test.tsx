import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { USER_CASE_ID, syntheticPreview } from "@/shared/readme/preview";
import { ReadmeDemo } from "./ReadmeDemo";

vi.mock("@/shared/readme/analytics", () => ({ trackReadmeInterest: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

function chooseUserFile() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  render(<ReadmeDemo />);
  fireEvent.click(
    screen.getByRole("button", { name: "내 공고·이력서로 시작" }),
  );
  fireEvent.change(screen.getByRole("textbox", { name: "공고 본문" }), {
    target: {
      value:
        "지역 청년 프로그램 운영과 참여자 소통, 결과 자료 정리 담당자를 모집합니다.",
    },
  });
  fireEvent.click(screen.getByRole("button", { name: /이력서 파일 선택/ }));
  fireEvent.change(screen.getByLabelText("이력서 파일"), {
    target: {
      files: [
        new File(["저는 프로그램을 운영했습니다."], "resume.txt", {
          type: "text/plain",
        }),
      ],
    },
  });
}

describe("README personal document journey", () => {
  it("keeps the contest screen synthetic-only", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(<ReadmeDemo contestOnly />);
    expect(screen.getByText("README · 공모전용 화면")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "내 공고·이력서로 시작" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("이력서 파일")).not.toBeInTheDocument();
  });

  it("shows an error instead of a synthetic report when upload analysis fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "unreadable_pdf" }), {
            status: 400,
          }),
      ),
    );
    chooseUserFile();
    fireEvent.click(screen.getByRole("button", { name: /내 문서 분석 시작/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "스캔 이미지 PDF",
    );
    expect(
      screen.getByRole("heading", { name: "이력서 파일을 선택합니다" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "점수보다, 고칠 위치를 남깁니다" }),
    ).not.toBeInTheDocument();
  });

  it("renders the user's backend response and sends only the declared input fields", async () => {
    const userPreview = {
      ...syntheticPreview,
      case_id: USER_CASE_ID,
      resume: {
        units: [{ id: "R1", index: 1, text: "사용자 문서의 첫 문장입니다." }],
      },
      events: [
        {
          seq: 1,
          unit_id: "R1",
          type: "note",
          message: "첫 문장을 읽었습니다.",
        },
      ],
    };
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(userPreview), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    chooseUserFile();
    fireEvent.click(screen.getByRole("button", { name: /내 문서 분석 시작/ }));

    expect(
      await screen.findByRole("heading", {
        name: "읽는 순간의 질문을 따라갑니다",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음 이벤트" }));
    expect(
      screen.getByText("사용자 문서의 첫 문장입니다."),
    ).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/readme/api/analyze");
    const sent = JSON.parse(String(options.body)) as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual([
      "job_text",
      "resume_base64",
      "resume_filename",
      "resume_media_type",
    ]);
    expect(sent.resume_filename).toBe("resume.txt");
    expect(sent.resume_media_type).toBe("text/plain");
  });

  it("moves through all four synthetic stages, focusing each new heading and citing the report", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(syntheticPreview), {
            status: 200,
            headers: { "x-readme-source": "backend" },
          }),
      ),
    );
    render(<ReadmeDemo />);
    fireEvent.click(screen.getByRole("button", { name: /가상 이력서 확인/ }));
    expect(
      screen.getByRole("heading", { name: "이력서를 문장 단위로 고정합니다" }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: /순차 독해 시작/ }));
    expect(
      await screen.findByRole("heading", {
        name: "읽는 순간의 질문을 따라갑니다",
      }),
    ).toHaveFocus();
    expect(
      screen.getByText("규칙 기반 · 가상 사례 / 맥미니 백엔드 응답"),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    for (const event of syntheticPreview.events) {
      fireEvent.click(screen.getByRole("button", { name: "다음 이벤트" }));
      expect(screen.getByText(event.message)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: /최종 리포트 보기/ }));
    expect(
      screen.getByRole("heading", { name: "점수보다, 고칠 위치를 남깁니다" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("heading", { name: "잘 전달된 설명" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/이력서 원문 근거/).length).toBeGreaterThan(0);
  });

  it("allows retry after a transient error, uses cautious upload labels, and invalidates edited results", async () => {
    const userPreview = {
      ...syntheticPreview,
      case_id: USER_CASE_ID,
      resume: {
        units: [
          { id: "R1", index: 1, text: "사용자 운영 경험 첫 문장입니다." },
          { id: "R2", index: 2, text: "일정을 조율했습니다." },
        ],
      },
      events: [
        {
          seq: 1,
          unit_id: "R1",
          type: "evidence",
          message: "표현이 겹칩니다.",
          evidence_unit_ids: ["R1"],
        },
        {
          seq: 2,
          unit_id: "R2",
          type: "resolve",
          message: "행동 표현이 보입니다.",
          evidence_unit_ids: ["R1", "R2"],
        },
      ],
      report: {
        strengths: [{ text: "겹치는 표현 후보입니다.", unit_ids: ["R1"] }],
        open_questions: [
          { text: "실제 역할은 확인이 필요합니다.", unit_ids: ["R2"] },
        ],
        next_steps: [{ text: "역할을 명시하세요.", unit_ids: ["R2"] }],
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "analysis_busy" }), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(userPreview), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    chooseUserFile();
    fireEvent.click(screen.getByRole("button", { name: /내 문서 분석 시작/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "잠시 후 다시 시도해 주세요",
    );
    expect(
      screen.getByRole("button", { name: /내 문서 분석 시작/ }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /내 문서 분석 시작/ }));
    expect(
      await screen.findByRole("heading", {
        name: "읽는 순간의 질문을 따라갑니다",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "다음 이벤트" }));
    expect(screen.getByText("공고 표현 겹침 후보")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다음 이벤트" }));
    expect(screen.getByText("뒤 문장 행동 표현 후보")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /최종 리포트 보기/ }));
    expect(
      screen.getByRole("heading", { name: "공고와 겹치는 후보 문장" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "잘 전달된 설명" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /공고 입력/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "공고 본문" }), {
      target: {
        value:
          "새 공고 문장이 충분히 길게 입력되었습니다. 다시 분석해야 합니다.",
      },
    });
    expect(screen.getByRole("button", { name: /최종 리포트/ })).toBeDisabled();
  });

  it("explains an analysis timeout and retries with the selected file, without a fallback report", async () => {
    const userPreview = { ...syntheticPreview, case_id: USER_CASE_ID };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "analysis_timeout" }), {
          status: 502,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(userPreview), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    chooseUserFile();
    const analyzeButton = screen.getByRole("button", {
      name: /내 문서 분석 시작/,
    });
    fireEvent.click(analyzeButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "문서 분석 시간이 초과되었습니다",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "TXT 또는 더 단순한 파일로 다시 시도해 주세요",
    );
    expect(screen.getByText(/선택 파일: resume\.txt/)).toBeInTheDocument();
    expect(
      (screen.getByLabelText("이력서 파일") as HTMLInputElement).files?.[0]
        ?.name,
    ).toBe("resume.txt");
    expect(analyzeButton).toBeEnabled();
    expect(
      screen.queryByRole("heading", { name: "읽는 순간의 질문을 따라갑니다" }),
    ).not.toBeInTheDocument();

    fireEvent.click(analyzeButton);
    expect(
      await screen.findByRole("heading", {
        name: "읽는 순간의 질문을 따라갑니다",
      }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(
      JSON.parse(fetchMock.mock.calls[0][1].body),
    );
  });

  it("disables upload only for a client-side file validation error", () => {
    vi.stubGlobal("fetch", vi.fn());
    chooseUserFile();
    fireEvent.change(screen.getByLabelText("이력서 파일"), {
      target: {
        files: [
          new File(["invalid"], "resume.exe", {
            type: "application/octet-stream",
          }),
        ],
      },
    });
    expect(
      screen.getByRole("button", { name: /내 문서 분석 시작/ }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("PDF·DOCX·TXT·MD");
    fireEvent.change(screen.getByLabelText("이력서 파일"), {
      target: {
        files: [
          new File(["valid text"], "resume-new.txt", { type: "text/plain" }),
        ],
      },
    });
    expect(
      screen.getByRole("button", { name: /내 문서 분석 시작/ }),
    ).toBeEnabled();
  });

  it("labels the local synthetic fallback when its backend is unavailable", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    render(<ReadmeDemo contestOnly />);
    fireEvent.click(screen.getByRole("button", { name: /가상 이력서 확인/ }));
    fireEvent.click(screen.getByRole("button", { name: /순차 독해 시작/ }));
    expect(
      await screen.findByText("규칙 기반 · 로컬 합성 예시 / 백엔드 미사용"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("이력서 파일")).not.toBeInTheDocument();
  });
});
