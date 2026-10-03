-- Positions the deepen tick could not deepen: a search that failed, or a queued FEN with no legal
-- move. The deepen tick writes it and never reads it; the marking tick (chess.markDeepened) reads
-- it and marks each one as done at the time it failed, so it leaves the queue until a page queues
-- it again.
--
-- What the replay notes in 0007 say holds for the two ticks. A page that searches is the
-- exception: it reads analyses and writes it, so the host does not replay it when another
-- dispatch published first, and its analyses and queue rows are lost to that race.
CREATE TABLE deep_failures (
  fen TEXT PRIMARY KEY,
  failed_at TEXT NOT NULL,
  error TEXT NOT NULL
);
