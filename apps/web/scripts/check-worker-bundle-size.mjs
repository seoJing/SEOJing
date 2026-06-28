#!/usr/bin/env node
/* global console */
import { spawnSync } from "node:child_process";
import process from "node:process";

const DEFAULT_WARNING_KIB = 2500;
const DEFAULT_HARD_FAIL_KIB = 2800;
const DEFAULT_CONFIG = "dist/server/wrangler.json";

export function parseKiB(value, unit = "KiB") {
  const normalizedUnit = unit.toLowerCase();
  const numericValue = Number.parseFloat(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error(`Invalid size value: ${value}`);
  }

  if (
    normalizedUnit === "b" ||
    normalizedUnit === "byte" ||
    normalizedUnit === "bytes"
  ) {
    return numericValue / 1024;
  }

  if (normalizedUnit === "kb" || normalizedUnit === "kib") {
    return numericValue;
  }

  if (normalizedUnit === "mb" || normalizedUnit === "mib") {
    return numericValue * 1024;
  }

  throw new Error(`Unsupported size unit: ${unit}`);
}

export function parseWranglerUploadGzipKiB(output) {
  const totalUploadPattern =
    /Total Upload:\s*([\d.]+)\s*(B|bytes?|KiB|KB|MiB|MB)\s*\/\s*gzip:\s*([\d.]+)\s*(B|bytes?|KiB|KB|MiB|MB)/i;
  const totalUploadMatch = output.match(totalUploadPattern);

  if (!totalUploadMatch) {
    throw new Error(
      "Could not find Wrangler `Total Upload: ... / gzip: ...` in output.",
    );
  }

  return {
    rawKiB: parseKiB(totalUploadMatch[1], totalUploadMatch[2]),
    gzipKiB: parseKiB(totalUploadMatch[3], totalUploadMatch[4]),
  };
}

function readNumberEnv(name, fallback) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const value = Number.parseFloat(rawValue);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number. Received: ${rawValue}`);
  }

  return value;
}

function readArgs(argv) {
  const args = {
    config: process.env.WORKER_SIZE_WRANGLER_CONFIG || DEFAULT_CONFIG,
    warningKiB: readNumberEnv("WORKER_SIZE_WARNING_KIB", DEFAULT_WARNING_KIB),
    hardFailKiB: readNumberEnv(
      "WORKER_SIZE_HARD_FAIL_KIB",
      DEFAULT_HARD_FAIL_KIB,
    ),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--config") {
      args.config = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--warning-kib") {
      args.warningKiB = Number.parseFloat(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--hard-fail-kib") {
      args.hardFailKiB = Number.parseFloat(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(args.warningKiB) || args.warningKiB <= 0) {
    throw new Error(
      `--warning-kib must be a positive number. Received: ${args.warningKiB}`,
    );
  }

  if (!Number.isFinite(args.hardFailKiB) || args.hardFailKiB <= 0) {
    throw new Error(
      `--hard-fail-kib must be a positive number. Received: ${args.hardFailKiB}`,
    );
  }

  if (args.warningKiB >= args.hardFailKiB) {
    throw new Error(
      `Warning threshold must be lower than hard fail threshold. Received warning=${args.warningKiB} KiB hard=${args.hardFailKiB} KiB.`,
    );
  }

  if (!args.config) {
    throw new Error("Wrangler config path is required.");
  }

  return args;
}

function printHelp() {
  console.log(
    `Usage: node scripts/check-worker-bundle-size.mjs [options]\n\nRuns wrangler deploy --dry-run, parses \`Total Upload: ... / gzip: ...\`,\nand fails when the gzip upload exceeds the hard budget.\n\nOptions:\n  --config <path>          Wrangler config path (default: ${DEFAULT_CONFIG})\n  --warning-kib <number>   Warning threshold in KiB (default: ${DEFAULT_WARNING_KIB})\n  --hard-fail-kib <number> Hard fail threshold in KiB (default: ${DEFAULT_HARD_FAIL_KIB})\n\nEnvironment overrides:\n  WORKER_SIZE_WRANGLER_CONFIG\n  WORKER_SIZE_WARNING_KIB\n  WORKER_SIZE_HARD_FAIL_KIB`,
  );
}

function runWranglerDryRun(config) {
  const result = spawnSync(
    "pnpm",
    ["exec", "wrangler", "deploy", "--dry-run", "--config", config],
    {
      encoding: "utf8",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  if (output) {
    process.stdout.write(output);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `wrangler deploy --dry-run failed with exit code ${result.status}.`,
    );
  }

  return output;
}

export function formatKiB(value) {
  return value.toFixed(2);
}

export function evaluateBudget(
  { gzipKiB, rawKiB },
  { warningKiB, hardFailKiB },
) {
  const summary = `Worker upload gzip ${formatKiB(gzipKiB)} KiB (raw ${formatKiB(rawKiB)} KiB, warning ${warningKiB} KiB, hard ${hardFailKiB} KiB)`;

  if (gzipKiB >= hardFailKiB) {
    return {
      status: "fail",
      message: `${summary}. Hard budget exceeded.`,
    };
  }

  if (gzipKiB >= warningKiB) {
    return {
      status: "warn",
      message: `${summary}. Warning budget exceeded.`,
    };
  }

  return {
    status: "pass",
    message: `${summary}. Within budget.`,
  };
}

function main() {
  const args = readArgs(process.argv.slice(2));
  const output = runWranglerDryRun(args.config);
  const sizes = parseWranglerUploadGzipKiB(output);
  const budget = evaluateBudget(sizes, args);

  if (budget.status === "fail") {
    console.error(`\n❌ ${budget.message}`);
    process.exit(1);
  }

  if (budget.status === "warn") {
    console.warn(`\n⚠️ ${budget.message}`);
    return;
  }

  console.log(`\n✅ ${budget.message}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(
      `\n❌ Worker size budget check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
