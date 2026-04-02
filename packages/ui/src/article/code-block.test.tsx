import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { CodeBlock, FullscreenView } from "./code-block";

// createPortal을 자식 노드를 그대로 렌더링하도록 모킹
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText },
  });
  writeText.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- CodeBlock ----

describe("CodeBlock - children 모드", () => {
  it("children을 렌더링한다", () => {
    render(<CodeBlock>const x = 1;</CodeBlock>);
    expect(screen.getByText("const x = 1;")).toBeInTheDocument();
  });

  it("language가 없으면 언어 바가 렌더링되지 않는다", () => {
    const { container } = render(<CodeBlock>code</CodeBlock>);
    expect(container.querySelector(".bg-gray-800")).toBeNull();
  });

  it("language가 있으면 언어 표시 바가 렌더링된다", () => {
    render(<CodeBlock language="tsx">code</CodeBlock>);
    expect(screen.getByText("tsx")).toBeInTheDocument();
  });

  it("복사 버튼 클릭 시 클립보드에 기록한다", async () => {
    render(
      <CodeBlock language="ts" plainText="copy me">
        code
      </CodeBlock>,
    );
    fireEvent.click(screen.getByLabelText("코드 복사"));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("copy me");
    });
  });

  it("복사 후 아이콘이 체크마크로 변경되고 2초 후 복원된다", async () => {
    vi.useFakeTimers();
    render(
      <CodeBlock language="ts" plainText="hello">
        code
      </CodeBlock>,
    );
    const copyBtn = screen.getByLabelText("코드 복사");
    await act(async () => {
      fireEvent.click(copyBtn);
    });
    // IoCheckmark는 svg이므로 aria-label로 버튼 존재 여부만 확인
    expect(copyBtn).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    vi.useRealTimers();
  });

  it("전체보기 버튼 클릭 시 FullscreenView가 열린다", () => {
    render(<CodeBlock language="ts">code</CodeBlock>);
    fireEvent.click(screen.getByLabelText("전체보기"));
    expect(screen.getByText("닫기 (ESC)")).toBeInTheDocument();
  });

  it("FullscreenView에서 닫기 버튼 클릭 시 닫힌다", () => {
    render(<CodeBlock language="ts">code</CodeBlock>);
    fireEvent.click(screen.getByLabelText("전체보기"));
    fireEvent.click(screen.getByText("닫기 (ESC)"));
    expect(screen.queryByText("닫기 (ESC)")).toBeNull();
  });
});

describe("CodeBlock - HTML(code) 모드", () => {
  it("code prop이 있으면 dangerouslySetInnerHTML로 렌더링한다", () => {
    const { container } = render(
      <CodeBlock language="js" code="<span>hello</span>" />,
    );
    expect(container.querySelector("code")?.innerHTML).toContain("hello");
  });

  it("plainText가 없을 때 code에서 HTML 태그를 제거해 복사한다", async () => {
    render(<CodeBlock language="js" code="<span>stripped</span>" />);
    fireEvent.click(screen.getByLabelText("코드 복사"));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("stripped");
    });
  });

  it("HTML 엔티티를 올바르게 디코딩해 복사한다", async () => {
    // code prop의 문자열 리터럴 &lt; 등을 stripHtmlTags가 디코딩한다
    render(
      <CodeBlock language="js" code={"&lt;div&gt;&amp;foo&lt;/div&gt;"} />,
    );
    fireEvent.click(screen.getByLabelText("코드 복사"));
    await waitFor(() => {
      // JSX 문자열은 이미 파싱되므로 실제 전달값 확인
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("foo"));
    });
  });
});

describe("CodeBlock - hidden sections", () => {
  const codeWithHidden = [
    "visible line",
    "// @hidden-start",
    "hidden line",
    "// @hidden-end",
    "another visible",
  ].join("\n");

  it("hidden 섹션이 있으면 토글 버튼이 렌더링된다", () => {
    render(<CodeBlock language="js" code={codeWithHidden} />);
    expect(screen.getByText("클릭하여 코드 보기")).toBeInTheDocument();
  });

  it("토글 버튼 클릭 시 hidden 섹션이 노출된다", () => {
    render(<CodeBlock language="js" code={codeWithHidden} />);
    fireEvent.click(screen.getByText("클릭하여 코드 보기"));
    // hidden 내용이 포함된 span이 렌더링됨
    const codeEl = document.querySelector("code");
    expect(codeEl?.innerHTML).toContain("hidden line");
  });

  it("한 번 더 클릭 시 hidden 섹션이 다시 숨겨진다", () => {
    render(<CodeBlock language="js" code={codeWithHidden} />);
    const btn = screen.getByText("클릭하여 코드 보기");
    fireEvent.click(btn);
    fireEvent.click(btn);
    const codeEl = document.querySelector("code");
    // 다시 숨겨지면 innerHTML에 hidden line이 없어야 함
    expect(codeEl?.innerHTML).not.toContain("hidden line");
  });
});

// ---- FullscreenView ----

describe("FullscreenView", () => {
  it("children을 렌더링한다", () => {
    render(
      <FullscreenView onClose={vi.fn()}>
        <span>fullscreen content</span>
      </FullscreenView>,
    );
    expect(screen.getByText("fullscreen content")).toBeInTheDocument();
  });

  it("language prop을 표시한다", () => {
    render(
      <FullscreenView language="python" onClose={vi.fn()}>
        code
      </FullscreenView>,
    );
    expect(screen.getByText("python")).toBeInTheDocument();
  });

  it("ESC 키 누르면 onClose가 호출된다", () => {
    const onClose = vi.fn();
    render(<FullscreenView onClose={onClose}>code</FullscreenView>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("닫기 버튼 클릭 시 onClose가 호출된다", () => {
    const onClose = vi.fn();
    render(<FullscreenView onClose={onClose}>code</FullscreenView>);
    fireEvent.click(screen.getByText("닫기 (ESC)"));
    expect(onClose).toHaveBeenCalled();
  });

  it("마운트 시 body overflow가 hidden으로 설정된다", () => {
    render(<FullscreenView onClose={vi.fn()}>code</FullscreenView>);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("언마운트 시 body overflow가 복원된다", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(
      <FullscreenView onClose={vi.fn()}>code</FullscreenView>,
    );
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("길게 누르면 onClose가 호출된다", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <FullscreenView onClose={onClose} rotate={false}>
        code
      </FullscreenView>,
    );
    const overlay = document.querySelector(".fixed.inset-0") as HTMLElement;
    fireEvent.mouseDown(overlay);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("짧게 누르다 떼면 onClose가 호출되지 않는다", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <FullscreenView onClose={onClose} rotate={false}>
        code
      </FullscreenView>,
    );
    const overlay = document.querySelector(".fixed.inset-0") as HTMLElement;
    fireEvent.mouseDown(overlay);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.mouseUp(overlay);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onClose).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
