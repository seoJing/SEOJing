import fs from "node:fs/promises";
import path from "node:path";

import { validateCareerSnapshot } from "../src/shared/career/data";

const DEFAULT_SLUG = "daangn-frontend-intern";
const TIMEOUT_MS = 8_000;

async function main() {
  const origin = process.env.SEOJING_BACKEND_API_ORIGIN?.trim().replace(
    /\/+$/,
    "",
  );
  const slug = process.argv[2]?.trim() || DEFAULT_SLUG;
  if (!origin) {
    throw new Error("SEOJING_BACKEND_API_ORIGIN is required.");
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error(`Invalid career slug: ${slug}`);
  }

  const outputPath = path.resolve(
    import.meta.dirname,
    `../content-snapshots/career/${slug}.json`,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${origin}/career/opportunities/${encodeURIComponent(slug)}`,
      {
        headers: { accept: "application/json" },
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(`Career API returned ${response.status}.`);
    }
    const body = (await response.json()) as unknown;
    const opportunity = readOpportunity(body);
    if (opportunity.slug !== slug) {
      throw new Error(
        `Career API returned slug ${String(opportunity.slug)} for ${slug}.`,
      );
    }

    const snapshot = validateCareerSnapshot({
      version: 1,
      generatedAt: new Date().toISOString(),
      opportunity,
    });
    const tempPath = `${outputPath}.tmp`;
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(
      tempPath,
      `${JSON.stringify(snapshot, null, 2)}\n`,
      "utf8",
    );
    await fs.rename(tempPath, outputPath);
    console.log(`Updated career snapshot: ${outputPath}`);
  } finally {
    clearTimeout(timeout);
  }
}

function readOpportunity(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Career API body must be an object.");
  const candidate = isRecord(value.opportunity) ? value.opportunity : value;
  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

await main();
