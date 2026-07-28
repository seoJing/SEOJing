#!/usr/bin/env node
/* global console, fetch, setTimeout, AbortSignal */
import process from "node:process";

const DEFAULT_ORIGIN = "https://seojing.com";
const DEFAULT_RETRIES = 12;
const DEFAULT_DELAY_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 30_000;

const routeChecks = [
  {
    path: "/blog/study/clab-26-1/week1",
    label: "legacy CLAB study MDX parity sentinel",
    expected: [
      "프론트엔드 스터디 1주차",
      "2026년 3월 23일",
      "프론트엔드",
      "웹접근성",
      "데이터 요금을 아껴주는",
      "article과 section",
      "스터디 인증 미션",
      "og 태그 작업 이전",
      "og 태그 작업 이후",
    ],
    forbidden: [
      "data-backend-article-blocks",
      "data-backend-article-html",
      "ArticleImage fallback",
      "component omitted",
      "2026년 6월 28일",
    ],
  },
  {
    path: "/blog/study/javascript-quizbook/day10",
    label: "current JS Quizbook study article sentinel",
    expected: [
      "자바스크립트 퀴즈북 리마인드 Day 10",
      "함수는 값이고 경계다",
      "함수 설계 경계",
      "ArticleQuiz",
      "고차 함수",
    ],
    forbidden: [
      "data-backend-article-blocks",
      "data-backend-article-html",
      "ArticleImage fallback",
      "component omitted",
    ],
  },
];

function readArgs(argv) {
  const args = {
    origin: process.env.PUBLIC_READBACK_ORIGIN || DEFAULT_ORIGIN,
    retries: readNumberEnv("PUBLIC_READBACK_RETRIES", DEFAULT_RETRIES),
    delayMs: readNumberEnv("PUBLIC_READBACK_DELAY_MS", DEFAULT_DELAY_MS),
    timeoutMs: readNumberEnv("PUBLIC_READBACK_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--origin") {
      args.origin = argv[index + 1];
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
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!/^https?:\/\//.test(args.origin)) {
    throw new Error(
      `--origin must be an http(s) URL. Received: ${args.origin}`,
    );
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
  return args;
}

function readNumberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer. Received: ${raw}`);
  }
  return parsed;
}

function printHelp() {
  console.log(
    `Usage: node scripts/check-public-blog-readback.mjs [options]\n\nChecks deployed SEOJing public article routes after deploy. The sentinels catch\nregressions where study MDX is accidentally routed through the backend article\nloader before renderer parity is proven.\n\nOptions:\n  --origin <url>       Public origin to probe (default: ${DEFAULT_ORIGIN})\n  --retries <n>        Attempts before failing (default: ${DEFAULT_RETRIES})\n  --delay-ms <ms>      Delay between attempts (default: ${DEFAULT_DELAY_MS})\n  --timeout-ms <ms>    Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})\n\nEnvironment overrides:\n  PUBLIC_READBACK_ORIGIN\n  PUBLIC_READBACK_RETRIES\n  PUBLIC_READBACK_DELAY_MS\n  PUBLIC_READBACK_TIMEOUT_MS`,
  );
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(origin, path) {
  return `${origin}${path}`;
}

async function fetchHtml(url, timeoutMs) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      "Cache-Control": "no-cache",
      "User-Agent": "SEOJing-public-readback/1.0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} for ${url}: ${body.slice(0, 200)}`,
    );
  }
  return body;
}

function inspectHtml(check, html) {
  const missing = check.expected.filter((text) => !html.includes(text));
  const presentForbidden = check.forbidden.filter((text) =>
    html.includes(text),
  );
  return {
    ok: missing.length === 0 && presentForbidden.length === 0,
    missing,
    presentForbidden,
  };
}

async function runAttempt(args) {
  const results = [];
  for (const check of routeChecks) {
    const url = buildUrl(args.origin, check.path);
    const html = await fetchHtml(url, args.timeoutMs);
    const inspection = inspectHtml(check, html);
    results.push({ check, url, htmlBytes: html.length, ...inspection });
  }
  return results;
}

function summarizeResults(results) {
  return results
    .map((result) => {
      const status = result.ok ? "PASS" : "FAIL";
      const details = [];
      if (result.missing.length) {
        details.push(`missing=${JSON.stringify(result.missing)}`);
      }
      if (result.presentForbidden.length) {
        details.push(`forbidden=${JSON.stringify(result.presentForbidden)}`);
      }
      details.push(`bytes=${result.htmlBytes}`);
      return `${status} ${result.check.label} ${result.url} ${details.join(" ")}`;
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

    if (attempt < args.retries) {
      await sleep(args.delayMs);
    }
  }

  console.error("❌ Public blog readback failed after all attempts.");
  if (lastResults.length) {
    console.error(summarizeResults(lastResults));
  }
  if (lastError) {
    console.error(lastError.stack ?? lastError.message);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
