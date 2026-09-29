import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AnalyticsEventStorage,
  AnalyticsReplayResult,
  StoredAnalyticsEvent,
} from "./analytics-ingestion";

export function createJsonlAnalyticsStorage(
  jsonlPath: string,
): AnalyticsEventStorage {
  return {
    async append(events) {
      await mkdir(path.dirname(jsonlPath), { recursive: true });
      await appendFile(
        jsonlPath,
        events.map((event) => JSON.stringify(event)).join("\n") + "\n",
        "utf8",
      );
    },
  };
}

export async function replayAnalyticsBackup(
  jsonlPath: string,
): Promise<AnalyticsReplayResult> {
  let raw = "";
  try {
    raw = await readFile(jsonlPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { rows: 0, daily_event_counts: {} };
    throw error;
  }
  const dailyEventCounts: Record<string, number> = {};
  let rows = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let row: StoredAnalyticsEvent;
    try {
      row = JSON.parse(line) as StoredAnalyticsEvent;
    } catch {
      continue;
    }
    rows += 1;
    const key = `${row.received_at.slice(0, 10)}|${row.event.content.content_slug}|${row.event.event_type}`;
    dailyEventCounts[key] = (dailyEventCounts[key] ?? 0) + 1;
  }
  return { rows, daily_event_counts: dailyEventCounts };
}
