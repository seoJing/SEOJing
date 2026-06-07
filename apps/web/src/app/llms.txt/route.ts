import { absoluteUrl, siteConfig } from "@/shared/config/site";
import { flattenContentTree } from "@/shared/seo/content";

export function GET() {
  const entries = flattenContentTree();
  const featured = entries
    .slice(0, 30)
    .map(
      (entry) =>
        `- [${entry.frontmatter.title}](${entry.url}): ${entry.frontmatter.description}`,
    )
    .join("\n");

  const body = `# ${siteConfig.name}

${siteConfig.description}

## Site

- Canonical origin: ${siteConfig.origin}
- Blog index: ${absoluteUrl("/blog")}
- Sitemap: ${absoluteUrl(siteConfig.sitemapPath)}
- RSS: ${absoluteUrl(siteConfig.rssPath)}

## Topics

SEOJing includes frontend development notes, backend study material, project retrospectives, and okayJing/Hermes operating logs.

## Recent and representative posts

${featured}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
