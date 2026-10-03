-- Background deepening (the scheduled chess.deepen).
--
-- deepen_queue: positions someone looked at, queued the first time a page searched them. Only
-- the reading side writes it, with INSERT OR IGNORE, and the tick only reads it.
CREATE TABLE deepen_queue (
  fen TEXT PRIMARY KEY,
  queued_at TEXT NOT NULL
);

-- deep_analyses: what the tick found, the same columns as analyses, under the deeper
-- configuration's key. Only the tick writes it; every reader prefers a fresh row here. Keeping it
-- apart from analyses keeps the tick's long dispatch from being refused because a page published
-- a search to analyses while it ran.
CREATE TABLE deep_analyses (
  fen TEXT NOT NULL,
  config_key TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  depth INTEGER NOT NULL,
  nodes INTEGER NOT NULL,
  lines_json TEXT NOT NULL,
  records_json TEXT NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (fen, config_key)
);
