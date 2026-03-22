import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ArticleQuiz } from "./article-quiz";
import { ArticleQuizItem } from "./article-quiz";

describe("ArticleQuiz", () => {
  it("renders nothing when there are no children", () => {
    const { container } = render(<ArticleQuiz>{[]}</ArticleQuiz>);
    expect(container.firstChild).toBeNull();
  });

  it("renders quiz header and progress indicator", () => {
    render(
      <ArticleQuiz>
        <ArticleQuizItem
          mode="multiple"
          question="What is 1+1?"
          choices={["1", "2", "3"]}
          answer={1}
        />
      </ArticleQuiz>,
    );
    expect(screen.getByText("Quiz")).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });

  it("shows step progress for multiple items", () => {
    render(
      <ArticleQuiz>
        <ArticleQuizItem
          mode="multiple"
          question="Q1?"
          choices={["A", "B"]}
          answer={0}
        />
        <ArticleQuizItem
          mode="multiple"
          question="Q2?"
          choices={["A", "B"]}
          answer={1}
        />
      </ArticleQuiz>,
    );
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });
});

describe("ArticleQuizItem - multiple choice", () => {
  it("renders question and choices", () => {
    render(
      <ArticleQuizItem
        mode="multiple"
        question="What is React?"
        choices={["A library", "A framework", "A language"]}
        answer={0}
      />,
    );
    expect(screen.getByText("What is React?")).toBeInTheDocument();
    expect(screen.getByText("A library")).toBeInTheDocument();
    expect(screen.getByText("A framework")).toBeInTheDocument();
    expect(screen.getByText("A language")).toBeInTheDocument();
  });

  it("calls onResult with true when correct answer is selected", () => {
    const onResult = vi.fn();
    render(
      <ArticleQuizItem
        mode="multiple"
        question="Pick B"
        choices={["A", "B", "C"]}
        answer={1}
        onResult={onResult}
      />,
    );
    fireEvent.click(screen.getByText("B"));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it("calls onResult with false when wrong answer is selected", () => {
    const onResult = vi.fn();
    render(
      <ArticleQuizItem
        mode="multiple"
        question="Pick B"
        choices={["A", "B", "C"]}
        answer={1}
        onResult={onResult}
      />,
    );
    fireEvent.click(screen.getByText("A"));
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("disables choices after submission", () => {
    render(
      <ArticleQuizItem
        mode="multiple"
        question="Q?"
        choices={["A", "B"]}
        answer={0}
      />,
    );
    fireEvent.click(screen.getByText("A"));
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("shows explanation after submission", () => {
    vi.useFakeTimers();
    render(
      <ArticleQuizItem
        mode="multiple"
        question="Q?"
        choices={["A", "B"]}
        answer={0}
        explanation="Because A is correct"
      />,
    );
    fireEvent.click(screen.getByText("A"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Because A is correct")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows correct answer text when wrong", () => {
    vi.useFakeTimers();
    render(
      <ArticleQuizItem
        mode="multiple"
        question="Q?"
        choices={["Wrong", "Right"]}
        answer={1}
      />,
    );
    fireEvent.click(screen.getByText("Wrong"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("오답입니다.")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows next button after explanation and calls onNext", () => {
    vi.useFakeTimers();
    const onNext = vi.fn();
    render(
      <ArticleQuizItem
        mode="multiple"
        question="Q?"
        choices={["A", "B"]}
        answer={0}
        onNext={onNext}
      />,
    );
    fireEvent.click(screen.getByText("A"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("다음 문제")).toBeInTheDocument();
    fireEvent.click(screen.getByText("다음 문제"));
    expect(onNext).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("ArticleQuizItem - description mode", () => {
  it("renders input field", () => {
    render(
      <ArticleQuizItem
        mode="description"
        question="What is JSX?"
        answer="JSX"
      />,
    );
    expect(
      screen.getByPlaceholderText("정답을 입력해보세요..."),
    ).toBeInTheDocument();
  });

  it("does not submit with empty input", () => {
    const onResult = vi.fn();
    render(
      <ArticleQuizItem
        mode="description"
        question="Q?"
        answer="answer"
        onResult={onResult}
      />,
    );
    const submitBtn = screen.getByText("정답 확인");
    expect(submitBtn).toBeDisabled();
  });

  it("submits correct answer ignoring case and whitespace", () => {
    const onResult = vi.fn();
    render(
      <ArticleQuizItem
        mode="description"
        question="Q?"
        answer="Hello World"
        onResult={onResult}
      />,
    );
    const input = screen.getByPlaceholderText("정답을 입력해보세요...");
    fireEvent.change(input, { target: { value: "hello world" } });
    fireEvent.click(screen.getByText("정답 확인"));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it("submits wrong answer", () => {
    const onResult = vi.fn();
    render(
      <ArticleQuizItem
        mode="description"
        question="Q?"
        answer="correct"
        onResult={onResult}
      />,
    );
    const input = screen.getByPlaceholderText("정답을 입력해보세요...");
    fireEvent.change(input, { target: { value: "wrong" } });
    fireEvent.click(screen.getByText("정답 확인"));
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("submits on Enter key", () => {
    const onResult = vi.fn();
    render(
      <ArticleQuizItem
        mode="description"
        question="Q?"
        answer="test"
        onResult={onResult}
      />,
    );
    const input = screen.getByPlaceholderText("정답을 입력해보세요...");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it("disables input after submission", () => {
    render(<ArticleQuizItem mode="description" question="Q?" answer="test" />);
    const input = screen.getByPlaceholderText("정답을 입력해보세요...");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(screen.getByText("정답 확인"));
    expect(input).toBeDisabled();
  });

  it("shows explanation immediately after submission (delay=0 for description)", () => {
    vi.useFakeTimers();
    render(
      <ArticleQuizItem
        mode="description"
        question="Q?"
        answer="test"
        explanation="Explanation text"
      />,
    );
    const input = screen.getByPlaceholderText("정답을 입력해보세요...");
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(screen.getByText("정답 확인"));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText("Explanation text")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows correct answer when wrong in description mode", () => {
    vi.useFakeTimers();
    render(
      <ArticleQuizItem
        mode="description"
        question="Q?"
        answer="correct answer"
      />,
    );
    const input = screen.getByPlaceholderText("정답을 입력해보세요...");
    fireEvent.change(input, { target: { value: "wrong" } });
    fireEvent.click(screen.getByText("정답 확인"));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText("오답입니다.")).toBeInTheDocument();
    expect(screen.getByText("correct answer")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
