-- What the app keeps between its calls, so a step through a game does no work twice.
--
-- game_lines: one row per game line the app was sent (SAN from the start, single-spaced, as
-- sent). The position it reaches, its moves in the board's own SAN, and the deepest named
-- opening along it. The next step finds the line one move shorter here and plays one move.
CREATE TABLE game_lines (
  line_key TEXT PRIMARY KEY,
  fen TEXT NOT NULL,
  sans_json TEXT NOT NULL,
  opening_json TEXT,
  created_at TEXT NOT NULL
);

-- position_facts: the ImbalancesOf row for a position. It is worked out from the board and the
-- book's pawn skeletons alone, so it never goes stale while the book stays as it is. A migration
-- that changes the skeletons empties this table.
CREATE TABLE position_facts (
  fen TEXT PRIMARY KEY,
  record_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
