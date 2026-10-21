-- What the realm could not do, as the guest last saw it: one row for the owner. Read by the
-- ChessStatus producer.
CREATE TABLE chess_status (
  owner TEXT PRIMARY KEY,
  lichess TEXT NOT NULL,
  model TEXT NOT NULL,
  last_refusal TEXT NOT NULL,
  at TEXT NOT NULL
);
