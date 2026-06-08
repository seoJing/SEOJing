import { describe, expect, it } from "vitest";
import {
  buildPresentationExportManifest,
  extractPresentationScenes,
} from "./presentation-export";

describe("extractPresentationScenes", () => {
  it("groups markdown content into H1/H2/H3 presentation scenes", () => {
    const scenes = extractPresentationScenes(
      `# 발표 제목\n\n도입 문장입니다.\n\n## 첫 장면\n\n- 핵심 하나\n- 핵심 둘\n\n### 코드 보기\n\n\`\`\`ts\nconst answer = 42;\n\`\`\``,
      "Fallback title",
    );

    expect(scenes).toMatchObject([
      { title: "발표 제목", kind: "title", level: 1 },
      { title: "첫 장면", kind: "section", level: 2 },
      { title: "코드 보기", kind: "section", level: 3 },
    ]);
  });

  it("creates a title scene from preface-only content", () => {
    const scenes = extractPresentationScenes(
      "프론트매터 제거 후 제목이 없는 짧은 글입니다.",
      "문서 제목",
    );

    expect(scenes).toHaveLength(1);
    expect(scenes[0]).toMatchObject({
      title: "문서 제목",
      kind: "title",
      headingId: null,
    });
  });

  it("does not split scenes on headings inside fenced code blocks", () => {
    const scenes = extractPresentationScenes(
      `# 실제 제목\n\n\`\`\`md\n## 코드 안 제목\n본문\n\`\`\`\n\n## 다음 장면\n\n설명`,
      "Fallback title",
    );

    expect(scenes.map((scene) => scene.title)).toEqual([
      "실제 제목",
      "다음 장면",
    ]);
  });

  it("keeps longer and tilde fenced headings inside the current scene", () => {
    const scenes = extractPresentationScenes(
      `## 실제 섹션\n\n~~~~md\n## 코드 안 제목\n\`\`\`\n### 여전히 코드\n~~~~\n\n내용`,
      "Fallback title",
    );

    expect(scenes.map((scene) => scene.title)).toEqual(["실제 섹션"]);
  });

  it("keeps H2 section ids aligned with TTS even when H1 has the same title", () => {
    const scenes = extractPresentationScenes(
      `# 개요\n\n도입\n\n## 개요\n\n본문`,
      "Fallback title",
    );

    expect(scenes[1]?.headingId).toBe("개요");
  });
});

describe("buildPresentationExportManifest", () => {
  it("builds a PPTX-oriented manifest with TTS bridge paths", () => {
    const manifest = buildPresentationExportManifest({
      slug: "study/backend/day1",
      title: "백엔드 스터디 Day 1",
      generatedAt: "2026-06-08T00:00:00.000Z",
      source: `# 백엔드 스터디 Day 1\n\n브라우저에서 서버로 요청이 이동합니다.\n\n## 요청 흐름\n\n- 브라우저가 URL을 요청합니다.\n- 서버가 응답을 만듭니다.\n\n## 코드로 보는 흐름\n\n\`\`\`ts\nfetch('/api/posts')\n\`\`\``,
    });

    expect(manifest).toMatchObject({
      version: 1,
      slug: "study/backend/day1",
      exportStrategy: "pptxgenjs-spike",
      ttsCacheKey: "tts:v1:study/backend/day1",
      pptx: {
        supported: true,
        slideCount: 3,
        fileName: "study__backend__day1.pptx",
      },
    });
    expect(manifest.scenes[0]).toMatchObject({
      kind: "title",
      tts: {
        kind: "summary-2m",
        transcriptPath: "/tts-artifacts/study/backend/day1/summary-2m.txt",
      },
    });
    expect(manifest.scenes[1]).toMatchObject({
      title: "요청 흐름",
      bullets: ["브라우저가 URL을 요청합니다.", "서버가 응답을 만듭니다."],
      pptx: { layoutHint: "bullets" },
      tts: {
        kind: "section",
        sectionId: "요청-흐름",
        transcriptPath: "/tts-artifacts/study/backend/day1/section-001.txt",
      },
    });
    expect(manifest.scenes[2]).toMatchObject({
      title: "코드로 보는 흐름",
      pptx: { layoutHint: "code" },
      tts: null,
    });
  });
});
