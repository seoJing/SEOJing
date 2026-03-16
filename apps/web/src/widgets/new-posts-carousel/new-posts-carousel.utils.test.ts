import { describe, it, expect } from "vitest";
import { getSubTree, getRecentPosts } from "./new-posts-carousel.utils";
import type { ContentNode } from "@app/utils";

const tree: ContentNode[] = [
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
          date: "2024-03-01",
          tags: ["react"],
        },
      },
      {
        name: "vue.mdx",
        type: "file",
        path: "/study/vue.mdx",
        extension: "mdx",
        frontmatter: {
          title: "Vue",
          description: "Learn Vue",
          date: "2024-01-01",
          tags: ["vue"],
        },
      },
    ],
  },
  {
    name: "intro.mdx",
    type: "file",
    path: "/intro.mdx",
    extension: "mdx",
    frontmatter: {
      title: "Intro",
      description: "Introduction",
      date: "2024-02-01",
      tags: [],
    },
  },
];

describe("getSubTree", () => {
  it("returns full tree for root path", () => {
    expect(getSubTree(tree, "/")).toBe(tree);
  });

  it("returns folder children for valid path", () => {
    const sub = getSubTree(tree, "/study");
    expect(sub).toHaveLength(2);
  });

  it("returns empty for non-existent path", () => {
    expect(getSubTree(tree, "/nope")).toEqual([]);
  });
});

describe("getRecentPosts", () => {
  it("returns posts sorted by date descending", () => {
    const posts = getRecentPosts(tree);
    expect(posts[0]!.title).toBe("React"); // 2024-03-01
    expect(posts[1]!.title).toBe("Intro"); // 2024-02-01
    expect(posts[2]!.title).toBe("Vue"); // 2024-01-01
  });

  it("respects limit parameter", () => {
    const posts = getRecentPosts(tree, 2);
    expect(posts).toHaveLength(2);
  });

  it("generates correct href", () => {
    const posts = getRecentPosts(tree, 1);
    expect(posts[0]!.href).toBe("/blog/study/react");
  });

  it("recursively collects from nested folders", () => {
    const posts = getRecentPosts(tree);
    expect(posts).toHaveLength(3);
  });

  it("returns empty for tree with no files", () => {
    const emptyTree: ContentNode[] = [
      { name: "empty", type: "folder", path: "/empty", children: [] },
    ];
    expect(getRecentPosts(emptyTree)).toEqual([]);
  });
});
