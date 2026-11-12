-- A monotonic revision makes public HTML/RSC cache keys change immediately
-- after any publication, update, or unpublication, in every data center.
CREATE TABLE IF NOT EXISTS public_content_revision (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  revision INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO public_content_revision (singleton, revision) VALUES (1, 0);

CREATE TRIGGER IF NOT EXISTS public_articles_revision_insert
AFTER INSERT ON public_articles
BEGIN
  UPDATE public_content_revision SET revision = revision + 1 WHERE singleton = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_articles_revision_update
AFTER UPDATE ON public_articles
BEGIN
  UPDATE public_content_revision SET revision = revision + 1 WHERE singleton = 1;
END;

CREATE TRIGGER IF NOT EXISTS public_articles_revision_delete
AFTER DELETE ON public_articles
BEGIN
  UPDATE public_content_revision SET revision = revision + 1 WHERE singleton = 1;
END;
