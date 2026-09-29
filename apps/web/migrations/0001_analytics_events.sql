CREATE TABLE IF NOT EXISTS analytics_events (
  event_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  content_slug TEXT NOT NULL,
  event_type TEXT NOT NULL,
  row_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_events_received_at ON analytics_events(received_at);
