import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostQaPanel } from "./PostQaPanel";

const successResponse = {
  status: "answered",
  answer: "현재 인덱스에서 찾은 근거로 답하면 다음과 같아요.",
  sources: [
    {
      chunkId: "study/backend/day1#controller",
      slug: "study/backend/day1",
      href: "/blog/study/backend/day1",
      title: "백엔드 스터디 Day 1",
      heading: "Controller는 요청을 받는다",
      excerpt: "Controller는 HTTP 요청을 Service에 넘긴다.",
      score: 12,
    },
  ],
  relatedPosts: [],
  analytics: {
    event_type: "qa_interaction",
    event: { action: "answer_shown", question_length_bucket: "1-40" },
  },
  generated_at: "2026-06-08T01:00:00.000Z",
};

describe("PostQaPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(successResponse), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("submits a question to the post QA API and renders source links", async () => {
    render(
      <PostQaPanel slug="study/backend/day1" title="백엔드 스터디 Day 1" />,
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: "이 글에 대해 질문하기" }),
      {
        target: { value: "Controller는 Service랑 어떻게 연결돼?" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/rag/query",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: "study/backend/day1",
          question: "Controller는 Service랑 어떻게 연결돼?",
        }),
      }),
    );
    expect(
      await screen.findByText(/현재 인덱스에서 찾은 근거/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Controller는 요청을 받는다/ }),
    ).toHaveAttribute(
      "href",
      "/blog/study/backend/day1#study%2Fbackend%2Fday1%23controller",
    );
  });

  it("keeps a local-only recent question log", async () => {
    render(
      <PostQaPanel slug="study/backend/day1" title="백엔드 스터디 Day 1" />,
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: "이 글에 대해 질문하기" }),
      {
        target: { value: "Repository는 DB랑 어떻게 연결돼?" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));

    expect(await screen.findByText("최근 질문 로그")).toBeInTheDocument();
    expect(
      screen.getByText("Repository는 DB랑 어떻게 연결돼?"),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("seojing_post_qa_log_v1")).toContain(
      "Repository는 DB랑 어떻게 연결돼?",
    );
  });

  it("dispatches privacy-safe qa analytics metadata without the raw question", async () => {
    const listener = vi.fn();
    window.addEventListener("seojing:qa-interaction", listener);

    render(
      <PostQaPanel slug="study/backend/day1" title="백엔드 스터디 Day 1" />,
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "이 글에 대해 질문하기" }),
      {
        target: { value: "민감한 원문 질문" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));

    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({
      action: "answer_shown",
      question_length_bucket: "1-40",
    });
    expect(JSON.stringify(event.detail)).not.toContain("민감한 원문 질문");

    window.removeEventListener("seojing:qa-interaction", listener);
  });

  it("shows a degraded message when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: "error" }), { status: 500 }),
      ),
    );

    render(
      <PostQaPanel slug="study/backend/day1" title="백엔드 스터디 Day 1" />,
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "이 글에 대해 질문하기" }),
      {
        target: { value: "질문 실패하면?" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));

    expect(
      await screen.findByText(/질문 API가 잠시 불안정해요/),
    ).toBeInTheDocument();
  });
});
