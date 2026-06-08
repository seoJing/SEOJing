import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SectionQaPrompts } from "./SectionQaPrompts";

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
}

describe("SectionQaPrompts", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("renders a floating prompt near h2 section endings and opens section QA", async () => {
    document.body.innerHTML = `
      <article data-article-content>
        <h2 id="intro">오늘의 목표</h2>
        <p>본문</p>
        <h2 id="next">다음 섹션</h2>
      </article>
    `;

    const article = document.querySelector<HTMLElement>(
      "[data-article-content]",
    )!;
    const headings = Array.from(article.querySelectorAll("h2"));
    vi.spyOn(article, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 700,
      left: 0,
      right: 800,
      width: 800,
      height: 600,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    vi.spyOn(headings[0]!, "getBoundingClientRect").mockReturnValue({
      top: 120,
      bottom: 150,
      left: 0,
      right: 800,
      width: 800,
      height: 30,
      x: 0,
      y: 120,
      toJSON: () => ({}),
    });
    vi.spyOn(headings[1]!, "getBoundingClientRect").mockReturnValue({
      top: 420,
      bottom: 450,
      left: 0,
      right: 800,
      width: 800,
      height: 30,
      x: 0,
      y: 420,
      toJSON: () => ({}),
    });

    const listener = vi.fn();
    window.addEventListener("seojing:qa-context", listener);

    render(<SectionQaPrompts />);

    const prompts = await screen.findAllByRole("button", {
      name: /이 부분에 대해 질문하기/,
    });
    expect(prompts.length).toBeGreaterThanOrEqual(1);
    expect(prompts[0]).toHaveStyle({ top: "248px" });

    fireEvent.click(prompts[0]!);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { sectionTitle: "오늘의 목표" } }),
    );

    window.removeEventListener("seojing:qa-context", listener);
  });

  it("stays hidden when the article target is missing", async () => {
    const { container } = render(
      <SectionQaPrompts articleSelector="[missing]" />,
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /이 부분에 대해 질문하기/ }),
      ).not.toBeInTheDocument(),
    );
    expect(container).toBeEmptyDOMElement();
  });
});
