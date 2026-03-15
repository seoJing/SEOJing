import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCommentedPosts, markAsCommented } from "./comment-tracker";

const STORAGE_KEY = "seojing-commented-posts";

describe("comment-tracker", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCommentedPosts", () => {
    it("returns empty set when no data stored", () => {
      const posts = getCommentedPosts();
      expect(posts.size).toBe(0);
    });

    it("returns stored post hrefs as a Set", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(["/blog/react", "/blog/hooks"]),
      );
      const posts = getCommentedPosts();
      expect(posts.size).toBe(2);
      expect(posts.has("/blog/react")).toBe(true);
      expect(posts.has("/blog/hooks")).toBe(true);
    });

    it("returns empty set on invalid JSON", () => {
      localStorage.setItem(STORAGE_KEY, "not-json");
      const posts = getCommentedPosts();
      expect(posts.size).toBe(0);
    });

    it("returns empty set when localStorage throws", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("Storage error");
      });
      const posts = getCommentedPosts();
      expect(posts.size).toBe(0);
    });
  });

  describe("markAsCommented", () => {
    it("adds a new post href to storage", () => {
      markAsCommented("/blog/react");
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toContain("/blog/react");
    });

    it("preserves existing entries", () => {
      markAsCommented("/blog/react");
      markAsCommented("/blog/hooks");
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toContain("/blog/react");
      expect(stored).toContain("/blog/hooks");
    });

    it("does not duplicate entries", () => {
      markAsCommented("/blog/react");
      markAsCommented("/blog/react");
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as string[];
      expect(stored.filter((h) => h === "/blog/react")).toHaveLength(1);
    });

    it("silently ignores localStorage errors", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceeded");
      });
      expect(() => markAsCommented("/blog/react")).not.toThrow();
    });
  });
});
