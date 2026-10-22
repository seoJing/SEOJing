// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import entries from "./mdx-migration-manifest.json";
import {
  blogNavItems,
  portfolioNavItems,
} from "@/widgets/header/header.constants";

vi.mock("@/shared/config", () => ({
  getContentTree: async () =>
    entries.map((entry) => ({
      type: "file",
      name: entry.slug.split("/").at(-1),
      path: `/${entry.slug}.mdx`,
      frontmatter: {
        title: entry.slug,
        description: "Retained article",
        date: "2026-10-01",
      },
    })),
}));

import sitemap from "@/app/sitemap";
import { GET as rss } from "@/app/rss.xml/route";
import { GET as llms } from "@/app/llms.txt/route";

function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((item) => {
    const path = resolve(root, item.name);
    return item.isDirectory() ? files(path) : [path];
  });
}

describe("retired Career and blog interaction boundaries", () => {
  it("keeps retired routes/modules absent and canonical article/ops routes present", () => {
    const routes = files(resolve("src/app"))
      .filter((path) => /\/(?:page|route)\.tsx?$/.test(path))
      .map((path) => relative(resolve("src/app"), path));
    expect(
      routes.filter((path) =>
        /(?:^|\/)(?:careers?|community|comments|rag|tts)(?:\/|$)/i.test(path),
      ),
    ).toEqual([]);
    for (const route of [
      "blog/page.tsx",
      "blog/[...slug]/page.tsx",
      "ops/articles/page.tsx",
      "ops/articles/edit/page.tsx",
      "rss.xml/route.ts",
      "llms.txt/route.ts",
    ]) {
      expect(routes).toContain(route);
    }
    for (const directory of [
      "src/widgets/post-qa",
      "src/widgets/blog-audio-player",
      "src/shared/rag",
    ]) {
      expect(
        existsSync(resolve(directory)) ? files(resolve(directory)) : [],
        directory,
      ).toEqual([]);
    }
    expect(existsSync(resolve("src/shared/config/giscus.ts"))).toBe(true);
    expect(existsSync(resolve("src/widgets/comment/comment-tracker.ts"))).toBe(
      false,
    );
    for (const path of [
      "src/widgets/ops-articles/MdxReviewQueue.tsx",
      "src/widgets/ops-articles/NativeDocumentEditor.tsx",
      "src/shared/content/mdx-migration-manifest.json",
      "src/shared/content/public-article-store.ts",
      "src/shared/content/backend-article-document.tsx",
      "scripts/prepare-public-article-snapshots.mjs",
      "migrations/0002_public_articles.sql",
      "worker/ops-access.ts",
      "content/resume.mdx",
      "scripts/generate-content-covers.mjs",
      "scripts/generate-inline-visuals.mjs",
      "scripts/insert-content-image.mjs",
    ])
      expect(existsSync(resolve(path)), path).toBe(true);
    expect(readFileSync(resolve("package.json"), "utf8")).toContain(
      "@giscus/react",
    );
  });

  it("has no Career links in actual navigation, blog content, or application source", () => {
    const retiredLink =
      /(?:["'`(])(?:https:\/\/seojing\.com)?\/careers?(?:[/"'`?#)]|$)/i;
    expect(JSON.stringify([...blogNavItems, ...portfolioNavItems])).not.toMatch(
      retiredLink,
    );
    expect(blogNavItems.some((item) => item.href === "/blog")).toBe(true);
    const paths = [
      ...files(resolve("src")),
      ...files(resolve("content")),
      ...files(resolve("worker")),
    ].filter(
      (path) =>
        /\.(?:tsx?|mdx|json)$/.test(path) &&
        !/\.(?:test|spec|smoke)\./.test(path) &&
        !path.includes("/generated/"),
    );
    for (const path of paths) {
      const source = readFileSync(path, "utf8");
      expect(source, relative(process.cwd(), path)).not.toMatch(retiredLink);
      expect(source, relative(process.cwd(), path)).not.toMatch(
        /(?:from\s*|import\s*)["'][^"']*(?:widgets\/(?:post-qa|blog-audio-player)|shared\/rag)[^"']*["']/,
      );
    }
  });

  it("emits retained article links in sitemap/RSS/llms without Career navigation", async () => {
    const urls = (await sitemap()).map((item) => item.url);
    for (const entry of entries)
      expect(urls).toContain(`https://seojing.com/blog/${entry.slug}`);
    expect(urls).toContain("https://seojing.com/blog");
    const feed = await (await rss()).text();
    const discovery = await (await llms()).text();
    expect(feed.match(/<item>/g)).toHaveLength(50);
    expect(discovery).toContain("https://seojing.com/blog/");
    expect([urls.join("\n"), feed, discovery].join("\n")).not.toMatch(
      /https:\/\/seojing\.com\/careers?(?:[/\s<"?]|$)/i,
    );
  });
});
