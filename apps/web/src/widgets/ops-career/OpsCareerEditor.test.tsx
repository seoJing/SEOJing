import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpsCareerEditor } from "./OpsCareerEditor";

const initialDocument = {
  aggregate: {
    opportunity: { slug: "daangn-frontend-intern" },
    preparationNotes: ["편집 중인 내용"],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderEditor(document: unknown = initialDocument) {
  render(
    <OpsCareerEditor
      selectedSlug="daangn-frontend-intern"
      initialDocument={document}
    />,
  );

  return screen.getByRole("textbox", {
    name: "Career admin document JSON",
  });
}

describe("OpsCareerEditor", () => {
  it.each([
    ["초안 저장", "초안을 저장했습니다. 공개 전 snapshot 갱신이 필요합니다."],
    ["새 초안 생성", "초안을 만들었습니다. 검토 후 별도로 공개하세요."],
  ])(
    "preserves the editor payload when %s receives an acknowledgment",
    async (button, status) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const editor = renderEditor();
      const originalPayload = JSON.stringify(initialDocument, null, 2);
      expect(editor).toHaveValue(originalPayload);

      fireEvent.click(screen.getByRole("button", { name: button }));

      expect(await screen.findByText(status)).toBeInTheDocument();
      expect(editor).toHaveValue(originalPayload);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("loads the backend document into the editor", async () => {
    const backendDocument = {
      aggregate: {
        opportunity: { slug: "daangn-frontend-intern" },
        preparationNotes: ["백엔드 원본"],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(backendDocument), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const editor = renderEditor();

    fireEvent.click(
      screen.getByRole("button", { name: "백엔드 원본 불러오기" }),
    );

    expect(
      await screen.findByText("백엔드 원본을 불러왔습니다."),
    ).toBeInTheDocument();
    expect(editor).toHaveValue(JSON.stringify(backendDocument, null, 2));
  });

  it("adopts a full document returned after save", async () => {
    const savedDocument = {
      aggregate: {
        opportunity: { slug: "daangn-frontend-intern" },
        preparationNotes: ["저장된 원본"],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(savedDocument), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const editor = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));

    expect(
      await screen.findByText(
        "초안을 저장했습니다. 공개 전 snapshot 갱신이 필요합니다.",
      ),
    ).toBeInTheDocument();
    expect(editor).toHaveValue(JSON.stringify(savedDocument, null, 2));
  });

  it("surfaces backend failures without replacing the editor payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const editor = renderEditor();
    const originalPayload = JSON.stringify(initialDocument, null, 2);

    fireEvent.click(screen.getByRole("button", { name: "초안 저장" }));

    expect(await screen.findByText("저장 실패 (503)")).toBeInTheDocument();
    expect(editor).toHaveValue(originalPayload);
  });

  it("adopts a full document returned after create", async () => {
    const createdDocument = {
      aggregate: {
        opportunity: { slug: "daangn-frontend-intern" },
        preparationNotes: ["생성된 원본"],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(createdDocument), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const editor = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "새 초안 생성" }));

    expect(
      await screen.findByText(
        "초안을 만들었습니다. 검토 후 별도로 공개하세요.",
      ),
    ).toBeInTheDocument();
    expect(editor).toHaveValue(JSON.stringify(createdDocument, null, 2));
  });

  it.each([
    ["백엔드 원본 불러오기", "조회 실패 (503)"],
    ["새 초안 생성", "생성 실패 (503)"],
    ["공개", "공개 실패 (503)"],
  ])("reports a backend failure from %s", async (button, status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: button }));

    expect(await screen.findByText(status)).toBeInTheDocument();
  });

  it("publishes without modifying the editor payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const editor = renderEditor();
    const originalPayload = JSON.stringify(initialDocument, null, 2);

    fireEvent.click(screen.getByRole("button", { name: "공개" }));

    expect(
      await screen.findByText(
        "백엔드에 공개했습니다. career:snapshot 실행과 프론트 배포 뒤 공개 페이지가 갱신됩니다.",
      ),
    ).toBeInTheDocument();
    expect(editor).toHaveValue(originalPayload);
  });
});
