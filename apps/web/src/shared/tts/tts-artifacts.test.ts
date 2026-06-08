import { describe, expect, it } from "vitest";
import {
  buildTtsArticleManifest,
  extractTtsSections,
  normalizeText,
  stripMdx,
} from "./tts-artifacts";

describe("TTS artifact manifest", () => {
  it("builds 2-minute, 5-minute, and section artifacts tied to canonical slug", () => {
    const manifest = buildTtsArticleManifest({
      slug: "study/backend/day1",
      title: "백엔드 스터디 Day 1",
      source: `# 백엔드 스터디 Day 1

첫 문단입니다. [링크](https://example.com)를 포함합니다.

## 요청 흐름

브라우저가 서버에 요청하고 서버가 응답합니다.

## 파일 역할

컨트롤러와 서비스가 나뉩니다.
`,
      generatedAt: "2026-06-08T00:00:00.000Z",
    });

    expect(manifest.slug).toBe("study/backend/day1");
    expect(manifest.canonicalUrl).toBe(
      "https://seojing.com/blog/study/backend/day1",
    );
    expect(manifest.cacheKey).toBe("tts:v1:study/backend/day1");
    expect(manifest.sections.map((section) => section.id)).toEqual([
      "요청-흐름",
      "파일-역할",
    ]);
    expect(manifest.artifacts.map((artifact) => artifact.kind)).toEqual([
      "summary-2m",
      "core-5m",
      "section",
      "section",
    ]);
    expect(manifest.artifacts[0]).toMatchObject({
      id: "study__backend__day1__summary-2m",
      chunkId: "summary-2m",
      targetDurationSeconds: 120,
      audioPath: "/tts-artifacts/study/backend/day1/summary-2m.mp3",
      status: "pending",
    });
    expect(manifest.artifacts[2]).toMatchObject({
      sectionId: "요청-흐름",
      chunkId: "요청-흐름",
      transcriptPath: "/tts-artifacts/study/backend/day1/section-001.txt",
    });
  });

  it("deduplicates repeated heading ids", () => {
    const sections = extractTtsSections(`## 반복\n내용\n## 반복\n다른 내용`);
    expect(sections.map((section) => section.id)).toEqual(["반복", "반복-2"]);
  });

  it("does not create section artifacts from headings inside fenced code blocks", () => {
    const sections = extractTtsSections(
      `## 실제 섹션\n\n\`\`\`md\n## 코드 안 제목\n\`\`\`\n\n설명`,
    );
    expect(sections.map((section) => section.id)).toEqual(["실제-섹션"]);
  });

  it("respects markdown fence marker length and tilde fences", () => {
    const sections = extractTtsSections(
      `## 실제 섹션\n\n~~~~md\n## 코드 안 제목\n\`\`\`\n### 여전히 코드\n~~~~\n\n설명`,
    );
    expect(sections.map((section) => section.id)).toEqual(["실제-섹션"]);
  });

  it("strips MDX syntax before feeding text to TTS", () => {
    expect(
      normalizeText(
        stripMdx(
          "```ts\nconst x = 1\n```\n~~~md\n## 코드 안 제목\n~~~\n## 제목\n- [링크](https://example.com)와 `코드`",
        ),
      ),
    ).toContain("제목 링크와 코드");
  });
});
