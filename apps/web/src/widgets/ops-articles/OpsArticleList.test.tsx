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
