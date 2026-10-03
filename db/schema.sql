-- The realm's SQLite, version 0. Never edit this file once a realm has installed it: the host
-- ties a saved database to its hash. Changes go in a new db/NNNN-*.sql migration.
--
-- Every table has a text primary key, so every write can be a keyed upsert the host can
-- replay when two dispatches publish at once. Values come back from the host as text.

-- The engine's lines for a position under one configuration (module, node budget, depth cap,
-- lines). analysis_id is the hash of the configuration and the lines: what the lines are.
CREATE TABLE analyses (
  fen TEXT NOT NULL,
  config_key TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  depth INTEGER NOT NULL,
  nodes INTEGER NOT NULL,
  lines_json TEXT NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (fen, config_key)
);

-- A model's plans, keyed by what they were made from: the analysis they describe and the hash
-- of every other input to the prompt.
CREATE TABLE plans (
  identity TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  fen_or_line TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  inputs_hash TEXT NOT NULL,
  skill_sha TEXT NOT NULL,
  plans_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- The wikibook's theory along a line. found = 0 keeps a line the wikibook has no page for.
CREATE TABLE theory (
  line_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  extract TEXT NOT NULL,
  url TEXT NOT NULL,
  text_sha TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  found INTEGER NOT NULL
);

-- Lichess explorer answers, keyed by operation, position and every filter.
CREATE TABLE explorer (
  request_key TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  fen TEXT NOT NULL,
  filters_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

-- The opening book by position. Rows arrive with db/0001-openings.sql.
CREATE TABLE openings (
  position_key TEXT PRIMARY KEY,
  eco TEXT NOT NULL,
  name TEXT NOT NULL,
  pgn TEXT NOT NULL
);

-- Pawn skeletons of the book's lines, with every family and name. Rows arrive with
-- db/0002-skeletons.sql.
CREATE TABLE skeletons (
  pawns_key TEXT PRIMARY KEY,
  families_json TEXT NOT NULL,
  names_json TEXT NOT NULL
);
