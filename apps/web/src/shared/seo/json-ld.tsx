import { absoluteUrl, blogUrl, siteConfig } from "@/shared/config/site";
import type { ContentFrontmatter } from "@app/utils";

function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.origin,
    description: siteConfig.description,
    inLanguage: siteConfig.language,
  };
}

export function articleJsonLd(
  slug: string[],
  frontmatter: ContentFrontmatter,
  description: string,
) {
  const url = blogUrl(slug);

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: frontmatter.title,
    description,
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    datePublished: frontmatter.date,
    dateModified: frontmatter.date,
    author: {
      "@type": "Person",
      name: siteConfig.author.name,
      url: siteConfig.author.url,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(siteConfig.logoPath),
      },
    },
    image: [absoluteUrl(siteConfig.logoPath)],
    keywords: frontmatter.tags,
    inLanguage: siteConfig.language,
  };
}

export function breadcrumbJsonLd(slug: string[]) {
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: siteConfig.name,
      item: absoluteUrl("/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Blog",
      item: absoluteUrl("/blog"),
    },
  ];

  slug.forEach((segment, index) => {
    items.push({
      "@type": "ListItem",
      position: index + 3,
      name: segment,
      item: blogUrl(slug.slice(0, index + 1)),
    });
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}
