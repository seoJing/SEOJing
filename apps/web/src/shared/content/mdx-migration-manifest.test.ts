import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import entries from "./mdx-migration-manifest.json";

const contentRoot = resolve(process.cwd(), "content");

function sourcePaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const path = resolve(directory, item.name);
    if (item.isDirectory()) return sourcePaths(path);
    return item.isFile() && item.name.endsWith(".mdx") ? [path] : [];
  });
}

describe("MDX migration review manifest", () => {
  it("covers every blog MDX file with the current source hash and exact-case slug", () => {
    const paths = sourcePaths(contentRoot)
      .map((path) => path.slice(contentRoot.length + 1).replaceAll("\\", "/"))
      .filter((path) => path !== "resume.mdx")
      .sort();
    expect(entries.map((entry) => entry.sourcePath).sort()).toEqual(paths);
    for (const entry of entries) {
      expect(entry.slug).toBe(
        entry.sourcePath.replace(/\.mdx$/, "").replace(/\/index$/, ""),
      );
      const source = readFileSync(resolve(contentRoot, entry.sourcePath));
      expect(createHash("sha256").update(source).digest("hex")).toBe(
        entry.sourceSha256,
      );
    }
  });
});
