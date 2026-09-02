import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = path.resolve(appDir, "../..");
const slug = "study/effective-typescript/day5";

test("deploy build and Worker vars opt in only Day 5", () => {
  const wranglerConfig = fs.readFileSync(
    path.join(appDir, "wrangler.jsonc"),
    "utf8",
  );
  const workerVars = JSON.parse(
    wranglerConfig.replace(/,\s*([}\]])/g, "$1"),
  ).vars;
  const workflow = fs.readFileSync(
    path.join(repoDir, ".github/workflows/ci.yml"),
    "utf8",
  );

  assert.equal(workerVars.SEOJING_BACKEND_ARTICLE_SLUGS, slug);
  assert.equal(workerVars.SEOJING_BACKEND_ARTICLE_PREFIXES, undefined);
  assert.equal(
    (
      workflow.match(
        /SEOJING_BACKEND_ARTICLE_SLUGS: study\/effective-typescript\/day5/g,
      ) ?? []
    ).length,
    2,
  );
  assert.doesNotMatch(workflow, /SEOJING_BACKEND_ARTICLE_PREFIXES/);
});
