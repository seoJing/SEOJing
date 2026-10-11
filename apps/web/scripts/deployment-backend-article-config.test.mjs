import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = path.resolve(appDir, "../..");

test("deployment uses D1 public articles without the old MDX slug switch", () => {
  const wranglerConfig = fs.readFileSync(
    path.join(appDir, "wrangler.jsonc"),
    "utf8",
  );
  const workflow = fs.readFileSync(
    path.join(repoDir, ".github/workflows/ci.yml"),
    "utf8",
  );
  assert.match(wranglerConfig, /"binding": "ANALYTICS_DB"/);
  assert.doesNotMatch(wranglerConfig, /SEOJING_BACKEND_ARTICLE_SLUGS/);
  assert.doesNotMatch(
    workflow,
    /test:content-fallback|SEOJING_BACKEND_ARTICLE_SLUGS/,
  );
  assert.match(workflow, /public:readback/);
});
