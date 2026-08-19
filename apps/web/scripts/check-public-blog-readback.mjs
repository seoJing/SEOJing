#!/usr/bin/env node
/* global console, fetch, setTimeout, AbortSignal */
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  ARTICLE_MIGRATION_REGISTRY,
  publicArticleApiPath,
  publicArticlePath,
} from "./public-article-migration-registry.mjs";

const DEFAULT_ORIGIN = "https://seojing.com";
const DEFAULT_API_ORIGIN = "https://api.seojing.com";
const DEFAULT_RETRIES = 12;
const DEFAULT_DELAY_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export function readArgs(argv, env = process.env) {
  const args = {
    origin: env.PUBLIC_READBACK_ORIGIN || DEFAULT_ORIGIN,
    apiOrigin: env.PUBLIC_READBACK_API_ORIGIN || DEFAULT_API_ORIGIN,
    retries: readNumberEnv("PUBLIC_READBACK_RETRIES", DEFAULT_RETRIES, env),
    delayMs: readNumberEnv("PUBLIC_READBACK_DELAY_MS", DEFAULT_DELAY_MS, env),
    timeoutMs: readNumberEnv(
      "PUBLIC_READBACK_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
      env,
    ),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--origin") {
      args.origin = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--api-origin") {
      args.apiOrigin = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--retries") {
      args.retries = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }
    if (arg === "--delay-ms") {
      args.delayMs = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      args.timeoutMs = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  for (const [name, value] of [
    ["--origin", args.origin],
    ["--api-origin", args.apiOrigin],
  ]) {
    if (!/^https?:\/\//.test(value)) {
      throw new Error(`${name} must be an http(s) URL. Received: ${value}`);
    }
  }
  if (!Number.isInteger(args.retries) || args.retries < 1) {
    throw new Error(
      `--retries must be a positive integer. Received: ${args.retries}`,
    );
  }
  if (!Number.isInteger(args.delayMs) || args.delayMs < 0) {
    throw new Error(
      `--delay-ms must be a non-negative integer. Received: ${args.delayMs}`,
    );
  }
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1) {
    throw new Error(
      `--timeout-ms must be a positive integer. Received: ${args.timeoutMs}`,
    );
  }

  args.origin = args.origin.replace(/\/+$/, "");
  args.apiOrigin = args.apiOrigin.replace(/\/+$/, "");
  return args;
}

function readNumberEnv(name, fallback, env) {
  const raw = env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer. Received: ${raw}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/check-public-blog-readback.mjs [options]

Checks deployed SEOJing public article routes using the slug-level migration
registry. API 404 is accepted only for declared bundled-MDX slugs; migrated
slugs must return a published, renderable block projection and public DOM
signals for code, quiz, and image content.

Options:
  --origin <url>       Public origin to probe (default: ${DEFAULT_ORIGIN})
  --api-origin <url>   Public article API origin (default: ${DEFAULT_API_ORIGIN})
  --retries <n>        Attempts before failing (default: ${DEFAULT_RETRIES})
  --delay-ms <ms>      Delay between attempts (default: ${DEFAULT_DELAY_MS})
  --timeout-ms <ms>    Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})

Environment overrides:
  PUBLIC_READBACK_ORIGIN
  PUBLIC_READBACK_API_ORIGIN
  PUBLIC_READBACK_RETRIES
  PUBLIC_READBACK_DELAY_MS
  PUBLIC_READBACK_TIMEOUT_MS`);
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(origin, path) {
  return `${origin}${path}`;
}

async function fetchResponse(url, accept, timeoutMs) {
  return fetch(url, {
    headers: {
      Accept: accept,
      "Cache-Control": "no-cache",
      "User-Agent": "SEOJing-public-readback/2.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function fetchHtml(url, timeoutMs) {
  const response = await fetchResponse(url, "text/html", timeoutMs);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} for ${url}: ${body.slice(0, 200)}`,
    );
  }
  return body;
}

function extractElementByDataAttribute(html, attribute) {
  const startPattern = new RegExp(
    `<([a-z][\\w:-]*)\\b[^>]*\\b${attribute}(?:=|\\s|>)`,
    "i",
  );
  const startMatch = startPattern.exec(html);
  if (!startMatch) return "";

  const tag = startMatch[1];
  const tagPattern = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, "gi");
  tagPattern.lastIndex = startMatch.index;
  let depth = 0;
  let match;
  while ((match = tagPattern.exec(html))) {
    if (match[0].startsWith("</")) depth -= 1;
    else depth += 1;
    if (depth === 0) return html.slice(startMatch.index, tagPattern.lastIndex);
  }
  return "";
}

export function inspectPublicHtml(article, html) {
  const publicCheck = article.public;
  const requiredPatterns = publicCheck.requiredHtmlPatterns ?? [];
  const articleContentHtml = extractElementByDataAttribute(
    html,
    "data-article-content",
  );
  const missing = [
    ...publicCheck.expectedText.filter((text) => !html.includes(text)),
    ...requiredPatterns
      .filter((signal) => {
        const scope =
          signal.scope === "article-content" ? articleContentHtml : html;
        return !new RegExp(signal.pattern, "i").test(scope);
      })
      .map((signal) => `[HTML] ${signal.label}: ${signal.pattern}`),
  ];
  const presentForbidden = publicCheck.forbiddenText.filter((text) =>
    html.includes(text),
  );
  return {
    ok: missing.length === 0 && presentForbidden.length === 0,
    missing,
    presentForbidden,
  };
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function readStringArray(value) {
  if (Array.isArray(value)) return value.filter(hasText);
  if (!hasText(value)) return undefined;

  try {
    const parsed = JSON.parse(value.replace(/'/g, '"'));
    if (Array.isArray(parsed)) return parsed.filter(hasText);
  } catch {
    // Fall through to the simple literal parser used by the article renderer.
  }

  const items = value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
    .filter(hasText);
  return items.length ? items : undefined;
}

function readAnswer(value) {
  if (!hasText(value) && !Number.isInteger(value)) return undefined;
  const text = String(value).trim();
  return /^\d+$/.test(text) ? Number(text) : text;
}

function validateRenderableBlock(block, details) {
  const content = block?.content ?? {};
  if (block?.type === "CODE") {
    if (!hasText(content.code)) details.push("CODE block is missing code text");
    if (!hasText(content.language))
      details.push("CODE block is missing language");
  }
  if (block?.type === "IMAGE") {
    if (!hasText(content.url)) details.push("IMAGE block is missing url");
    if (!hasText(content.altText))
      details.push("IMAGE block is missing altText");
  }
}

export function inspectArticleApi(article, responseStatus, payload) {
  if (article.mode === "bundled-mdx") {
    return {
      ok: responseStatus === 404,
      details:
        responseStatus === 404
          ? []
          : [
              `expected API 404 for declared bundled-MDX slug, got ${responseStatus}`,
            ],
    };
  }

  const requirements = article.api;
  const details = [];
  if (responseStatus !== 200)
    details.push(`expected API 200, got ${responseStatus}`);
  if (!payload || typeof payload !== "object") {
    details.push("API response is not a JSON object");
    return { ok: false, details };
  }
  if (payload.status !== requirements.requiredStatus) {
    details.push(
      `expected API status ${requirements.requiredStatus}, got ${String(payload.status)}`,
    );
  }

  const blocks = payload.body?.blocks;
  if (!Array.isArray(blocks)) {
    details.push("body.blocks is missing or not an array");
    return { ok: false, details };
  }
  if (blocks.length < requirements.minimumBlockCount) {
    details.push(
      `expected at least ${requirements.minimumBlockCount} blocks, got ${blocks.length}`,
    );
  }

  for (const type of requirements.requiredBlockTypes) {
    const matchingBlocks = blocks.filter((block) => block?.type === type);
    if (!matchingBlocks.length) {
      details.push(`missing required ${type} block`);
      continue;
    }
    for (const block of matchingBlocks) validateRenderableBlock(block, details);
  }

  const quizzes = blocks.filter((block) => block?.type === "QUIZ");
  for (const quiz of quizzes) {
    if (
      !Array.isArray(quiz?.content?.items) ||
      quiz.content.items.length < requirements.requiredQuizItems
    ) {
      details.push(
        `QUIZ block is missing ${requirements.requiredQuizItems} structured item(s)`,
      );
      continue;
    }
    for (const item of quiz.content.items) {
      const props = item?.props;
      if (!props || typeof props !== "object") {
        details.push("QUIZ item is missing props");
        continue;
      }
      if (!hasText(props.question))
        details.push("QUIZ item is missing question text");
      const answer = readAnswer(props.answer);
      if (answer == null) details.push("QUIZ item is missing answer");
      if (!hasText(props.explanation))
        details.push("QUIZ item is missing explanation text");
      if (props.mode === "multiple") {
        const choices = readStringArray(props.choices);
        if (!choices || choices.length < 2) {
          details.push("multiple-choice QUIZ item is missing choices");
        } else if (
          Number.isInteger(answer) &&
          (answer < 0 || answer >= choices.length)
        ) {
          details.push("multiple-choice QUIZ answer is outside choices");
        }
      }
    }
  }
  const orphanQuizItems = blocks.filter(
    (block) =>
      block?.type === "RAW_MDX" &&
      String(block?.content?.rawMdx ?? block?.content?.text ?? "").includes(
        "ArticleQuizItem",
      ),
  );
  if (orphanQuizItems.length) {
    details.push(
      `found ${orphanQuizItems.length} orphan ArticleQuizItem RAW_MDX block(s)`,
    );
  }

  return { ok: details.length === 0, details };
}

async function inspectApi(article, args) {
  const url = buildUrl(args.apiOrigin, publicArticleApiPath(article.slug));
  const response = await fetchResponse(url, "application/json", args.timeoutMs);
  const rawBody = await response.text();
  let payload;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = undefined;
    }
  }
  return {
    url,
    status: response.status,
    ...inspectArticleApi(article, response.status, payload),
  };
}

async function runAttempt(args) {
  const results = [];
  for (const article of ARTICLE_MIGRATION_REGISTRY) {
    const publicUrl = buildUrl(args.origin, publicArticlePath(article.slug));
    const [html, api] = await Promise.all([
      fetchHtml(publicUrl, args.timeoutMs),
      inspectApi(article, args),
    ]);
    const publicInspection = inspectPublicHtml(article, html);
    results.push({
      article,
      publicUrl,
      htmlBytes: html.length,
      public: publicInspection,
      api,
      ok: publicInspection.ok && api.ok,
    });
  }
  return results;
}

function summarizeResults(results) {
  return results
    .map((result) => {
      const details = [`api=${result.api.status}`, `bytes=${result.htmlBytes}`];
      if (result.api.details.length)
        details.push(`apiDetails=${JSON.stringify(result.api.details)}`);
      if (result.public.missing.length)
        details.push(`missing=${JSON.stringify(result.public.missing)}`);
      if (result.public.presentForbidden.length) {
        details.push(
          `forbidden=${JSON.stringify(result.public.presentForbidden)}`,
        );
      }
      return `${result.ok ? "PASS" : "FAIL"} [${result.article.mode}] ${result.article.label} ${result.publicUrl} ${details.join(" ")}`;
    })
    .join("\n");
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  let lastResults = [];
  let lastError;

  for (let attempt = 1; attempt <= args.retries; attempt += 1) {
    try {
      lastResults = await runAttempt(args);
      if (lastResults.every((result) => result.ok)) {
        console.log(
          `✅ Public blog readback passed on attempt ${attempt}/${args.retries}`,
        );
        console.log(summarizeResults(lastResults));
        return;
      }
      console.warn(
        `⚠️ Public blog readback attempt ${attempt}/${args.retries} failed:`,
      );
      console.warn(summarizeResults(lastResults));
    } catch (error) {
      lastError = error;
      console.warn(
        `⚠️ Public blog readback attempt ${attempt}/${args.retries} errored: ${error.message}`,
      );
    }
    if (attempt < args.retries) await sleep(args.delayMs);
  }

  console.error("❌ Public blog readback failed after all attempts.");
  if (lastResults.length) console.error(summarizeResults(lastResults));
  if (lastError) console.error(lastError.stack ?? lastError.message);
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
