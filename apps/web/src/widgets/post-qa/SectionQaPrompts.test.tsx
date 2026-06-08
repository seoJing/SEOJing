import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SectionQaPrompts } from "./SectionQaPrompts";

class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
}

function stubDesktopMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("SectionQaPrompts", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    stubDesktopMedia(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: "answered",
              answer: "이 부분은 요청과 응답 흐름을 설명해요.",
              sources: [],
              relatedPosts: [],
              analytics: {
                event: {
                  action: "answer_shown",
                  question_length_bucket: "1-40",
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("renders an arrow-only prompt, expands inline, and asks with section context", async () => {
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

    render(<SectionQaPrompts slug="study/backend/day1" />);

    const prompts = await screen.findAllByRole("button", {
      name: "이 부분에 대해 질문하기",
    });
    expect(prompts[0]?.parentElement).toHaveStyle({ top: "248px" });
    expect(prompts[0]).toHaveClass("w-9");

    fireEvent.click(prompts[0]!);
    expect(screen.getByText("이 주제에 대한 질문")).toBeInTheDocument();
    expect(
      screen.getByText(
        "「오늘의 목표」 부분을 기준으로 오케이징에게 물어봐요.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText("오늘의 목표 부분에 대해 질문하기"),
      {
        target: { value: "왜 여기서 Controller부터 보나요?" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "묻기" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/rag/query",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            slug: "study/backend/day1",
            question:
              "[오늘의 목표 부분에 대한 질문] 왜 여기서 Controller부터 보나요?",
          }),
        }),
      ),
    );
    expect(
      await screen.findByText("이 부분은 요청과 응답 흐름을 설명해요."),
    ).toBeInTheDocument();
  });

  it("does not render section prompts outside the desktop breakpoint", async () => {
    stubDesktopMedia(false);
    document.body.innerHTML = `
      <article data-article-content>
        <h2 id="intro">오늘의 목표</h2>
        <p>본문</p>
        <h2 id="next">다음 섹션</h2>
      </article>
    `;

    const { container } = render(
      <SectionQaPrompts slug="study/backend/day1" />,
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "이 부분에 대해 질문하기" }),
      ).not.toBeInTheDocument(),
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden when the article target is missing", async () => {
    const { container } = render(
      <SectionQaPrompts
        slug="study/backend/day1"
        articleSelector="[missing]"
      />,
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "이 부분에 대해 질문하기" }),
      ).not.toBeInTheDocument(),
    );
    expect(container).toBeEmptyDOMElement();
  });
});
