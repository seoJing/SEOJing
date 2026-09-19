export interface ArticleMigrationEntry {
  slug: string;
  mode: "bundled-mdx" | "backend-migrated";
  fallback?: "bundled-mdx";
  label: string;
  api?: {
    requiredStatus: string;
    minimumBlockCount: number;
    requiredBlockTypes: string[];
    requiredQuizItems: number;
  };
  public: {
    expectedText: string[];
    forbiddenText: string[];
    requiredHtmlPatterns?: {
      label: string;
      scope: string;
      pattern: string;
    }[];
  };
}

export const ARTICLE_MIGRATION_REGISTRY: readonly ArticleMigrationEntry[];
export function publicArticlePath(slug: string): string;
export function publicArticleApiPath(slug: string): string;
