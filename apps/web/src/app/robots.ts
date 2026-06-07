import { absoluteUrl, siteConfig } from "@/shared/config/site";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: absoluteUrl(siteConfig.sitemapPath),
    host: siteConfig.origin,
  };
}
