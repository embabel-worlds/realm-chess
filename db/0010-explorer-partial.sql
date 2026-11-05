-- Marks a kept Lichess answer as partial: the player explorer was still streaming, while Lichess
-- indexed the player's games, when the host's call deadline ended the read. A partial answer is
-- kept for ten minutes rather than a day, so a later ask finds the games indexed since. Every
-- answer kept before this is a whole one.
ALTER TABLE explorer ADD COLUMN partial INTEGER NOT NULL DEFAULT 0;
