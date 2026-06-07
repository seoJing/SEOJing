export const siteConfig = {
  name: "SEOJing",
  title: "SEOJing",
  description: "SEOJing's 프론트엔드 개발 블로그 플랫폼",
  origin: "https://seojing.com",
  locale: "ko_KR",
  language: "ko",
  author: {
    name: "SEOJing",
    url: "https://seojing.com",
  },
  logoPath: "/logo.png",
  rssPath: "/rss.xml",
  sitemapPath: "/sitemap.xml",
  llmsPath: "/llms.txt",
} as const;

export function absoluteUrl(path: string = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteConfig.origin}${normalizedPath}`;
}

export function blogUrl(slug: string | string[]): string {
  const parts = Array.isArray(slug) ? slug : slug.split("/");
  return absoluteUrl(`/blog/${parts.filter(Boolean).join("/")}`);
}
