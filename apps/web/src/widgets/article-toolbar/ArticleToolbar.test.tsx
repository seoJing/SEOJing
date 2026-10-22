import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleToolbar } from "./ArticleToolbar";

const { back } = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));
vi.mock("@/widgets/presentation", () => ({
  PresentationView: () => <div>Presentation retained</div>,
}));

describe("article toolbar after comment retirement", () => {
  it("retains back/presentation controls and has no comment control or event listener", () => {
    render(<ArticleToolbar slug="study/backend/day1" title="Study" />);
    expect(screen.queryByRole("button", { name: "댓글" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    window.dispatchEvent(
      new CustomEvent("seojing:open-comments", {
        detail: { source: "post_qa" },
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "뒤로가기" }));
    expect(back).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "프레젠테이션" }));
    expect(screen.getByText("Presentation retained")).toBeInTheDocument();
  });
});
