import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpsArticleList } from "./OpsArticleList";

afterEach(() => vi.unstubAllGlobals());

describe("OpsArticleList", () => {
  it("paginates the CMS queue and combines status, format, and title filters", async () => {
    const articles = Array.from({ length: 22 }, (_, index) => ({
      slug: `study/post-${index + 1}`,
      title: `Post ${index + 1}`,
      status: index < 20 ? "DRAFT" : "PUBLISHED",
      sourceFormat: index === 20 ? "BLOCKS" : "MDX",
      updatedAt: new Date(Date.UTC(2026, 9, 7, 0, 0, 22 - index)).toISOString(),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true, articles })),
    );
    render(<OpsArticleList />);
    expect(await screen.findByText("22개 글 · 최근 수정일 순")).toBeVisible();
    expect(screen.getByText("1 / 2")).toBeVisible();
    expect(screen.getByText("Post 1").closest("a")).toHaveAttribute(
      "href",
      "/ops/articles/edit?slug=study%2Fpost-1",
    );
    expect(screen.queryByText("Post 21")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByText("Post 21")).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "상태 필터" }), {
      target: { value: "PUBLISHED" },
    });
    expect(screen.getByText("2개 글 · 최근 수정일 순")).toBeVisible();
    expect(screen.getByText("1 / 1")).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "형식 필터" }), {
      target: { value: "BLOCKS" },
    });
    expect(screen.getByText("1개 글 · 최근 수정일 순")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "글 검색" }), {
      target: { value: "other" },
    });
    expect(screen.getByText("조건에 맞는 글이 없습니다.")).toBeVisible();
  });
});

it("selects only the current page, shows indeterminate, clears hidden selection, and sends explicit filtered IDs", async () => {
  const articles = Array.from({ length: 22 }, (_, index) => ({
    slug: `study/post-${index}`,
    title: `Study ${index}`,
    category: index === 21 ? "Other" : "Study",
    status: "PUBLISHED",
    sourceFormat: "DOCUMENT",
    updatedAt: "2026-10-22T00:00:00Z",
  }));
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) =>
    init?.method === "POST"
      ? Response.json({
          ok: true,
          results: JSON.parse(String(init.body)).slugs.map((slug: string) => ({
            slug,
            ok: true,
          })),
        })
      : Response.json({ ok: true, articles }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<OpsArticleList />);
  await screen.findByText("22개 글 · 최근 수정일 순");
  fireEvent.click(screen.getByRole("checkbox", { name: "Study 0 선택" }));
  expect(
    screen.getByRole("checkbox", { name: "현재 페이지 전체 선택" }),
  ).toBePartiallyChecked();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "현재 페이지 전체 선택" }),
  );
  expect(screen.getByText("20개 선택")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  expect(screen.getByText("0개 선택")).toBeVisible();
  fireEvent.change(screen.getByRole("combobox", { name: "카테고리 필터" }), {
    target: { value: "Study" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "현재 필터 전체 21개 선택" }),
  );
  expect(screen.getByText("21개 선택")).toBeVisible();
  fireEvent.change(screen.getByRole("textbox", { name: "글 검색" }), {
    target: { value: "study/post-0" },
  });
  expect(screen.getByText("0개 선택")).toBeVisible();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "현재 페이지 전체 선택" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "선택 비공개" }));
  expect(await screen.findByText("1 / 1 완료")).toBeVisible();
  const mutation = fetchMock.mock.calls.find(
    ([, init]) => init?.method === "POST",
  )![1]!;
  expect(JSON.parse(String(mutation.body))).toEqual({
    action: "bulkUnpublish",
    slugs: ["study/post-0"],
    scope: { category: "Study", query: "study/post-0" },
  });
  vi.restoreAllMocks();
});
