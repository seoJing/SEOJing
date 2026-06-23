import contentTree from "@/generated/content-tree.json";
import {
  buildOpsAnalyticsSummary,
  buildPublicAnalyticsSummary,
} from "./analytics-summary";
import type { AnalyticsContentKind } from "./analytics-ingestion";
import type {
  AnalyticsContentInventoryItem,
  AnalyticsOpsSummary,
  AnalyticsPublicSummary,
} from "./analytics-summary";

type ContentTreeNode = {
  name: string;
  type: "folder" | "file";
  path: string;
  extension?: string;
  frontmatter?: {
    title?: string;
    date?: string;
  };
  children?: ContentTreeNode[];
};

const SUMMARY_TIMEOUT_MS = 2500;

function contentKindFromSlug(slug: string): AnalyticsContentKind {
  const [root] = slug.split("/");
  if (root === "study") return "study_post";
  if (root === "okayJing") return "okayjing_post";
  if (slug.toLowerCase().includes("devlog")) return "devlog_post";
  return "blog_post";
}

function slugFromPath(path: string): string {
  return path.replace(/^\//, "").replace(/\.mdx$/, "");
}

function walkContentTree(
  nodes: ContentTreeNode[],
  items: AnalyticsContentInventoryItem[],
) {
  for (const node of nodes) {
    if (node.type === "folder") {
      walkContentTree(node.children ?? [], items);
      continue;
    }
    if (node.extension !== "mdx") continue;
    const slug = slugFromPath(node.path);
    items.push({
      slug,
      title: node.frontmatter?.title ?? slug,
      kind: contentKindFromSlug(slug),
      ...(node.frontmatter?.date
        ? { published_at: node.frontmatter.date }
        : {}),
    });
  }
}

export function getAnalyticsContentInventory(): AnalyticsContentInventoryItem[] {
  const items: AnalyticsContentInventoryItem[] = [];
  walkContentTree(contentTree as ContentTreeNode[], items);
  return items.sort((a, b) =>
    (b.published_at ?? "").localeCompare(a.published_at ?? ""),
  );
}

async function fetchJson<T>(url: string, token?: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadPublicAnalyticsSummary(): Promise<AnalyticsPublicSummary> {
  const configuredUrl = process.env.SEOJING_ANALYTICS_PUBLIC_SUMMARY_URL;
  if (configuredUrl) {
    const external = await fetchJson<AnalyticsPublicSummary>(configuredUrl);
    if (external?.schema_version === "seojing.analytics.v1") {
      return { ...external, source: "external-summary" };
    }
  }

  return buildPublicAnalyticsSummary({
    rows: [],
    inventory: getAnalyticsContentInventory(),
    generatedAt: new Date().toISOString(),
    source: "content-inventory",
  });
}

export async function loadOpsAnalyticsSummary(): Promise<AnalyticsOpsSummary> {
  const configuredUrl = process.env.SEOJING_ANALYTICS_OPS_SUMMARY_URL;
  const token = process.env.SEOJING_ANALYTICS_OPS_READ_TOKEN;
  if (configuredUrl) {
    const external = await fetchJson<AnalyticsOpsSummary>(configuredUrl, token);
    if (external?.schema_version === "seojing.analytics.v1") return external;
  }

  return buildOpsAnalyticsSummary({
    rows: [],
    inventory: getAnalyticsContentInventory(),
    generatedAt: new Date().toISOString(),
  });
}
