-- When the realm last asked Lichess anything, so requests from different dispatches stay 1.1 s
-- apart on the one token. One row, named lichess_last_request_at, holding epoch milliseconds.
CREATE TABLE lichess_clock (
  name TEXT PRIMARY KEY,
  at INTEGER NOT NULL
);
