export const ANALYTICS_SCHEMA_VERSION = "seojing.analytics.v1";
export const ANALYTICS_ENDPOINT = "/api/analytics/events";
export const ANALYTICS_SESSION_KEY = "seojing_analytics_session_v1";
export const ANALYTICS_OPT_OUT_KEY = "seojing_analytics_opt_out";

export type AnalyticsEventTypeV1 =
  | "post_view"
  | "scroll_depth"
  | "section_engagement"
  | "code_copy"
  | "toc_interaction";

export type ContentKind =
  | "blog_post"
  | "study_post"
  | "okayjing_post"
  | "devlog_post"
  | "page";

export type ViewportBucket = "xs" | "sm" | "md" | "lg" | "xl";
export type DeviceClass = "mobile" | "tablet" | "desktop" | "unknown";
export type ReferrerClass =
  | "internal"
  | "search"
  | "social"
  | "direct"
  | "external"
  | "unknown";

export interface AnalyticsContentContext {
  content_slug: string;
  canonical_url?: string;
  content_kind: ContentKind;
  section_id?: string;
  section_heading?: string;
}

export interface AnalyticsEventV1 {
  schema_version: typeof ANALYTICS_SCHEMA_VERSION;
  event_id: string;
  session_id: string;
  event_type: AnalyticsEventTypeV1;
  occurred_at: string;
  content: AnalyticsContentContext;
  client_context?: {
    viewport?: ViewportBucket;
    theme?: "light" | "dark" | "system";
    locale?: "ko" | "en" | "unknown";
    referrer_class?: ReferrerClass;
    device_class?: DeviceClass;
  };
  event: Record<string, unknown>;
}

export interface AnalyticsSessionRecord {
  id: string;
  createdAt: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEARCH_HOSTS = ["google.", "naver.", "bing.", "duckduckgo.", "daum."];
const SOCIAL_HOSTS = [
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "threads.net",
];

export function contentKindFromSlug(contentSlug: string): ContentKind {
  const segments = contentSlug.split("/");
  const [root] = segments;
  if (root === "study") return "study_post";
  if (root === "okayJing") return "okayjing_post";
  if (segments.some((segment) => segment.toLowerCase() === "devlog")) {
    return "devlog_post";
  }
  return contentSlug ? "blog_post" : "page";
}

export function viewportBucket(width: number): ViewportBucket {
  if (width < 640) return "xs";
  if (width < 768) return "sm";
  if (width < 1024) return "md";
  if (width < 1280) return "lg";
  return "xl";
}

export function deviceClass(width: number, pointerCoarse = false): DeviceClass {
  if (width < 768) return "mobile";
  if (width < 1024 || pointerCoarse) return "tablet";
  return "desktop";
}

export function classifyReferrer(
  referrer: string,
  currentOrigin: string,
): ReferrerClass {
  if (!referrer) return "direct";
  try {
    const url = new URL(referrer);
    if (url.origin === currentOrigin) return "internal";
    const host = url.hostname.toLowerCase();
    if (SEARCH_HOSTS.some((needle) => host.includes(needle))) return "search";
    if (
      SOCIAL_HOSTS.some(
        (needle) => host === needle || host.endsWith(`.${needle}`),
      )
    )
      return "social";
    return "external";
  } catch {
    return "unknown";
  }
}

export function copiedCharsBucket(
  length: number,
): "1-80" | "81-200" | "201-500" | "501+" {
  if (length <= 80) return "1-80";
  if (length <= 200) return "81-200";
  if (length <= 500) return "201-500";
  return "501+";
}

export function scrollDepthMilestones(
  progress: number,
  sent: ReadonlySet<number>,
): Array<25 | 50 | 75 | 90 | 100> {
  const milestones = [25, 50, 75, 90, 100] as const;
  return milestones.filter(
    (milestone) => progress >= milestone && !sent.has(milestone),
  );
}

export function slugifyHeading(text: string): string {
  const ascii = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return ascii || "section";
}

export function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}

export function sectionIdForHeading(
  contentSlug: string,
  headingPath: string,
  headingText: string,
): string {
  return `sec_${slugifyHeading(headingText)}_${shortHash(`${contentSlug}:${headingPath}:${headingText}`)}`;
}

export function isAnalyticsDisabled(
  storage: Pick<Storage, "getItem"> | undefined,
  doNotTrack?: string | null,
): boolean {
  if (doNotTrack === "1" || doNotTrack === "yes") return true;
  try {
    return storage?.getItem(ANALYTICS_OPT_OUT_KEY) === "true";
  } catch {
    return true;
  }
}

export function readOrCreateSessionId(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  now = Date.now(),
  randomId = () => crypto.randomUUID(),
): string {
  const raw = storage.getItem(ANALYTICS_SESSION_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AnalyticsSessionRecord;
      if (parsed.id?.startsWith("s_") && now - parsed.createdAt < ONE_DAY_MS) {
        return parsed.id;
      }
    } catch {
      // Fall through and rotate the malformed record.
    }
  }

  const id = `s_${randomId()}`;
  storage.setItem(
    ANALYTICS_SESSION_KEY,
    JSON.stringify({ id, createdAt: now }),
  );
  return id;
}

export function clearAnalyticsSession(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(ANALYTICS_SESSION_KEY);
}

export function createAnalyticsEvent(
  sessionId: string,
  eventType: AnalyticsEventTypeV1,
  content: AnalyticsContentContext,
  event: Record<string, unknown>,
  clientContext?: AnalyticsEventV1["client_context"],
  now = new Date(),
  randomId = () => crypto.randomUUID(),
): AnalyticsEventV1 {
  return {
    schema_version: ANALYTICS_SCHEMA_VERSION,
    event_id: `evt_${randomId()}`,
    session_id: sessionId,
    event_type: eventType,
    occurred_at: now.toISOString(),
    content,
    client_context: clientContext,
    event,
  };
}
