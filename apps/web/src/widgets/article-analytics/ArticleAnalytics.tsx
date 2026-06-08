"use client";

import { useArticleAnalytics } from "./useArticleAnalytics";

interface ArticleAnalyticsProps {
  slug: string;
  title: string;
}

export function ArticleAnalytics({ slug, title }: ArticleAnalyticsProps) {
  useArticleAnalytics({ slug, title });
  return null;
}
