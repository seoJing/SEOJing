import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  normalizeBlocks,
  preserveMdxLineEndings,
  splitMdxFrontmatter,
  splitMdxSections,
  toBackendBlocks,
} from "./ops-article-editor.utils";

describe("MDX visual editing source boundary", () => {
  it("keeps the real fs article's frontmatter bytes out of the body editor", () => {
    const source = readFileSync(
      join(process.cwd(), "content/SEOJing/devLog/insight/nodejs-basics.mdx"),
      "utf8",
    );
    const { prefix, body } = splitMdxFrontmatter(source);
    expect(prefix + body).toBe(source);
    expect(prefix).toContain('title: "결국 Node.js 까지 와버렸다"');
    expect(body).toContain("<Subtitle level={2}>fs 모듈</Subtitle>");
    expect(body).not.toContain('title: "결국 Node.js 까지 와버렸다"');
  });

  it("keeps CRLF frontmatter and source separate", () => {
    const source =
      "---\r\ntitle: Test\r\n---\r\n\r\n<Paragraph>body</Paragraph>";
    expect(splitMdxFrontmatter(source)).toEqual({
      prefix: "---\r\ntitle: Test\r\n---\r\n",
      body: "\r\n<Paragraph>body</Paragraph>",
    });
  });
});

describe("splitMdxSections", () => {
  it("preserves the complete source while separating headings outside frontmatter and code", () => {
    const source =
      '---\r\ntitle: "Test"\r\n---\r\n\r\nIntro\r\n\r\n## First\r\n```ts\r\n# not a heading\r\n```\r\n\r\n## Second\r\nBody\r\n';
    const sections = splitMdxSections(source);

    expect(sections.map((section) => section.label)).toEqual([
      "도입·문서 설정",
      "First",
      "Second",
    ]);
    expect(sections.map((section) => section.source).join("")).toBe(source);
  });

  it("does not split tab-indented headings or headings inside an unclosed fence", () => {
    const source =
      "Intro\n\t# code heading\n~~~ts\n~~~note\n# still code\n~~~\n## Real heading\nBody\n";
    const sections = splitMdxSections(source);

    expect(sections.map((section) => section.label)).toEqual([
      "도입·문서 설정",
      "Real heading",
    ]);
    expect(sections.map((section) => section.source).join("")).toBe(source);
  });

  it("preserves CRLF when a section is edited through an LF-normalizing textarea", () => {
    const source = "Intro\r\n## First\r\nBefore\r\n## Second\r\nAfter\r\n";
    const sections = splitMdxSections(source);
    const edited = preserveMdxLineEndings(
      sections[1]!.source.replace("Before", "Changed").replace(/\r\n/g, "\n"),
      sections[1]!.source,
      source,
    );
    const saved = [sections[0]!.source, edited, sections[2]!.source].join("");

    expect(saved).toBe(
      "Intro\r\n## First\r\nChanged\r\n## Second\r\nAfter\r\n",
    );
    expect(saved).not.toMatch(/(?<!\r)\n/);
  });
});

describe("toBackendBlocks", () => {
  it("converts the editor IMAGE src field to the backend url field", () => {
    const [block] = toBackendBlocks([
      {
        id: "diagram",
        type: "IMAGE",
        sortOrder: 2,
        content: {
          src: "https://cdn.example.com/diagram.png",
          alt: "Architecture diagram",
          caption: "Request flow",
        },
      },
    ]);

    expect(block).toEqual({
      id: "diagram",
      type: "IMAGE",
      sortOrder: 2,
      content: {
        url: "https://cdn.example.com/diagram.png",
        alt: "Architecture diagram",
        caption: "Request flow",
      },
    });
    expect(block?.content).not.toHaveProperty("src");
  });

  it("unwraps the editor QUIZ item into the backend question, choices, and answer shape", () => {
    const [block] = toBackendBlocks([
      {
        id: "check-understanding",
        type: "QUIZ",
        content: {
          items: [
            {
              question: "Which field does the API persist for an image?",
              choices: ["src", "url", "href"],
              answer: "url",
            },
          ],
        },
      },
    ]);

    expect(block).toEqual({
      id: "check-understanding",
      type: "QUIZ",
      content: {
        question: "Which field does the API persist for an image?",
        choices: ["src", "url", "href"],
        answer: "url",
      },
    });
    expect(block?.content).not.toHaveProperty("items");
  });

  it("normalizes a persisted nested quiz props item into the renderer-compatible direct shape", () => {
    const [block] = toBackendBlocks([
      {
        type: "QUIZ",
        content: {
          items: [
            {
              props: {
                question: "Which fallback wins when MDX exists?",
                choices: ["CMS", "MDX"],
                answer: "MDX",
                explanation:
                  "Legacy MDX remains authoritative during migration.",
              },
            },
          ],
        },
      },
    ]);

    expect(block?.content).toEqual({
      question: "Which fallback wins when MDX exists?",
      choices: ["CMS", "MDX"],
      answer: "MDX",
      explanation: "Legacy MDX remains authoritative during migration.",
    });
  });

  it("preserves direct quiz edits when stale items are also present", () => {
    const [block] = toBackendBlocks([
      {
        type: "QUIZ",
        content: {
          question: "Edited question",
          choices: ["Edited choice"],
          answer: "Edited answer",
          items: [
            {
              question: "Stale question",
              choices: ["Stale choice"],
              answer: "Stale answer",
            },
          ],
        },
      },
    ]);

    expect(block?.content).toEqual({
      question: "Edited question",
      choices: ["Edited choice"],
      answer: "Edited answer",
    });
  });

  it("keeps untouched legacy quiz fields when one direct field is edited", () => {
    const [block] = normalizeBlocks([
      {
        type: "QUIZ",
        content: {
          question: "Edited question",
          items: [
            {
              props: {
                question: "Stale question",
                choices: ["Persisted choice"],
                answer: "Persisted answer",
                explanation: "Persisted explanation",
              },
            },
          ],
        },
      },
    ]);

    expect(block?.content).toEqual({
      question: "Edited question",
      choices: ["Persisted choice"],
      answer: "Persisted answer",
      explanation: "Persisted explanation",
    });
  });
});
