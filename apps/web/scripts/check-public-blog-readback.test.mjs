import assert from "node:assert/strict";
/* global Response */
import test from "node:test";
import {
  inspectPublicHtml,
  inspectPublicIndex,
  readArgs,
  runAttempt,
} from "./check-public-blog-readback.mjs";

const slugs = [
  "study/clab-26-1/week1",
  "study/javascript-quizbook/day10",
  "study/effective-typescript/day5",
];
const index = {
  articles: [
    {
      type: "folder",
      name: "study",
      children: slugs.map((slug) => ({ type: "file", path: `/${slug}` })),
    },
  ],
};

test("rejects an incomplete, duplicate, or MDX-named D1 public index", () => {
  assert.equal(inspectPublicIndex(index, 3).ok, true);
  assert.equal(inspectPublicIndex(index, 201).ok, false);
  assert.equal(inspectPublicIndex({ articles: [] }, 1).ok, false);
  assert.equal(
    inspectPublicIndex({ articles: [{ type: "file", path: "/post.mdx" }] }, 1)
      .ok,
    false,
  );
  assert.equal(
    inspectPublicIndex(
      {
        articles: [
          ...index.articles[0].children,
          ...index.articles[0].children,
        ],
      },
      1,
    ).duplicateCount,
    3,
  );
});

test("requires the document renderer and representative content signals", () => {
  const sentinel = {
    signals: ["data-backend-article-document", "data-article-quiz"],
  };
  assert.deepEqual(
    inspectPublicHtml(
      "<div data-article-content><div data-backend-article-document><section data-article-quiz></section></div></div>",
      sentinel,
    ),
    {
      ok: true,
      missing: [],
      forbidden: [],
    },
  );
  const result = inspectPublicHtml(
    "<div data-article-content><div data-backend-article-html>ArticleQuiz fallback</div></div>",
    sentinel,
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, sentinel.signals);
  assert.deepEqual(result.forbidden, ["ArticleQuiz fallback"]);
  assert.equal(
    inspectPublicHtml(
      "<script>data-backend-article-document data-article-quiz</script><div data-article-content>empty</div>",
      sentinel,
    ).ok,
    false,
  );
});

test("reads a D1-backed index and three public pages without requiring backend publication", async (t) => {
  const fetched = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    fetched.push(String(url));
    if (String(url).endsWith("/api/public/articles/index"))
      return Response.json(index);
    return new Response(
      "<h1>프론트엔드 스터디 1주차</h1><div data-article-content><div data-backend-article-document>data-article-quiz data-code-block inference-api-design.svg</div></div>",
    );
  });
  const args = readArgs(
    ["--origin", "https://example.com", "--minimum-articles", "3"],
    {},
  );
  const result = await runAttempt(args);
  assert.equal(result.ok, true);
  assert.equal(result.index.count, 3);
  assert.equal(fetched.length, 4);
  assert.ok(fetched.every((url) => url.startsWith("https://example.com/")));
});
