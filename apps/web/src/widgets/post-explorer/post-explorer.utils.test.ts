import { describe, it, expect } from "vitest";
import { getItemsForPath, toExplorerItems } from "./post-explorer.utils";
import type { ContentNode } from "@app/utils";

const tree: ContentNode[] = [
  {
    name: "study",
    type: "folder",
    path: "/study",
    itemCount: 2,
    children: [
      {
        name: "react",
        type: "file",
        path: "/study/react",
        extension: "post",
        frontmatter: {
          title: "React Guide",
          date: "2024-01-01",
          tags: ["react"],
          description: "Learn React",
        },
      },
      {
        name: "vue",
        type: "file",
        path: "/study/vue",
        extension: "post",
        frontmatter: {
          title: "Vue Guide",
          date: "2024-02-01",
          tags: ["vue"],
          description: "Learn Vue",
        },
      },
    ],
  },
  {
    name: "intro",
    type: "file",
    path: "/intro",
    extension: "post",
    frontmatter: {
      title: "Intro",
      date: "2024-03-01",
      tags: [],
      description: "Introduction",
    },
  },
];

describe("getItemsForPath", () => {
  it("returns root items for '/'", () => {
    expect(getItemsForPath(tree, "/")).toBe(tree);
  });

  it("returns root items for empty string", () => {
    expect(getItemsForPath(tree, "")).toBe(tree);
  });

  it("returns children of a folder", () => {
    const items = getItemsForPath(tree, "/study");
    expect(items).toHaveLength(2);
    expect(items[0]!.name).toBe("react");
  });

  it("returns empty for non-existent path", () => {
    expect(getItemsForPath(tree, "/nope")).toEqual([]);
  });
});

describe("toExplorerItems", () => {
  it("converts folders correctly", () => {
    const items = toExplorerItems(tree, new Set());
    expect(items[0]).toEqual({
      type: "folder",
      name: "study",
      itemCount: 2,
    });
  });

  it("converts files with frontmatter title", () => {
    const items = toExplorerItems(tree, new Set());
    const file = items[1]!;
    expect(file).toMatchObject({
      type: "file",
      name: "Intro",
      extension: "post",
      href: "/blog/intro",
    });
  });

  it("marks visited files", () => {
    const visited = new Set(["/blog/intro"]);
    const items = toExplorerItems(tree, visited);
    const file = items[1] as { visited: boolean };
    expect(file.visited).toBe(true);
  });

  it("marks unvisited files", () => {
    const items = toExplorerItems(tree, new Set());
    const file = items[1] as { visited: boolean };
    expect(file.visited).toBe(false);
  });

  it("uses node name when frontmatter is missing", () => {
    const nodes: ContentNode[] = [
      { name: "raw", type: "file", path: "/raw", extension: "post" },
    ];
    const items = toExplorerItems(nodes, new Set());
    expect(items[0]!.name).toBe("raw");
  });
});
