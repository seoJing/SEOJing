import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommentModal } from "./CommentModal";
import { GISCUS_CONFIG } from "@/shared/config/giscus";
const { widget } = vi.hoisted(() => ({ widget: vi.fn() }));
vi.mock("@giscus/react", () => ({
  default: (props: Record<string, string>) => {
    widget(props);
    return <iframe title="Comments" data-term={props.term} />;
  },
}));
vi.mock("@app/ui", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}));
it("preserves the pre-PR61 repository/category identity", () => {
  expect(GISCUS_CONFIG).toEqual({
    repo: "seoJing/SEOJing",
    repoId: "R_kgDORmQykw",
    category: "Announcements",
    categoryId: "DIC_kwDORmQyk84C4cEF",
  });
});
describe("Giscus restoration", () => {
  it("mounts only on explicit opening, maps canonical slugs and keeps one lazy Korean widget", async () => {
    const view = render(
      <CommentModal open={false} onClose={() => {}} slug="study/react/day1" />,
    );
    expect(widget).not.toHaveBeenCalled();
    view.rerender(
      <CommentModal open onClose={() => {}} slug="study/react/day1" />,
    );
    await screen.findByTitle("Comments");
    expect(widget).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...GISCUS_CONFIG,
        mapping: "specific",
        term: "study/react/day1",
        strict: "0",
        lang: "ko",
        theme: "dark",
        loading: "lazy",
        emitMetadata: "0",
      }),
    );
    view.rerender(
      <CommentModal open onClose={() => {}} slug="study/react/day2" />,
    );
    await waitFor(() =>
      expect(screen.getByTitle("Comments")).toHaveAttribute(
        "data-term",
        "study/react/day2",
      ),
    );
    expect(screen.getAllByTitle("Comments")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    view.rerender(
      <CommentModal open={false} onClose={() => {}} slug="study/react/day2" />,
    );
    expect(screen.queryByTitle("Comments")).toBeNull();
  });
});
