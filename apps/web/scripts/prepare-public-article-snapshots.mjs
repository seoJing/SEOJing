#!/usr/bin/env node
/* global fetch, AbortSignal, console */
import { Buffer } from "node:buffer";
import process from "node:process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [action, ...args] = process.argv.slice(2);
if (!["--plan", "--write"].includes(action))
  throw new Error("Usage: --plan|--write --manifest PATH [--output-dir PATH]");
const flags = new Map();
for (let i = 0; i < args.length; i += 2) {
  if (!args[i]?.startsWith("--") || !args[i + 1])
    throw new Error(`Invalid argument: ${args[i] ?? "missing"}`);
  flags.set(args[i], args[i + 1]);
}
const manifestPath = flags.get("--manifest");
if (!manifestPath) throw new Error("--manifest is required");
const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const expected = new Set(manifest.entries?.map((entry) => entry.slug));
if (expected.size !== manifest.entries?.length || expected.size === 0)
  throw new Error("Invalid or duplicate manifest slugs");
const source = flags.get("--source") ?? "public";
if (source !== "public" && source !== "staged")
  throw new Error("--source must be public or staged");

const origin =
  process.env.SEOJING_BACKEND_API_ORIGIN ??
  process.env.SEOJING_BACKEND_ARTICLE_API_ORIGIN;
const token =
  process.env.SEOJING_BACKEND_ADMIN_API_TOKEN ?? process.env.ADMIN_API_TOKEN;
if (!origin || !token)
  throw new Error(
    "Backend origin and admin token must be set in the environment",
  );
const base = origin.replace(/\/+$/, "");

async function getJson(path, authenticated = false) {
  const response = await fetch(`${base}${path}`, {
    headers: {
      accept: "application/json",
      ...(authenticated ? { authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok)
    throw new Error(`Backend read failed: ${path} returned ${response.status}`);
  return response.json();
}

const slugs =
  source === "staged"
    ? [...expected].sort()
    : (await getJson("/admin/articles/published-slugs", true)).slugs;
if (!Array.isArray(slugs) || new Set(slugs).size !== slugs.length)
  throw new Error("Invalid published slug list");
const missing = [...expected].filter((slug) => !slugs.includes(slug));
const extra = slugs.filter((slug) => !expected.has(slug));
if (missing.length || extra.length)
  throw new Error(
    `Article slug mismatch: missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`,
  );

const articles = new Array(slugs.length);
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(6, slugs.length) }, async () => {
    while (next < slugs.length) {
      const index = next++;
      const slug = slugs[index];
      const article = await getJson(
        `/admin/articles/${encodeURIComponent(slug)}/${source === "staged" ? "migration-snapshot" : "public-snapshot"}`,
        true,
      );
      if (
        source === "staged" &&
        article.migrationSourceSha256 !==
          manifest.entries.find((entry) => entry.slug === slug)?.sourceSha256
      )
        throw new Error(`Converted source hash mismatch: ${slug}`);
      if (
        article.slug !== slug ||
        !article.publishedAt ||
        article.body?.document?.type !== "doc" ||
        typeof article.body?.html !== "string"
      ) {
        throw new Error(`Public document readback invalid: ${slug}`);
      }
      const publicArticle = Object.fromEntries(
        Object.entries(article).filter(
          ([key]) => key !== "migrationSourceSha256",
        ),
      );
      articles[index] = {
        ...publicArticle,
        body: { document: article.body.document, html: "", blocks: [] },
      };
    }
  }),
);

const quote = (value) =>
  value === null || value === undefined
    ? "NULL"
    : `'${String(value).replaceAll("'", "''")}'`;
export function publicArticleUpsertSql(article) {
  const values = [
    article.slug,
    article.title,
    article.description ?? null,
    article.category ?? "SEOJing",
    JSON.stringify(article.tags ?? []),
    article.cover ? JSON.stringify(article.cover) : null,
    article.displayDate ?? null,
    article.displayUpdatedAt ?? null,
    article.publishedAt,
    article.updatedAt,
    JSON.stringify(article),
  ];
  return `INSERT INTO public_articles (slug,title,description,category,tags_json,cover_json,display_date,display_updated_at,published_at,updated_at,payload_json) VALUES (${values.map(quote).join(",")}) ON CONFLICT(slug) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,tags_json=excluded.tags_json,cover_json=excluded.cover_json,display_date=excluded.display_date,display_updated_at=excluded.display_updated_at,published_at=excluded.published_at,updated_at=excluded.updated_at,payload_json=excluded.payload_json;`;
}

const rows = articles.map(publicArticleUpsertSql);
const maxStatementBytes = Math.max(
  ...rows.map((row) => Buffer.byteLength(row)),
);
if (maxStatementBytes > 100 * 1024)
  throw new Error(
    `A snapshot exceeds the D1 statement budget: ${maxStatementBytes} bytes`,
  );
const report = {
  action,
  source,
  expected: expected.size,
  articles: slugs.length,
  documents: articles.length,
  maxStatementBytes,
  totalSqlBytes: rows.reduce((sum, row) => sum + Buffer.byteLength(row) + 1, 0),
};

if (action === "--write") {
  const outputDir = flags.get("--output-dir");
  if (!outputDir) throw new Error("--output-dir is required for --write");
  const path = resolve(outputDir);
  await mkdir(path, { recursive: false });
  const files = [];
  for (let start = 0; start < rows.length; start += 10) {
    const name = `${String(start / 10 + 1).padStart(3, "0")}.sql`;
    await writeFile(
      resolve(path, name),
      `${rows.slice(start, start + 10).join("\n")}\n`,
      { flag: "wx", mode: 0o600 },
    );
    files.push(name);
  }
  console.log(JSON.stringify({ ...report, outputDir: path, files }));
} else {
  console.log(JSON.stringify(report));
}
