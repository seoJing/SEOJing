import { describe, it, expect } from "vitest";
import { flattenFiles, toPostHref } from "./blog-search.utils";
import type { ContentNode } from "@app/utils";

describe("flattenFiles", () => {
  it("extracts file nodes with frontmatter", () => {
    const nodes: ContentNode[] = [
      {
        name: "react.mdx",
        type: "file",
        path: "/react.mdx",
        extension: "mdx",
        frontmatter: {
          title: "React",
          description: "React guide",
          date: "2024-01-01",
          tags: ["react"],
        },
      },
    ];
    const results = flattenFiles(nodes);
    expect(results).toEqual([
      {
        title: "React",
        description: "React guide",
        path: "/react.mdx",
        tags: ["react"],
      },
    ]);
  });

  it("skips file nodes without frontmatter", () => {
    const nodes: ContentNode[] = [
      {
        name: "readme.txt",
        type: "file",
        path: "/readme.txt",
        extension: "txt",
      },
    ];
    expect(flattenFiles(nodes)).toEqual([]);
  });

  it("recursively flattens folder children", () => {
    const nodes: ContentNode[] = [
      {
        name: "study",
        type: "folder",
        path: "/study",
        children: [
          {
            name: "hooks.mdx",
            type: "file",
            path: "/study/hooks.mdx",
            extension: "mdx",
            frontmatter: {
              title: "Hooks",
              description: "React Hooks",
              date: "2024-02-01",
              tags: ["hooks"],
            },
          },
        ],
      },
    ];
    const results = flattenFiles(nodes);
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("Hooks");
  });

  it("returns empty array for empty input", () => {
    expect(flattenFiles([])).toEqual([]);
  });
});

describe("toPostHref", () => {
  it("converts .mdx path to blog URL", () => {
    expect(toPostHref("/study/react.mdx")).toBe("/blog/study/react");
  });

  it("converts .md path to blog URL", () => {
    expect(toPostHref("/intro.md")).toBe("/blog/intro");
  });

  it("handles path without extension gracefully", () => {
    expect(toPostHref("/no-ext")).toBe("/blog/no-ext");
  });
});
