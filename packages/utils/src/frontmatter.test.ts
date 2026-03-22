import { describe, it, expect } from "vitest";
import { parseFrontmatter } from "./frontmatter";

describe("parseFrontmatter", () => {
  it("returns empty data and original content when no frontmatter", () => {
    const raw = "Hello World";
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({});
    expect(result.content).toBe("Hello World");
  });

  it("returns empty data when opening --- exists but closing --- is missing", () => {
    const raw = "---\ntitle: Test\nNo closing fence";
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({});
    expect(result.content).toBe(raw);
  });

  it("parses simple key-value pairs", () => {
    const raw = `---
title: My Post
date: 2024-01-01
---
Content here`;
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({ title: "My Post", date: "2024-01-01" });
    expect(result.content).toBe("Content here");
  });

  it("parses double-quoted values", () => {
    const raw = `---
title: "Hello World"
---
Content`;
    const result = parseFrontmatter(raw);
    expect(result.data.title).toBe("Hello World");
  });

  it("parses single-quoted values", () => {
    const raw = `---
title: 'Hello World'
---
Content`;
    const result = parseFrontmatter(raw);
    expect(result.data.title).toBe("Hello World");
  });

  it("parses array values with - items", () => {
    const raw = `---
tags:
  - react
  - typescript
---
Content`;
    const result = parseFrontmatter(raw);
    expect(result.data.tags).toEqual(["react", "typescript"]);
  });

  it("parses quoted array items", () => {
    const raw = `---
tags:
  - "react"
  - 'typescript'
---
Content`;
    const result = parseFrontmatter(raw);
    expect(result.data.tags).toEqual(["react", "typescript"]);
  });

  it("handles empty array (key with no items)", () => {
    const raw = `---
tags:
title: Next
---
Content`;
    const result = parseFrontmatter(raw);
    expect(result.data.tags).toEqual([]);
    expect(result.data.title).toBe("Next");
  });

  it("skips comment lines", () => {
    const raw = `---
# This is a comment
title: Test
---
Content`;
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({ title: "Test" });
  });

  it("skips empty lines in yaml block", () => {
    const raw = `---
title: Test

date: 2024-01-01
---
Content`;
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({ title: "Test", date: "2024-01-01" });
  });

  it("skips lines without colon", () => {
    const raw = `---
title: Test
invalid line
---
Content`;
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({ title: "Test" });
  });

  it("handles leading whitespace before frontmatter", () => {
    const raw = `  ---
title: Test
---
Content`;
    const result = parseFrontmatter(raw);
    expect(result.data).toEqual({ title: "Test" });
    expect(result.content).toBe("Content");
  });

  it("strips leading newline from content after closing fence", () => {
    const raw = `---
title: Test
---
Content`;
    const result = parseFrontmatter(raw);
    expect(result.content).toBe("Content");
    expect(result.content.startsWith("\n")).toBe(false);
  });

  it("resets currentArrayKey when a new key-value pair is found", () => {
    const raw = `---
tags:
  - react
  - vue
author: John
---
Content`;
    const result = parseFrontmatter(raw);
    expect(result.data.tags).toEqual(["react", "vue"]);
    expect(result.data.author).toBe("John");
  });
});
