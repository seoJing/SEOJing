import contentTree from "@/generated/content-tree.json";
import type { ContentNode, ContentTree } from "@app/utils";
import { blogUrl, siteConfig } from "@/shared/config/site";

export interface SeoContentEntry {
  slug: string;
  slugParts: string[];
  path: string;
  url: string;
  frontmatter: NonNullable<ContentNode["frontmatter"]>;
}

export function flattenContentTree(
  nodes: ContentTree = contentTree as ContentTree,
): SeoContentEntry[] {
  const entries: SeoContentEntry[] = [];

  function walk(currentNodes: ContentTree) {
    for (const node of currentNodes) {
      if (node.type === "folder") {
        walk(node.children ?? []);
        continue;
      }

      if (!node.frontmatter) continue;
      const slug = node.path.replace(/^\//, "").replace(/\.(mdx|md)$/i, "");
      const slugParts = slug.split("/").filter(Boolean);
      entries.push({
        slug,
        slugParts,
        path: node.path,
        url: blogUrl(slugParts),
        frontmatter: node.frontmatter,
      });
    }
  }

  walk(nodes);
  return entries.sort((a, b) => {
    const dateCompare = normalizeDate(b.frontmatter.date).localeCompare(
      normalizeDate(a.frontmatter.date),
    );
    return dateCompare || a.slug.localeCompare(b.slug);
  });
}

export function findContentEntry(slug: string[]): SeoContentEntry | undefined {
  const key = slug.join("/");
  return flattenContentTree().find((entry) => entry.slug === key);
}

export function normalizeDate(value: string | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export function firstParagraphDescription(source: string): string | undefined {
  const paragraph = source
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => {
      if (!block) return false;
      if (block.startsWith("---")) return false;
      if (block.startsWith("#")) return false;
      if (block.startsWith("```")) return false;
      if (/^<\/?(Paragraph|p)\b/i.test(block)) return true;
      if (block.startsWith("<")) return false;
      return true;
    });

  if (!paragraph) return undefined;
  return paragraph
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<\/?(Paragraph|p)[^>]*>/gi, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[>*_~#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function getArticleDescription(
  frontmatter: SeoContentEntry["frontmatter"],
  source: string,
): string {
  return (
    frontmatter.description ||
    firstParagraphDescription(source) ||
    siteConfig.description
  );
}

export function folderTitle(slug: string[]): string {
  if (slug.length === 0) return "블로그";
  return slug
    .map((segment) =>
      segment
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    )
    .join(" / ");
}
