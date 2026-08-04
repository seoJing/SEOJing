import { describe, expect, it } from "vitest";

import { normalizeBlocks, toBackendBlocks } from "./ops-article-editor.utils";

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
