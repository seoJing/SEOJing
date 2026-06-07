import { absoluteUrl, siteConfig } from "@/shared/config/site";
import { flattenContentTree, normalizeDate } from "@/shared/seo/content";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const items = flattenContentTree()
    .slice(0, 50)
    .map((entry) => {
      const pubDate = new Date(normalizeDate(entry.frontmatter.date));
      const date = Number.isNaN(pubDate.getTime())
        ? new Date().toUTCString()
        : pubDate.toUTCString();

      return `    <item>
      <title>${escapeXml(entry.frontmatter.title)}</title>
      <link>${escapeXml(entry.url)}</link>
      <guid isPermaLink="true">${escapeXml(entry.url)}</guid>
      <pubDate>${date}</pubDate>
      <description>${escapeXml(entry.frontmatter.description ?? "")}</description>
      ${(entry.frontmatter.tags ?? [])
        .map((tag) => `<category>${escapeXml(tag)}</category>`)
        .join("\n      ")}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteConfig.title)}</title>
    <link>${escapeXml(siteConfig.origin)}</link>
    <description>${escapeXml(siteConfig.description)}</description>
    <language>${siteConfig.language}</language>
    <atom:link href="${escapeXml(absoluteUrl(siteConfig.rssPath))}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
