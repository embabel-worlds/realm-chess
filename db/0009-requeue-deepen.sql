-- Puts back the deepening work that 0007 dropped.
--
-- 0007 replaced deepen_queue without carrying its rows over, so a database upgraded from 0006 lost
-- every position it had queued. Revisiting one does not queue it again, because a page queues a
-- position only when it runs a new search, and the kept search stays fresh for seven days.
--
-- This queues each position the way a page would have: one with a fresh analysis under the
-- graph's own configuration (the `full` budget, whose key is below) that nothing has deepened,
-- marked or given up on since. It is queued at the time it was searched, so the tick takes the
-- oldest first. SQLite cannot hash, so a position goes into a free slot, newest first, rather
-- than the slot its hash names; the queue still never holds more than 4096 rows. A page that
-- searches the position again later queues it in its own slot as usual.
--
-- A database that never ran 0006, or already ran 0007 and has a queue of its own, loses nothing:
-- rows already queued keep their slots, and a position already queued is left alone.
WITH RECURSIVE
  n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < 4095),
  free(slot, k) AS (
    SELECT printf('%03x', i), row_number() OVER (ORDER BY i) FROM n
    WHERE printf('%03x', i) NOT IN (SELECT slot FROM deepen_queue)
  ),
  pending(fen, created_at, k) AS (
    SELECT a.fen, a.created_at, row_number() OVER (ORDER BY a.created_at DESC, a.fen)
    FROM analyses a
    WHERE a.config_key = 'stockfish 19.0.0 de1517a78b37ea79925b78124a6afb4e8eb20afa3695523131548883fddaed0a nodes=3500000 depth=18 multipv=5'
      AND a.created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')
      AND a.fen NOT IN (SELECT fen FROM deepen_queue)
      AND NOT EXISTS (SELECT 1 FROM deep_analyses d WHERE d.fen = a.fen AND d.created_at >= a.created_at)
      AND NOT EXISTS (SELECT 1 FROM deep_marks m WHERE m.fen = a.fen AND m.deepened_at >= a.created_at)
      AND NOT EXISTS (SELECT 1 FROM deep_failures f WHERE f.fen = a.fen AND f.failed_at >= a.created_at)
  )
INSERT INTO deepen_queue (slot, fen, queued_at)
SELECT free.slot, pending.fen, pending.created_at FROM pending JOIN free ON free.k = pending.k;
