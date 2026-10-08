#!/usr/bin/env node
/* global console, fetch, AbortSignal, setTimeout */
import process from "node:process";
import { pathToFileURL } from "node:url";

const DEFAULT_ORIGIN = "https://seojing.com";
const SENTINELS = [
  {
    slug: "study/clab-26-1/week1",
    title: "프론트엔드 스터디 1주차",
    signals: ["data-backend-article-document"],
  },
  {
    slug: "study/javascript-quizbook/day10",
    signals: ["data-backend-article-document", "data-article-quiz"],
  },
  {
    slug: "study/effective-typescript/day5",
    signals: [
      "data-backend-article-document",
      "data-code-block",
      "data-article-quiz",
      "inference-api-design.svg",
    ],
  },
];

export function readArgs(argv, env = process.env) {
  const args = {
    origin: env.PUBLIC_READBACK_ORIGIN || DEFAULT_ORIGIN,
    minimumArticles: Number(env.PUBLIC_READBACK_MINIMUM_ARTICLES || 201),
    retries: Number(env.PUBLIC_READBACK_RETRIES || 12),
    delayMs: Number(env.PUBLIC_READBACK_DELAY_MS || 10_000),
    timeoutMs: Number(env.PUBLIC_READBACK_TIMEOUT_MS || 30_000),
  };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--help" || key === "-h") {
      console.log(
        "Usage: check-public-blog-readback.mjs [--origin URL] [--minimum-articles N] [--retries N] [--delay-ms N] [--timeout-ms N]",
      );
      process.exit(0);
    }
    const name = {
      "--origin": "origin",
      "--minimum-articles": "minimumArticles",
      "--retries": "retries",
      "--delay-ms": "delayMs",
      "--timeout-ms": "timeoutMs",
    }[key];
    if (!name || !value)
      throw new Error(`Invalid argument: ${key ?? "missing"}`);
    args[name] = name === "origin" ? value : Number(value);
  }
  if (!/^https?:\/\//.test(args.origin))
    throw new Error("Origin must be http(s)");
  for (const name of ["minimumArticles", "retries", "delayMs", "timeoutMs"]) {
    if (
      !Number.isInteger(args[name]) ||
      args[name] < (name === "delayMs" ? 0 : 1)
    )
      throw new Error(`${name} must be a valid integer`);
  }
  args.origin = args.origin.replace(/\/+$/, "");
  return args;
}

export function inspectPublicIndex(payload, minimumArticles) {
  const slugs = [];
  const walk = (nodes) => {
    if (!Array.isArray(nodes)) throw new Error("Public index is not a tree");
    for (const node of nodes) {
      if (node?.type === "folder") walk(node.children);
      else if (node?.type === "file" && typeof node.path === "string")
        slugs.push(node.path.replace(/^\//, ""));
      else throw new Error("Invalid public index node");
    }
  };
  walk(payload?.articles);
  const unique = new Set(slugs);
  const missing = SENTINELS.map((entry) => entry.slug).filter(
    (slug) => !unique.has(slug),
  );
  const invalid = slugs.filter(
    (slug) => !/^[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u.test(slug),
  );
  return {
    ok:
      slugs.length >= minimumArticles &&
      unique.size === slugs.length &&
      !missing.length &&
      !invalid.length,
    count: slugs.length,
    missing,
    invalid,
    duplicateCount: slugs.length - unique.size,
  };
}

export function inspectPublicHtml(html, sentinel) {
  const body = extractArticleContent(html);
  const missing = sentinel.signals.filter((signal) => !body.includes(signal));
  if (sentinel.title && !html.includes(sentinel.title))
    missing.push(sentinel.title);
  const forbidden = [
    "component omitted",
    "ArticleQuiz fallback",
    "RAW_MDX",
  ].filter((signal) => body.includes(signal));
  return { ok: !missing.length && !forbidden.length, missing, forbidden };
}

function extractArticleContent(html) {
  const start = /<([a-z][\w:-]*)\b[^>]*\bdata-article-content(?:=|\s|>)/i.exec(
    html,
  );
  if (!start) return "";
  let body = extractElement(html, start.index, start[1]);
  const streams = new Map(
    [...html.matchAll(/\$RS\("(S:[^"]+)","(P:[^"]+)"\)/g)].map(
      ([, streamId, placeholderId]) => [placeholderId, streamId],
    ),
  );
  const pending = [...body.matchAll(/<template id="(P:[^"]+)"/g)].map(
    ([, id]) => id,
  );
  const seen = new Set();
  while (pending.length) {
    const placeholderId = pending.shift();
    if (seen.has(placeholderId)) continue;
    seen.add(placeholderId);
    const streamId = streams.get(placeholderId);
    if (!streamId) continue;
    const chunkStart = html.indexOf(`<div hidden id="${streamId}">`);
    if (chunkStart < 0) continue;
    const chunk = extractElement(html, chunkStart, "div");
    body += chunk;
    pending.push(
      ...[...chunk.matchAll(/<template id="(P:[^"]+)"/g)].map(([, id]) => id),
    );
  }
  return body;
}

function extractElement(html, start, tag) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, "gi");
  pattern.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = pattern.exec(html))) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(start, pattern.lastIndex);
  }
  return "";
}

async function get(url, accept, timeoutMs) {
  const response = await fetch(url, {
    headers: { Accept: accept, "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response;
}

export async function runAttempt(args) {
  const indexUrl = `${args.origin}/api/public/articles/index`;
  const payload = await (
    await get(indexUrl, "application/json", args.timeoutMs)
  ).json();
  const index = inspectPublicIndex(payload, args.minimumArticles);
  if (!index.ok) return { ok: false, index, pages: [] };
  const pages = await Promise.all(
    SENTINELS.map(async (sentinel) => {
      const url = `${args.origin}/blog/${sentinel.slug}`;
      const html = await (await get(url, "text/html", args.timeoutMs)).text();
      return { slug: sentinel.slug, ...inspectPublicHtml(html, sentinel) };
    }),
  );
  return { ok: pages.every((page) => page.ok), index, pages };
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  let lastError;
  for (let attempt = 1; attempt <= args.retries; attempt++) {
    try {
      const result = await runAttempt(args);
      if (result.ok) {
        console.log(JSON.stringify({ result: "pass", attempt, ...result }));
        return;
      }
      lastError = new Error(JSON.stringify(result));
    } catch (error) {
      lastError = error;
    }
    if (attempt < args.retries)
      await new Promise((resolve) => setTimeout(resolve, args.delayMs));
  }
  throw lastError ?? new Error("Public readback failed");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
