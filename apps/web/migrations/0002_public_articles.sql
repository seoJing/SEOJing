CREATE TABLE IF NOT EXISTS public_articles (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  cover_json TEXT,
  display_date TEXT,
  display_updated_at TEXT,
  published_at TEXT,
  updated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_articles_date
  ON public_articles(COALESCE(display_date, published_at, updated_at) DESC);
