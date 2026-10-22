// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { generateNativeTtsArtifacts } from "../../../scripts/generate-tts-artifacts";

const roots: string[] = [];
function temporaryDirectory(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "native-tts-test-"));
  roots.push(root);
  return root;
}

function article(slug = "native/post") {
  return {
    slug,
    title: "Native post",
    status: "PUBLISHED",
    body: {
      document: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Heading" }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", text: "Native body." }],
          },
        ],
      },
    },
  };
}

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe("native DOCUMENT TTS generator", () => {
  it("generates deterministic manifests and transcripts without network access", () => {
    const root = temporaryDirectory();
    const inputPath = path.join(root, "articles.json");
    const outputDir = path.join(root, "output");
    fs.writeFileSync(inputPath, JSON.stringify([article()]));

    const entries = generateNativeTtsArtifacts({
      inputPath,
      outputDir,
      generatedAt: "2026-10-22T00:00:00.000Z",
    });

    expect(entries).toMatchObject([{ slug: "native/post", artifactCount: 3 }]);
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(outputDir, "native/post/manifest.json"),
        "utf8",
      ),
    ) as { generatedAt: string; artifacts: Array<{ text: string }> };
    expect(manifest.generatedAt).toBe("2026-10-22T00:00:00.000Z");
    expect(manifest.artifacts.map((item) => item.text)).toEqual([
      "Heading Native body.",
      "Heading Native body.",
      "Native body.",
    ]);
  });

  it("validates the complete input before touching existing artifacts", () => {
    const root = temporaryDirectory();
    const inputPath = path.join(root, "articles.json");
    const outputDir = path.join(root, "output");
    fs.mkdirSync(outputDir);
    const sentinel = path.join(outputDir, "existing.json");
    fs.writeFileSync(sentinel, "preserve me");
    fs.writeFileSync(
      inputPath,
      JSON.stringify([article("safe/post"), article("../escape")]),
    );

    expect(() => generateNativeTtsArtifacts({ inputPath, outputDir })).toThrow(
      "unsafe artifact path",
    );
    expect(fs.readFileSync(sentinel, "utf8")).toBe("preserve me");
    expect(fs.readdirSync(outputDir)).toEqual(["existing.json"]);
  });
});
