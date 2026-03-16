import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { scanContentDir, getContentBySlug, isContentFolder } from "./content";
import { getItemsForPath, type ContentTree } from "./content-types";
import { calculateReadingTime } from "./reading-time";

// ─── calculateReadingTime ───────────────────────────────────────────

describe("calculateReadingTime", () => {
  it("returns 1 for very short text", () => {
    expect(calculateReadingTime("짧은 글")).toBe(1);
  });

  it("returns 1 for empty text", () => {
    expect(calculateReadingTime("")).toBe(1);
  });

  it("calculates based on 500 chars/min for Korean text", () => {
    const text = "가".repeat(1000);
    expect(calculateReadingTime(text)).toBe(2);
  });

  it("ignores whitespace in character count", () => {
    const text = "가 ".repeat(500);
    // 500 '가' chars + 500 spaces → only 500 non-whitespace = 1 min
    expect(calculateReadingTime(text)).toBe(1);
  });

  it("rounds to nearest minute", () => {
    // 750 chars → 750/500 = 1.5 → round = 2
    const text = "가".repeat(750);
    expect(calculateReadingTime(text)).toBe(2);
  });

  it("returns minimum 1 even for very short content", () => {
    expect(calculateReadingTime("a")).toBe(1);
  });
});

// ─── getItemsForPath ────────────────────────────────────────────────

describe("getItemsForPath", () => {
  const tree: ContentTree = [
    {
      name: "study",
      type: "folder",
      path: "/study",
      children: [
        {
          name: "hooks",
          type: "folder",
          path: "/study/hooks",
          children: [
            {
              name: "useState.mdx",
              type: "file",
              path: "/study/hooks/useState.mdx",
              extension: "mdx",
            },
          ],
        },
        {
          name: "intro.mdx",
          type: "file",
          path: "/study/intro.mdx",
          extension: "mdx",
        },
      ],
    },
    {
      name: "blog.mdx",
      type: "file",
      path: "/blog.mdx",
      extension: "mdx",
    },
  ];

  it("returns root tree for '/'", () => {
    expect(getItemsForPath(tree, "/")).toBe(tree);
  });

  it("returns root tree for empty string", () => {
    expect(getItemsForPath(tree, "")).toBe(tree);
  });

  it("returns children of a top-level folder", () => {
    const items = getItemsForPath(tree, "/study");
    expect(items).toHaveLength(2);
    expect(items[0]!.name).toBe("hooks");
  });

  it("returns children of a nested folder", () => {
    const items = getItemsForPath(tree, "/study/hooks");
    expect(items).toHaveLength(1);
    expect(items[0]!.name).toBe("useState.mdx");
  });

  it("returns empty array for non-existent path", () => {
    expect(getItemsForPath(tree, "/nonexistent")).toEqual([]);
  });

  it("returns empty array when targeting a file (not folder)", () => {
    expect(getItemsForPath(tree, "/blog.mdx")).toEqual([]);
  });
});

// ─── scanContentDir (with real temp files) ──────────────────────────

describe("scanContentDir", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "content-test-"));

    // Create structure:
    // tmpDir/
    //   folder-a/
    //     post.mdx  (with frontmatter)
    //   hello.mdx   (with frontmatter)
    //   readme.txt  (non-mdx)
    fs.mkdirSync(path.join(tmpDir, "folder-a"));

    fs.writeFileSync(
      path.join(tmpDir, "folder-a", "post.mdx"),
      `---
title: "Post Title"
date: "2024-01-01"
tags: ["react", "hooks"]
description: "A post"
---
Content here`,
    );

    fs.writeFileSync(
      path.join(tmpDir, "hello.mdx"),
      `---
title: "Hello"
date: "2024-02-01"
tags: []
description: "Hello world"
---
Hello content`,
    );

    fs.writeFileSync(path.join(tmpDir, "readme.txt"), "Just a text file");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("scans directory and returns sorted tree (folders first)", () => {
    const tree = scanContentDir(tmpDir);
    expect(tree).toHaveLength(3);
    expect(tree[0]!.type).toBe("folder");
    expect(tree[0]!.name).toBe("folder-a");
  });

  it("parses frontmatter from mdx files", () => {
    const tree = scanContentDir(tmpDir);
    const helloFile = tree.find((n) => n.name === "hello.mdx");
    expect(helloFile?.frontmatter).toEqual({
      title: "Hello",
      date: "2024-02-01",
      tags: [],
      description: "Hello world",
    });
  });

  it("does not add frontmatter for non-mdx files", () => {
    const tree = scanContentDir(tmpDir);
    const txtFile = tree.find((n) => n.name === "readme.txt");
    expect(txtFile?.frontmatter).toBeUndefined();
    expect(txtFile?.extension).toBe("txt");
  });

  it("recursively scans subfolders", () => {
    const tree = scanContentDir(tmpDir);
    const folder = tree.find((n) => n.name === "folder-a");
    expect(folder?.children).toHaveLength(1);
    expect(folder?.children?.[0]?.name).toBe("post.mdx");
    expect(folder?.children?.[0]?.frontmatter?.title).toBe("Post Title");
  });

  it("returns empty array for non-existent directory", () => {
    expect(scanContentDir("/tmp/does-not-exist-xyz")).toEqual([]);
  });

  it("prevents path traversal", () => {
    const tree = scanContentDir(tmpDir, "../../../etc");
    expect(tree).toEqual([]);
  });

  it("sets itemCount on folders", () => {
    const tree = scanContentDir(tmpDir);
    const folder = tree.find((n) => n.name === "folder-a");
    expect(folder?.itemCount).toBe(1);
  });

  it("uses filename as title when frontmatter title is missing", () => {
    fs.writeFileSync(
      path.join(tmpDir, "no-title.mdx"),
      `---
date: "2024-01-01"
---
content`,
    );
    const tree = scanContentDir(tmpDir);
    const file = tree.find((n) => n.name === "no-title.mdx");
    expect(file?.frontmatter?.title).toBe("no-title.mdx");
  });
});

// ─── getContentBySlug ───────────────────────────────────────────────

describe("getContentBySlug", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "slug-test-"));

    fs.mkdirSync(path.join(tmpDir, "study"), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, "study", "react.mdx"),
      `---
title: "React Guide"
date: "2024-03-01"
tags: ["react"]
description: "Learn React"
---
# React Guide Content`,
    );

    fs.writeFileSync(
      path.join(tmpDir, "fallback.md"),
      `---
title: "Fallback"
date: "2024-04-01"
tags: []
description: "MD file"
---
Markdown content`,
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns content for valid mdx slug", () => {
    const result = getContentBySlug(tmpDir, ["study", "react"]);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.title).toBe("React Guide");
    expect(result!.source).toContain("# React Guide Content");
  });

  it("falls back to .md extension", () => {
    const result = getContentBySlug(tmpDir, ["fallback"]);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.title).toBe("Fallback");
  });

  it("returns null for non-existent slug", () => {
    expect(getContentBySlug(tmpDir, ["nonexistent"])).toBeNull();
  });

  it("prevents path traversal", () => {
    expect(getContentBySlug(tmpDir, ["..", "..", "etc", "passwd"])).toBeNull();
  });

  it("uses last slug segment as fallback title", () => {
    fs.writeFileSync(
      path.join(tmpDir, "no-title.mdx"),
      `---
date: "2024-01-01"
---
content`,
    );
    const result = getContentBySlug(tmpDir, ["no-title"]);
    expect(result?.frontmatter.title).toBe("no-title");
  });
});

// ─── isContentFolder ────────────────────────────────────────────────

describe("isContentFolder", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join("/tmp", "folder-test-"));
    fs.mkdirSync(path.join(tmpDir, "study"));
    fs.writeFileSync(path.join(tmpDir, "file.mdx"), "content");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns true for existing folder", () => {
    expect(isContentFolder(tmpDir, ["study"])).toBe(true);
  });

  it("returns false for a file", () => {
    expect(isContentFolder(tmpDir, ["file.mdx"])).toBe(false);
  });

  it("returns false for non-existent path", () => {
    expect(isContentFolder(tmpDir, ["nope"])).toBe(false);
  });

  it("prevents path traversal", () => {
    expect(isContentFolder(tmpDir, ["..", "..", "etc"])).toBe(false);
  });
});
