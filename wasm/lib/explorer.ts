/*
 * Reading the Lichess opening explorer's answers, and the filters a query pushes down to it.
 * Pure functions: the handlers that fetch from Lichess use them.
 */

export interface ExplorerMove { uci: string; san: string; white: number; draws: number; black: number; averageRating?: number; averageOpponentRating?: number; performance?: number }
export interface ExplorerGame {
  id: string; uci?: string; winner?: "white" | "black" | null; speed?: string; year?: number; month?: string;
  white?: { name?: string; rating?: number }; black?: { name?: string; rating?: number };
}
export interface ExplorerAnswer { white?: number; draws?: number; black?: number; moves?: ExplorerMove[]; topGames?: ExplorerGame[]; recentGames?: ExplorerGame[] }

/*
 * The explorer answers JSON, except the player database, which streams newline-delimited JSON —
 * each line a more complete version of the last. A JSON-only reader keeps the first line, the
 * least complete; this keeps the LAST line that parses. Whatever the gateway hands back — a
 * parsed object, or the raw text — is read the same way.
 */
export function explorerAnswer(raw: unknown): ExplorerAnswer {
  if (raw && typeof raw === "object") return raw as ExplorerAnswer;
  const lines = String(raw ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try { return JSON.parse(lines[i]); } catch { /* an incomplete line: try the one before */ }
  }
  throw new Error(`The Lichess explorer answered with nothing readable: ${String(raw).slice(0, 200)}`);
}

/*
 * The player and colour arrive the way the plan level does: a query's
 * `WHERE m.player = 'DrNykterstein' AND m.color = 'white'` is pushed down into the `{filters}`
 * slot as "player=DrNykterstein color=white". Without a player there is nothing to ask.
 */
export function playerFilter(filters: string | undefined): { player: string; color: "white" | "black" } | null {
  const f = filters ?? "";
  const player = f.match(/player=([A-Za-z0-9_-]{2,30})/)?.[1];
  const color = f.match(/color=(white|black)/)?.[1] as "white" | "black" | undefined;
  return player ? { player, color: color ?? "white" } : null;
}

export const BANDS = ["0", "1000", "1200", "1400", "1600", "1800", "2000", "2200", "2500"] as const;
export const SPEEDS = ["ultraBullet", "bullet", "blitz", "rapid", "classical", "correspondence"] as const;
/*
 * The band and time control arrive the way the plan level does — `WHERE m.band = '1600'` and
 * `WHERE m.speed = 'blitz'` pushed down into `{filters}` as "band=1600 speed=blitz". Whichever is
 * NOT pinned is the one compared across: pin the speed and every band is fetched; pin the band
 * and every time control is; pin neither and every band is, over all time controls. One request
 * per cell, one at a time — Lichess asks for no parallel requests on a token.
 */
export function ratedGrid(filters: string | undefined): { band: string; speed: string }[] {
  const f = filters ?? "";
  const band = f.match(/band=(\d{1,4})/)?.[1];
  const speedRaw = f.match(/speed=([A-Za-z]+)/)?.[1];
  const speed = speedRaw && speedRaw !== "all" ? speedRaw : undefined;
  if (band && speed) return [{ band, speed }];
  if (band) return SPEEDS.map((s) => ({ band, speed: s }));
  return BANDS.map((b) => ({ band: b, speed: speed ?? "all" }));
}
