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

      render(
        <OpsCareerEditor
          selectedSlug="daangn-frontend-intern"
          initialDocument={initialDocument}
        />,
      );

      const editor = screen.getByRole("textbox", {
        name: "Career admin document JSON",
      });
      const originalPayload = JSON.stringify(initialDocument, null, 2);
      expect(editor).toHaveValue(originalPayload);

      fireEvent.click(screen.getByRole("button", { name: button }));

      expect(await screen.findByText(status)).toBeInTheDocument();
      expect(editor).toHaveValue(originalPayload);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
});
