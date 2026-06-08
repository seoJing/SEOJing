import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export const ANALYTICS_SCHEMA_VERSION = "seojing.analytics.v1" as const;
export const MAX_ANALYTICS_BATCH_EVENTS = 20;

export type AnalyticsEventTypeV1 =
  | "post_view"
  | "scroll_depth"
  | "section_engagement"
  | "code_copy"
  | "toc_interaction"
  | "tts_interaction"
  | "presentation_interaction"
  | "qa_interaction";

export type AnalyticsContentKind =
  | "blog_post"
  | "study_post"
  | "okayjing_post"
  | "devlog_post"
  | "page";

export type AnalyticsEventV1 = {
  schema_version: typeof ANALYTICS_SCHEMA_VERSION;
  event_id: string;
  session_id: string;
  event_type: AnalyticsEventTypeV1;
  occurred_at: string;
  content: {
    content_slug: string;
    canonical_url?: string;
    content_kind: AnalyticsContentKind;
    section_id?: string;
    section_heading?: string;
  };
  client_context?: {
    viewport?: "xs" | "sm" | "md" | "lg" | "xl";
    theme?: "light" | "dark" | "system";
    locale?: "ko" | "en" | "unknown";
    referrer_class?:
      | "internal"
      | "search"
      | "social"
      | "direct"
      | "external"
      | "unknown";
    device_class?: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  };
  event: Record<string, unknown>;
};

export type StoredAnalyticsEvent = {
  schema_version: typeof ANALYTICS_SCHEMA_VERSION;
  request_id: string;
  received_at: string;
  event: AnalyticsEventV1;
};

export type AnalyticsEventStorage = {
  append(events: StoredAnalyticsEvent[]): Promise<void>;
};

export type AnalyticsIngestResult = {
  status: 202 | 400;
  body: {
    ok: boolean;
    accepted: number;
    rejected: number;
    request_id: string;
    rejected_reasons: Record<string, number>;
  };
};

export type AnalyticsReplayResult = {
  rows: number;
  daily_event_counts: Record<string, number>;
};

const EVENT_TYPES = new Set<AnalyticsEventTypeV1>([
  "post_view",
  "scroll_depth",
  "section_engagement",
  "code_copy",
  "toc_interaction",
  "tts_interaction",
  "presentation_interaction",
  "qa_interaction",
]);

const CONTENT_KINDS = new Set<AnalyticsContentKind>([
  "blog_post",
  "study_post",
  "okayjing_post",
  "devlog_post",
  "page",
]);

const FORBIDDEN_FIELD_NAMES = new Set([
  "ip",
  "raw_ip",
  "user_agent",
  "ua",
  "email",
  "name",
  "token",
  "secret",
  "question",
  "answer",
  "copied_code",
]);

const EVENT_PAYLOAD_KEYS: Record<AnalyticsEventTypeV1, Set<string>> = {
  post_view: new Set(["source", "load_ms"]),
  scroll_depth: new Set(["max_depth_percent", "reading_ms"]),
  section_engagement: new Set(["action", "visible_ms", "max_visible_percent"]),
  code_copy: new Set(["block_id", "language", "copied_chars_bucket"]),
  toc_interaction: new Set(["action", "target_section_id"]),
  tts_interaction: new Set(["action", "artifact_kind", "speed"]),
  presentation_interaction: new Set(["action", "slide_index"]),
  qa_interaction: new Set([
    "action",
    "question_length_bucket",
    "answer_latency_ms",
    "feedback",
  ]),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countReason(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function hasForbiddenField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenField);
  if (!isRecord(value)) return false;

  return Object.entries(value).some(([key, nestedValue]) => {
    const normalized = key.toLowerCase();
    return (
      FORBIDDEN_FIELD_NAMES.has(normalized) || hasForbiddenField(nestedValue)
    );
  });
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && value.includes("T");
}

function isShortString(value: unknown, maxLength = 256): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maxLength
  );
}

function normalizeEventPayload(
  eventType: AnalyticsEventTypeV1,
  payload: unknown,
): Record<string, unknown> | null {
  if (!isRecord(payload)) return null;
  const allowedKeys = EVENT_PAYLOAD_KEYS[eventType];
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (!allowedKeys.has(key)) return null;
    normalized[key] = value;
  }

  return normalized;
}

function normalizeClientContext(
  value: unknown,
): AnalyticsEventV1["client_context"] | undefined {
  if (!isRecord(value)) return undefined;

  const context: AnalyticsEventV1["client_context"] = {};
  if (["xs", "sm", "md", "lg", "xl"].includes(String(value.viewport))) {
    context.viewport = value.viewport as NonNullable<
      AnalyticsEventV1["client_context"]
    >["viewport"];
  }
  if (["light", "dark", "system"].includes(String(value.theme))) {
    context.theme = value.theme as NonNullable<
      AnalyticsEventV1["client_context"]
    >["theme"];
  }
  if (["ko", "en", "unknown"].includes(String(value.locale))) {
    context.locale = value.locale as NonNullable<
      AnalyticsEventV1["client_context"]
    >["locale"];
  }
  if (
    ["internal", "search", "social", "direct", "external", "unknown"].includes(
      String(value.referrer_class),
    )
  ) {
    context.referrer_class = value.referrer_class as NonNullable<
      AnalyticsEventV1["client_context"]
    >["referrer_class"];
  }
  if (
    ["mobile", "tablet", "desktop", "bot", "unknown"].includes(
      String(value.device_class),
    )
  ) {
    context.device_class = value.device_class as NonNullable<
      AnalyticsEventV1["client_context"]
    >["device_class"];
  }

  return Object.keys(context).length > 0 ? context : undefined;
}

function validateEvent(value: unknown): {
  event?: AnalyticsEventV1;
  reason?: string;
} {
  if (!isRecord(value)) return { reason: "invalid_event_shape" };
  if (hasForbiddenField(value)) return { reason: "forbidden_field" };
  if (value.schema_version !== ANALYTICS_SCHEMA_VERSION) {
    return { reason: "invalid_schema_version" };
  }
  if (!isShortString(value.event_id) || !value.event_id.startsWith("evt_")) {
    return { reason: "invalid_event_id" };
  }
  if (!isShortString(value.session_id) || !value.session_id.startsWith("s_")) {
    return { reason: "invalid_session_id" };
  }
  if (
    typeof value.event_type !== "string" ||
    !EVENT_TYPES.has(value.event_type as AnalyticsEventTypeV1)
  ) {
    return { reason: "invalid_event_type" };
  }
  if (!isIsoDate(value.occurred_at)) return { reason: "invalid_occurred_at" };
  if (!isRecord(value.content)) return { reason: "invalid_content" };
  if (!isShortString(value.content.content_slug)) {
    return { reason: "invalid_content_slug" };
  }
  if (
    typeof value.content.content_kind !== "string" ||
    !CONTENT_KINDS.has(value.content.content_kind as AnalyticsContentKind)
  ) {
    return { reason: "invalid_content_kind" };
  }
  if (
    value.content.canonical_url !== undefined &&
    !isShortString(value.content.canonical_url, 512)
  ) {
    return { reason: "invalid_canonical_url" };
  }
  if (
    value.content.section_id !== undefined &&
    !isShortString(value.content.section_id)
  ) {
    return { reason: "invalid_section_id" };
  }
  const eventType = value.event_type as AnalyticsEventTypeV1;
  const eventPayload = normalizeEventPayload(eventType, value.event);
  if (!eventPayload) {
    return { reason: "invalid_event_payload" };
  }

  const clientContext = normalizeClientContext(value.client_context);
  const normalizedEvent: AnalyticsEventV1 = {
    schema_version: ANALYTICS_SCHEMA_VERSION,
    event_id: value.event_id,
    session_id: value.session_id,
    event_type: eventType,
    occurred_at: value.occurred_at,
    content: {
      content_slug: value.content.content_slug,
      ...(value.content.canonical_url !== undefined
        ? { canonical_url: value.content.canonical_url }
        : {}),
      content_kind: value.content.content_kind as AnalyticsContentKind,
      ...(value.content.section_id !== undefined
        ? { section_id: value.content.section_id }
        : {}),
      ...(value.content.section_heading !== undefined &&
      isShortString(value.content.section_heading)
        ? { section_heading: value.content.section_heading }
        : {}),
    },
    ...(clientContext ? { client_context: clientContext } : {}),
    event: eventPayload,
  };

  return { event: normalizedEvent };
}

function normalizeEventsBody(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (isRecord(body) && Array.isArray(body.events)) return body.events;
  if (isRecord(body)) return [body];
  return null;
}

export async function ingestAnalyticsEvents({
  body,
  requestId,
  receivedAt,
  storage,
}: {
  body: unknown;
  requestId: string;
  receivedAt: string;
  storage: AnalyticsEventStorage;
}): Promise<AnalyticsIngestResult> {
  const events = normalizeEventsBody(body);
  const rejectedReasons: Record<string, number> = {};

  if (!events) {
    return {
      status: 400,
      body: {
        ok: false,
        accepted: 0,
        rejected: 1,
        request_id: requestId,
        rejected_reasons: { invalid_body: 1 },
      },
    };
  }

  const limitedEvents = events.slice(0, MAX_ANALYTICS_BATCH_EVENTS);
  if (events.length > MAX_ANALYTICS_BATCH_EVENTS) {
    rejectedReasons.batch_too_large =
      (rejectedReasons.batch_too_large ?? 0) +
      (events.length - MAX_ANALYTICS_BATCH_EVENTS);
  }

  const acceptedRows: StoredAnalyticsEvent[] = [];
  for (const candidate of limitedEvents) {
    const validation = validateEvent(candidate);
    if (validation.event) {
      acceptedRows.push({
        schema_version: ANALYTICS_SCHEMA_VERSION,
        request_id: requestId,
        received_at: receivedAt,
        event: validation.event,
      });
    } else {
      countReason(rejectedReasons, validation.reason ?? "invalid_event");
    }
  }

  if (acceptedRows.length > 0) {
    await storage.append(acceptedRows);
  }

  const rejected = Object.values(rejectedReasons).reduce(
    (sum, count) => sum + count,
    0,
  );
  return {
    status: 202,
    body: {
      ok: true,
      accepted: acceptedRows.length,
      rejected,
      request_id: requestId,
      rejected_reasons: rejectedReasons,
    },
  };
}

export function createJsonlAnalyticsStorage(
  jsonlPath: string,
): AnalyticsEventStorage {
  return {
    async append(events: StoredAnalyticsEvent[]) {
      await mkdir(path.dirname(jsonlPath), { recursive: true });
      const payload =
        events.map((event) => JSON.stringify(event)).join("\n") + "\n";
      await appendFile(jsonlPath, payload, "utf8");
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
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { rows: 0, daily_event_counts: {} };
    }
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
    const date = row.received_at.slice(0, 10);
    const key = `${date}|${row.event.content.content_slug}|${row.event.event_type}`;
    dailyEventCounts[key] = (dailyEventCounts[key] ?? 0) + 1;
  }

  return { rows, daily_event_counts: dailyEventCounts };
}
