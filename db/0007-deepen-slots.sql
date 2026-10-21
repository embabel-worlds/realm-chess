-- The deepen queue as a fixed number of slots, and a record of what has been deepened.
--
-- deepen_queue: a position is queued in the slot its hash names (the first three hex digits of
-- the sha256 of its FEN, so 4096 slots). Queueing is a keyed upsert, which the host can replay,
-- and the table can never hold more than 4096 rows; a position queued into a slot another one
-- holds takes it over. Only pages write it, and only the deepen tick reads it.
DROP TABLE deepen_queue;
CREATE TABLE deepen_queue (
  slot TEXT PRIMARY KEY,
  fen TEXT NOT NULL,
  queued_at TEXT NOT NULL
);

-- deep_marks: when each position was last deepened. The deepen tick reads it to skip positions
-- already done and never writes it; the marking tick (chess.markDeepened) writes it from
-- deep_analyses and never reads it. No dispatch reads a table it writes, so the host can replay
-- every one of them when another dispatch published first.
CREATE TABLE deep_marks (
  fen TEXT PRIMARY KEY,
  deepened_at TEXT NOT NULL
);
