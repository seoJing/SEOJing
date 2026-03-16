import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getReadPosts,
  markAsRead,
  updateReadProgress,
  collectHrefs,
  getSubTree,
  buildDescriptionMap,
} from "./recently-read.utils";
import type { ContentNode } from "@app/utils";

const STORAGE_KEY = "seojing-read-posts";

// ─── localStorage 기반 함수 ─────────────────────────────────────────

describe("getReadPosts", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns empty array when no data", () => {
    expect(getReadPosts()).toEqual([]);
  });

  it("returns stored records", () => {
    const records = [{ href: "/blog/react", title: "React", readAt: 1000 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    expect(getReadPosts()).toEqual(records);
  });

  it("returns empty array on invalid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "bad");
    expect(getReadPosts()).toEqual([]);
  });

  it("returns empty array when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("fail");
    });
    expect(getReadPosts()).toEqual([]);
  });
});

describe("markAsRead", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it("adds a new read record", () => {
    markAsRead("/blog/react", "React");
    const posts = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(posts).toHaveLength(1);
    expect(posts[0].href).toBe("/blog/react");
    expect(posts[0].title).toBe("React");
    expect(posts[0].progress).toBe(0);
  });

  it("moves existing entry to front and preserves progress", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { href: "/blog/a", title: "A", readAt: 1, progress: 50 },
        { href: "/blog/b", title: "B", readAt: 2, progress: 0 },
      ]),
    );
    markAsRead("/blog/a", "A");
    const posts = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(posts[0].href).toBe("/blog/a");
    expect(posts[0].progress).toBe(50);
  });

  it("limits to 20 entries", () => {
    const existing = Array.from({ length: 25 }, (_, i) => ({
      href: `/blog/${i}`,
      title: `Post ${i}`,
      readAt: i,
      progress: 0,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    markAsRead("/blog/new", "New");
    const posts = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(posts.length).toBeLessThanOrEqual(20);
    expect(posts[0].href).toBe("/blog/new");
  });

  it("silently ignores localStorage errors", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("fail");
    });
    expect(() => markAsRead("/blog/x", "X")).not.toThrow();
  });
});

describe("updateReadProgress", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.restoreAllMocks());

  it("updates progress for existing record", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { href: "/blog/a", title: "A", readAt: 1, progress: 10 },
      ]),
    );
    updateReadProgress("/blog/a", 75);
    const posts = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(posts[0].progress).toBe(75);
  });

  it("keeps higher progress (never decreases)", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { href: "/blog/a", title: "A", readAt: 1, progress: 80 },
      ]),
    );
    updateReadProgress("/blog/a", 50);
    const posts = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(posts[0].progress).toBe(80);
  });

  it("does nothing for non-existent record", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ href: "/blog/a", title: "A", readAt: 1 }]),
    );
    updateReadProgress("/blog/unknown", 50);
    const posts = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(posts).toHaveLength(1);
    expect(posts[0].href).toBe("/blog/a");
  });
});

// ─── 순수 트리 유틸 함수 ─────────────────────────────────────────────

const sampleTree: ContentNode[] = [
  {
    name: "study",
    type: "folder",
    path: "/study",
    children: [
      {
        name: "react.mdx",
        type: "file",
        path: "/study/react.mdx",
        extension: "mdx",
        frontmatter: {
          title: "React",
          description: "Learn React",
          date: "2024-01-01",
          tags: ["react"],
        },
      },
    ],
  },
  {
    name: "intro.md",
    type: "file",
    path: "/intro.md",
    extension: "md",
    frontmatter: {
      title: "Intro",
      description: "Introduction",
      date: "2024-02-01",
      tags: [],
    },
  },
];

describe("collectHrefs", () => {
  it("collects hrefs from files with frontmatter", () => {
    const hrefs = collectHrefs(sampleTree);
    expect(hrefs.has("/blog/study/react")).toBe(true);
    expect(hrefs.has("/blog/intro")).toBe(true);
  });

  it("skips files without frontmatter", () => {
    const nodes: ContentNode[] = [
      { name: "raw.txt", type: "file", path: "/raw.txt", extension: "txt" },
    ];
    expect(collectHrefs(nodes).size).toBe(0);
  });

  it("returns empty set for empty input", () => {
    expect(collectHrefs([]).size).toBe(0);
  });
});

describe("getSubTree", () => {
  it("returns full tree for '/'", () => {
    expect(getSubTree(sampleTree, "/")).toBe(sampleTree);
  });

  it("returns full tree for empty string", () => {
    expect(getSubTree(sampleTree, "")).toBe(sampleTree);
  });

  it("returns children of a folder path", () => {
    const sub = getSubTree(sampleTree, "/study");
    expect(sub).toHaveLength(1);
    expect(sub[0]!.name).toBe("react.mdx");
  });

  it("returns empty for non-existent path", () => {
    expect(getSubTree(sampleTree, "/nope")).toEqual([]);
  });
});

describe("buildDescriptionMap", () => {
  it("maps href to description", () => {
    const map = buildDescriptionMap(sampleTree);
    expect(map.get("/blog/study/react")).toBe("Learn React");
    expect(map.get("/blog/intro")).toBe("Introduction");
  });

  it("returns empty map for empty input", () => {
    expect(buildDescriptionMap([]).size).toBe(0);
  });
});
