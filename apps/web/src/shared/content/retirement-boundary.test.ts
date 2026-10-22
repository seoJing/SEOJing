// @vitest-environment node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  blogNavItems,
  portfolioNavItems,
} from "@/widgets/header/header.constants";

const retainedEntries = Array.from({ length: 201 }, (_, index) => ({
  type: "file" as const,
  name: "article-" + index,
  path: "/archive/article-" + index,
  frontmatter: {
    title: "Article " + index,
    description: "Native document article",
    date: "2026-10-01",
  },
}));

vi.mock("@/shared/config", () => ({
  getContentTree: async () => retainedEntries,
}));

import sitemap from "@/app/sitemap";
import { GET as rss } from "@/app/rss.xml/route";
import { GET as llms } from "@/app/llms.txt/route";

function files(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((item) => {
    const path = resolve(root, item.name);
    return item.isDirectory() ? files(path) : [path];
  });
}

describe("post-MDX retirement boundary", () => {
  it("keeps canonical public/ops routes and required native content contracts", () => {
    const routes = files(resolve("src/app"))
      .filter((path) => /\/(?:page|route)\.tsx?$/.test(path))
      .map((path) => relative(resolve("src/app"), path));
    for (const route of [
      "blog/page.tsx",
      "blog/[...slug]/page.tsx",
      "ops/articles/page.tsx",
      "ops/articles/edit/page.tsx",
      "rss.xml/route.ts",
      "llms.txt/route.ts",
    ])
      expect(routes).toContain(route);
    expect(readFileSync(resolve("package.json"), "utf8")).toContain(
      "@giscus/react",
    );
  });

  it("has no active MDX source, generated bundle, review UI, or authoring tool", () => {
    expect(files(resolve("content"))).toEqual([]);
    expect(files(resolve("src/generated"))).toEqual([]);
    for (const path of [
      "src/shared/content/mdx-migration-manifest.json",
      "src/widgets/ops-articles/MdxReviewQueue.tsx",
      "scripts/check-content-assets.mjs",
      "scripts/generate-content-covers.mjs",
      "scripts/generate-inline-visuals.mjs",
      "scripts/insert-content-image.mjs",
    ])
      expect(existsSync(resolve(path)), path).toBe(false);
    const active = [
      ...files(resolve("src")),
      ...files(resolve("scripts")),
      ...files(resolve("worker")),
    ].filter(
      (path) =>
        /\.(?:tsx?|mjs|json)$/.test(path) &&
        !/\.(?:test|spec|smoke)\./.test(path),
    );
    for (const path of active) {
      const source = readFileSync(path, "utf8");
      expect(source, relative(process.cwd(), path)).not.toMatch(
        /mdx-migration-manifest|MdxReviewQueue|src\/generated\/content|content\/resume\.mdx/,
      );
    }
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    for (const name of [
      "asset:insert",
      "cover:auto",
      "visual:auto",
      "check:content-assets",
    ])
      expect(pkg.scripts).not.toHaveProperty(name);
  });

  it("emits all API/D1-backed article links in sitemap/RSS/llms", async () => {
    const urls = (await sitemap()).map((item) => item.url);
    for (const entry of retainedEntries)
      expect(urls).toContain("https://seojing.com/blog" + entry.path);
    expect(urls).toContain("https://seojing.com/blog");
    expect((await (await rss()).text()).match(/<item>/g)).toHaveLength(50);
    expect(await (await llms()).text()).toContain("https://seojing.com/blog/");
  });

  it("keeps retired Career and interaction routes/modules absent", () => {
    const routes = files(resolve("src/app")).map((path) =>
      relative(resolve("src/app"), path),
    );
    expect(
      routes.filter((path) =>
        /(?:^|\/)(?:careers?|community|comments|rag|tts)(?:\/|$)/i.test(path),
      ),
    ).toEqual([]);
    expect(JSON.stringify([...blogNavItems, ...portfolioNavItems])).not.toMatch(
      /https:\/\/seojing\.com\/careers?/i,
    );
  });
});
