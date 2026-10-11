import { describe, expect, it, vi } from "vitest";
import {
  deletePublicArticle,
  buildPublicContentTree,
  compactPublicArticle,
  listPublicArticleSummaries,
  putPublicArticle,
  readPublicArticle,
  type PublicArticleSummary,
} from "./public-article-store";
import { flattenContentTree } from "@/shared/seo/content";
import { toBackendArticleContentData } from "./backend-article";

const article = (
  slug: string,
  title: string,
  date: string,
): PublicArticleSummary => ({
  slug,
  title,
  description: `${title} summary`,
  category: "Study",
  tags: ["CMS"],
  cover: null,
  displayDate: date,
  displayUpdatedAt: null,
  publishedAt: date,
  updatedAt: date,
});

describe("published article index", () => {
  it("stores one canonical JSON body and still derives reading text", () => {
    const snapshot = compactPublicArticle({
      slug: "cms/post",
      title: "Post",
      description: null,
      publishedAt: "2026-10-07",
      updatedAt: "2026-10-07",
      body: {
        html: "<p>Duplicated prose</p>",
        blocks: [
          {
            id: "a",
            type: "PARAGRAPH",
            sortOrder: 0,
            content: {},
            plainText: "Duplicated prose",
          },
        ],
        document: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Canonical prose" }],
            },
          ],
        },
      },
    });
    expect(snapshot.body.html).toBe("");
    expect(snapshot.body.blocks).toEqual([]);
    expect(toBackendArticleContentData(snapshot).source).toBe(
      "Canonical prose",
    );
  });
  it("builds nested navigation and SEO entries from published summaries without source files", () => {
    const tree = buildPublicContentTree([
      article("study/typescript/day2", "Day two", "2026-10-02"),
      article("study/typescript/day1", "Day one", "2026-10-01"),
      article("note", "Note", "2026-10-03"),
    ]);
    expect(tree[0]).toMatchObject({ type: "folder", name: "study" });
    expect(tree[1]).toMatchObject({
      type: "file",
      path: "/note",
      extension: "post",
    });
    expect(flattenContentTree(tree).map((entry) => entry.slug)).toEqual([
      "note",
      "study/typescript/day2",
      "study/typescript/day1",
    ]);
  });

  it("retains cover and display-update metadata in the public tree", () => {
    const tree = buildPublicContentTree([
      {
        ...article("news", "News", "2026-10-01"),
        cover: { src: "/cover.png", alt: "cover" },
        displayUpdatedAt: "2026-10-02",
      },
      {
        ...article("study/day1", "Study", "2026-10-03"),
        description: null,
        displayDate: null,
        publishedAt: null,
      },
    ]);
    const entries = flattenContentTree(tree);
    expect(
      entries.find((entry) => entry.slug === "news")?.frontmatter,
    ).toMatchObject({
      cover: { src: "/cover.png", alt: "cover" },
      updated: "2026-10-02",
    });
    expect(
      entries.find((entry) => entry.slug === "study/day1")?.frontmatter,
    ).toMatchObject({
      date: "2026-10-03",
      description: "",
    });
  });

  it("persists a compact published revision and reconstructs public metadata", async () => {
    const bind = vi.fn().mockReturnThis();
    const run = vi.fn().mockResolvedValue({ success: true });
    const published = {
      slug: "study/native",
      title: "Native post",
      description: "Summary",
      category: "Study",
      tags: ["CMS"],
      cover: { src: "/cover.png", alt: "Cover" },
      displayDate: "2026-10-01",
      displayUpdatedAt: "2026-10-02",
      publishedAt: "2026-10-01",
      updatedAt: "2026-10-03",
      body: {
        html: "<p>Duplicate</p>",
        document: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Canonical" }],
            },
          ],
        },
        blocks: [],
      },
    };
    const row = {
      slug: published.slug,
      title: published.title,
      description: published.description,
      category: published.category,
      tags_json: JSON.stringify(published.tags),
      cover_json: JSON.stringify(published.cover),
      display_date: published.displayDate,
      display_updated_at: published.displayUpdatedAt,
      published_at: published.publishedAt,
      updated_at: published.updatedAt,
      payload_json: JSON.stringify(compactPublicArticle(published)),
    };
    const first = vi.fn().mockResolvedValue(row);
    const all = vi.fn().mockResolvedValue({ results: [row] });
    const prepare = vi.fn().mockReturnValue({ bind, run, first, all });
    const db = { prepare } as unknown as D1Database;

    await putPublicArticle(published, db);
    expect(bind).toHaveBeenCalledWith(
      published.slug,
      published.title,
      published.description,
      published.category,
      JSON.stringify(published.tags),
      JSON.stringify(published.cover),
      published.displayDate,
      published.displayUpdatedAt,
      published.publishedAt,
      published.updatedAt,
      JSON.stringify(compactPublicArticle(published)),
    );
    expect(run).toHaveBeenCalledOnce();
    expect(await readPublicArticle(published.slug, db)).toMatchObject({
      body: { html: "", document: published.body.document },
    });
    expect(await listPublicArticleSummaries(db)).toEqual([
      expect.objectContaining({
        slug: published.slug,
        tags: ["CMS"],
        cover: published.cover,
      }),
    ]);
    expect(prepare).toHaveBeenCalledWith(
      expect.not.stringContaining("payload_json"),
    );
    await deletePublicArticle(published.slug, db);
    expect(prepare).toHaveBeenCalledWith(
      "DELETE FROM public_articles WHERE slug = ?",
    );
    expect(bind).toHaveBeenCalledWith(published.slug);
  });

  it("rejects incomplete snapshots before writing and returns null for a missing row", async () => {
    const bind = vi.fn().mockReturnThis();
    const first = vi.fn().mockResolvedValue(null);
    const prepare = vi.fn().mockReturnValue({ bind, first });
    const db = { prepare } as unknown as D1Database;
    await expect(
      putPublicArticle(
        {
          slug: "draft",
          title: "Draft",
          description: null,
          publishedAt: null,
          updatedAt: "2026-10-07",
          body: { html: "<p>Draft</p>" },
        },
        db,
      ),
    ).rejects.toThrow("unpublished");
    expect(prepare).not.toHaveBeenCalled();
    expect(await readPublicArticle("missing", db)).toBeNull();
    expect(
      compactPublicArticle({
        slug: "legacy",
        title: "Legacy",
        description: null,
        publishedAt: "2026-10-07",
        updatedAt: "2026-10-07",
        body: { html: "<p>Existing</p>" },
      }).body.html,
    ).toBe("<p>Existing</p>");
  });
});
