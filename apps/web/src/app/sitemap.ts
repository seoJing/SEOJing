import { absoluteUrl } from "@/shared/config/site";
import { flattenContentTree, normalizeDate } from "@/shared/seo/content";
import { getContentTree } from "@/shared/config";

export default async function sitemap() {
  const entries = flattenContentTree(await getContentTree());
  const posts = entries.map((entry) => ({
    url: entry.url,
    lastModified: normalizeDate(
      entry.frontmatter.updated ?? entry.frontmatter.date,
    ),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  const latestContentDate = posts[0]?.lastModified || new Date().toISOString();

  return [
    {
      url: absoluteUrl("/"),
      lastModified: latestContentDate,
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      url: absoluteUrl("/blog"),
      lastModified: latestContentDate,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    ...posts,
  ];
}
