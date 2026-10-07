import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MdxReviewQueue } from "./MdxReviewQueue";

vi.mock("@/shared/content/mdx-migration-manifest.json", () => ({
  default: [
    {
      slug: "study/old-post",
      sourcePath: "study/old-post.mdx",
      sourceSha256: "a".repeat(64),
      components: [],
    },
  ],
}));

afterEach(() => vi.unstubAllGlobals());

describe("MdxReviewQueue", () => {
  it("identifies a staged document revision even while the published revision remains MDX", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          articles: [
            {
              slug: "study/old-post",
              title: "Old post",
              status: "PUBLISHED",
              sourceFormat: "MDX",
              sourceSha256: "a".repeat(64),
              latestRevisionFormat: "DOCUMENT",
              migrationSourceSha256: "a".repeat(64),
            },
          ],
        }),
      ),
    );

    render(<MdxReviewQueue selectedSlug="" />);

    expect(await screen.findByText("문서 준비")).toBeVisible();
  });
});
