import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectArticleApi,
  inspectPublicHtml,
} from "./check-public-blog-readback.mjs";

const bundledArticle = {
  mode: "bundled-mdx",
  public: { expectedText: [], forbiddenText: [] },
};

const migratedArticle = {
  mode: "backend-migrated",
  api: {
    requiredStatus: "PUBLISHED",
    minimumBlockCount: 3,
    requiredBlockTypes: ["CODE", "IMAGE", "QUIZ"],
    requiredQuizItems: 1,
  },
  public: {
    expectedText: ["article title"],
    requiredHtmlPatterns: [
      {
        label: "rendered code block",
        scope: "article-content",
        pattern: "<[^>]+data-code-block",
      },
      {
        label: "rendered article-body image",
        scope: "article-content",
        pattern:
          '<img(?=[^>]*src="[^"]*article-image\\.svg")(?=[^>]*alt="article image")[^>]*>',
      },
      {
        label: "rendered interactive quiz",
        scope: "article-content",
        pattern: "<[^>]+data-article-quiz",
      },
    ],
    forbiddenText: ["ArticleQuiz fallback", "RAW_MDX", "```"],
  },
};

const validPayload = {
  status: "PUBLISHED",
  body: {
    blocks: [
      {
        type: "CODE",
        content: { code: "const ok = true", language: "ts" },
      },
      {
        type: "IMAGE",
        content: { url: "article-image.svg", altText: "article image" },
      },
      {
        type: "QUIZ",
        content: {
          items: [
            {
              props: {
                question: "Why?",
                answer: "0",
                explanation: "Because.",
                mode: "multiple",
                choices: '["Yes", "No"]',
              },
            },
          ],
        },
      },
    ],
  },
};

test("accepts API 404 only for a declared bundled-MDX article", () => {
  assert.deepEqual(inspectArticleApi(bundledArticle, 404), {
    ok: true,
    details: [],
  });
  assert.equal(inspectArticleApi(bundledArticle, 200, {}).ok, false);
  assert.equal(inspectArticleApi(migratedArticle, 404).ok, false);
});

test("requires published API block parity for a backend-migrated article", () => {
  assert.deepEqual(inspectArticleApi(migratedArticle, 200, validPayload), {
    ok: true,
    details: [],
  });

  const malformed = {
    ...validPayload,
    status: "DRAFT",
    body: {
      blocks: validPayload.body.blocks.map((block) => ({
        ...block,
        content:
          block.type === "QUIZ"
            ? { ...block.content, items: [] }
            : block.content,
      })),
    },
  };
  malformed.body.blocks.push({
    type: "RAW_MDX",
    content: { rawMdx: "<ArticleQuizItem />" },
  });
  const inspection = inspectArticleApi(migratedArticle, 200, malformed);
  assert.equal(inspection.ok, false);
  assert.match(inspection.details.join("\n"), /DRAFT/);
  assert.match(inspection.details.join("\n"), /structured item/);
  assert.match(inspection.details.join("\n"), /orphan ArticleQuizItem/);
});

test("rejects malformed block payloads that would not render", () => {
  const malformed = JSON.parse(JSON.stringify(validPayload));
  malformed.body.blocks[0].content = { code: "", language: "" };
  malformed.body.blocks[1].content = { url: "", altText: "" };
  malformed.body.blocks[2].content.items = [{ props: {} }];

  const inspection = inspectArticleApi(migratedArticle, 200, malformed);
  assert.equal(inspection.ok, false);
  assert.match(
    inspection.details.join("\n"),
    /CODE block is missing code text/,
  );
  assert.match(inspection.details.join("\n"), /IMAGE block is missing url/);
  assert.match(
    inspection.details.join("\n"),
    /QUIZ item is missing question text/,
  );
});

test("rejects empty or out-of-range multiple-choice answers", () => {
  const emptyAnswer = JSON.parse(JSON.stringify(validPayload));
  emptyAnswer.body.blocks[2].content.items[0].props.answer = "";
  emptyAnswer.body.blocks[2].content.items[0].props.choices = [];
  const emptyInspection = inspectArticleApi(migratedArticle, 200, emptyAnswer);
  assert.equal(emptyInspection.ok, false);
  assert.match(emptyInspection.details.join("\n"), /missing answer/);
  assert.match(emptyInspection.details.join("\n"), /missing choices/);

  const outOfRangeAnswer = JSON.parse(JSON.stringify(validPayload));
  outOfRangeAnswer.body.blocks[2].content.items[0].props.answer = "9";
  const rangeInspection = inspectArticleApi(
    migratedArticle,
    200,
    outOfRangeAnswer,
  );
  assert.equal(rangeInspection.ok, false);
  assert.match(rangeInspection.details.join("\n"), /outside choices/);
});

test("rejects public fallback/raw Markdown and missing code/quiz/image signals", () => {
  const passingHtml =
    '<article>article title<div data-article-content="true"><pre data-code-block="true">const ok = true</pre><img alt="article image" src="article-image.svg" /><section data-article-quiz="true">quiz</section></div></article>';
  assert.deepEqual(inspectPublicHtml(migratedArticle, passingHtml), {
    ok: true,
    missing: [],
    presentForbidden: [],
  });

  const scriptOnlyQuiz = inspectPublicHtml(
    migratedArticle,
    '<script>register("ArticleQuiz")</script><article>article title<div data-article-content="true"><pre data-code-block="true"></pre><img alt="article image" src="article-image.svg" /></div></article>',
  );
  assert.equal(scriptOnlyQuiz.ok, false);
  assert.match(scriptOnlyQuiz.missing.join("\n"), /rendered interactive quiz/);

  const imageOutsideArticle = inspectPublicHtml(
    migratedArticle,
    '<article>article title<div data-article-content="true"><pre data-code-block="true"></pre><section data-article-quiz="true">quiz</section></div></article><img alt="article image" src="article-image.svg" />',
  );
  assert.equal(imageOutsideArticle.ok, false);
  assert.match(
    imageOutsideArticle.missing.join("\n"),
    /rendered article-body image/,
  );

  const inspection = inspectPublicHtml(
    migratedArticle,
    "article title ArticleQuiz fallback ```",
  );
  assert.equal(inspection.ok, false);
  assert.match(inspection.missing.join("\n"), /rendered code block/);
  assert.match(inspection.missing.join("\n"), /rendered article-body image/);
  assert.match(inspection.missing.join("\n"), /rendered interactive quiz/);
  assert.deepEqual(inspection.presentForbidden, [
    "ArticleQuiz fallback",
    "```",
  ]);
});
