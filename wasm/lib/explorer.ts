import { Chess } from "./chess.js";

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

/*
 * The player database streams newline-delimited JSON, and the host hands that over as
 * `{ records, truncated }`: every complete line parsed, and `truncated` when it dropped an
 * unfinished last one. Each record is a more complete version of the last, so the answer is the
 * last record, which is what explorerAnswer reads from raw text. No records is nothing readable.
 */
export function ndjsonAnswer(reply: unknown): ExplorerAnswer {
  const r = reply as { records?: unknown; truncated?: unknown } | null;
  if (!r || typeof r !== "object" || !Array.isArray(r.records) || typeof r.truncated !== "boolean") {
    throw new Error("The Lichess player explorer answered in a shape the realm does not read");
  }
  const last = r.records[r.records.length - 1];
  if (!last || typeof last !== "object") throw new Error("The Lichess explorer answered with nothing readable");
  return last as ExplorerAnswer;
}

/* ── Checking an answer before anything of it is kept or shown ── */

const count = (v: unknown): number => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : 0);
const rating = (v: unknown): number | undefined => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v < 4000 ? v : undefined);
const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const SAN = /^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|O-O(?:-O)?)[+#]?$/;
const GAME_ID = /^[A-Za-z0-9]{8}$/;
const MONTH = /^\d{4}(?:-\d{2})?$/;
/* A player's name as Lichess or a masters database writes it: letters, spaces and a little punctuation, no controls. */
const name = (v: unknown): string | undefined =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 64) : undefined;

function checkedMove(m: unknown): ExplorerMove | null {
  const x = m as Record<string, unknown>;
  if (!x || typeof x !== "object" || typeof x.uci !== "string" || !UCI.test(x.uci) || typeof x.san !== "string" || !SAN.test(x.san)) return null;
  const out: ExplorerMove = { uci: x.uci, san: x.san, white: count(x.white), draws: count(x.draws), black: count(x.black) };
  const avg = rating(x.averageRating), opp = rating(x.averageOpponentRating), perf = rating(x.performance);
  if (avg !== undefined) out.averageRating = avg;
  if (opp !== undefined) out.averageOpponentRating = opp;
  if (perf !== undefined) out.performance = perf;
  return out;
}

function checkedGame(g: unknown): ExplorerGame | null {
  const x = g as Record<string, unknown>;
  if (!x || typeof x !== "object" || typeof x.id !== "string" || !GAME_ID.test(x.id)) return null;
  const out: ExplorerGame = { id: x.id };
  if (typeof x.uci === "string" && UCI.test(x.uci)) out.uci = x.uci;
  if (x.winner === "white" || x.winner === "black" || x.winner === null) out.winner = x.winner;
  if (typeof x.speed === "string" && (SPEEDS as readonly string[]).includes(x.speed)) out.speed = x.speed;
  if (typeof x.year === "number" && Number.isSafeInteger(x.year) && x.year > 1400 && x.year < 3000) out.year = x.year;
  if (typeof x.month === "string" && MONTH.test(x.month)) out.month = x.month;
  for (const side of ["white", "black"] as const) {
    const p = x[side] as Record<string, unknown> | undefined;
    if (p && typeof p === "object") {
      const player: { name?: string; rating?: number } = {};
      const n = name(p.name), r = rating(p.rating);
      if (n !== undefined) player.name = n;
      if (r !== undefined) player.rating = r;
      out[side] = player;
    }
  }
  return out;
}

const listOf = <T>(v: unknown, max: number, check: (x: unknown) => T | null): T[] | undefined =>
  Array.isArray(v) ? v.slice(0, max).map(check).filter((x): x is T => x !== null) : undefined;

/**
 * The parts of an explorer answer the realm reads, each checked: counts are whole numbers, moves
 * are legal-looking UCI and SAN, game ids are Lichess's eight characters, names have no control
 * characters and are bounded. Anything else in the answer is left behind. This is what is kept
 * and what the rows are made from.
 */
export function checkedAnswer(raw: unknown): ExplorerAnswer {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("The Lichess explorer answered with nothing readable");
  const x = raw as Record<string, unknown>;
  const out: ExplorerAnswer = { white: count(x.white), draws: count(x.draws), black: count(x.black) };
  const moves = listOf(x.moves, 64, checkedMove);
  const topGames = listOf(x.topGames, 32, checkedGame);
  const recentGames = listOf(x.recentGames, 32, checkedGame);
  if (moves) out.moves = moves;
  if (topGames) out.topGames = topGames;
  if (recentGames) out.recentGames = recentGames;
  return out;
}

/** An answer with no moves and no games. The Node realm's producers never kept one. */
export const isEmptyAnswer = (a: ExplorerAnswer): boolean =>
  (a.moves ?? []).length === 0 && (a.topGames ?? []).length === 0 && (a.recentGames ?? []).length === 0;

/* ── The rows, as the Node realm made them (src/api/chess.ts at 86b5bb5) ── */

const share = (n: number, of: number) => (of > 0 ? Math.round((1000 * n) / of) / 10 : null);

export interface ExplorerMoveRecord {
  moveId: string; fen: string; uci: string; san: string; games: number;
  white: number; draws: number; black: number;
  /** Percent of games won by White, drawn, won by Black. */
  whiteWinPct: number | null; drawPct: number | null; blackWinPct: number | null;
  /** Points per game for the side that played the move: 1 a win, 0.5 a draw. */
  scoreForMover: number | null;
  averageRating: number | null;
  player: string; color: string;
}

export interface ExplorerGameRecord {
  gameId: string; fen: string; uci: string; white: string; whiteElo: number | null; black: string; blackElo: number | null;
  result: string; year: number | null; month: string; speed: string; url: string; player: string; color: string;
}

export function moveRecords(fen: string, a: ExplorerAnswer, player = "", color = ""): ExplorerMoveRecord[] {
  const mover = new Chess(fen).turn();
  return (a.moves ?? []).map((m) => {
    const games = (m.white ?? 0) + (m.draws ?? 0) + (m.black ?? 0);
    const wins = mover === "w" ? m.white : m.black;
    return {
      moveId: `${fen}#${player}#${color}#${m.uci}`, fen, uci: m.uci, san: m.san, games,
      white: m.white, draws: m.draws, black: m.black,
      whiteWinPct: share(m.white, games), drawPct: share(m.draws, games), blackWinPct: share(m.black, games),
      scoreForMover: games ? Math.round(((wins + m.draws / 2) / games) * 1000) / 1000 : null,
      averageRating: m.averageRating ?? m.averageOpponentRating ?? null,
      player, color,
    };
  });
}

/* The explorer names the move a game played from the position in UCI; people read notation. */
function sanOf(fen: string, uci: string | undefined): string {
  if (!uci) return "";
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return uci;
  }
}

export function gameRecords(fen: string, games: ExplorerGame[] | undefined, url: (id: string) => string, player = "", color = ""): ExplorerGameRecord[] {
  return (games ?? []).map((g) => ({
    gameId: `${fen}#${player}#${color}#${g.id}`, fen, uci: sanOf(fen, g.uci),
    white: g.white?.name ?? "", whiteElo: g.white?.rating ?? null,
    black: g.black?.name ?? "", blackElo: g.black?.rating ?? null,
    result: g.winner === "white" ? "1-0" : g.winner === "black" ? "0-1" : "½-½",
    year: g.year ?? null, month: g.month ?? "", speed: g.speed ?? "", url: url(g.id), player, color,
  }));
}

export const gameUrl = (id: string) => `https://lichess.org/${id}`;

const bandLabel = (b: string) => {
  const i = BANDS.indexOf(b as (typeof BANDS)[number]);
  if (b === "0") return "under 1000";
  if (b === "2500") return "2500+";
  return i >= 0 && i + 1 < BANDS.length ? `${b}-${Number(BANDS[i + 1]) - 1}` : b;
};

export interface RatedMoveRecord {
  rowId: string; fen: string;
  /** The band's floor as Lichess names it (0, 1000, …, 2500), and as a person reads it. */
  band: string; bandLabel: string;
  /** The time control, or `all` when the query did not pin one. */
  speed: string;
  san: string; uci: string; games: number;
  /** This move's percent of all games from the position in this band and time control. */
  share: number | null;
  whiteWinPct: number | null; drawPct: number | null; blackWinPct: number | null;
  scoreForMover: number | null;
  /** Games from the position in this band and time control, all moves together. */
  bandGames: number;
}

/** One cell's rows: every move played in that band and time control, with its share and score. */
export function ratedRecords(fen: string, cell: { band: string; speed: string }, a: ExplorerAnswer): RatedMoveRecord[] {
  const mover = new Chess(fen).turn();
  const total = (a.white ?? 0) + (a.draws ?? 0) + (a.black ?? 0);
  return (a.moves ?? []).map((m) => {
    const games = m.white + m.draws + m.black;
    const wins = mover === "w" ? m.white : m.black;
    return {
      rowId: `${fen}#${cell.band}#${cell.speed}#${m.uci}`, fen, band: cell.band, bandLabel: bandLabel(cell.band), speed: cell.speed,
      san: m.san, uci: m.uci, games, share: share(games, total),
      whiteWinPct: share(m.white, games), drawPct: share(m.draws, games), blackWinPct: share(m.black, games),
      scoreForMover: games ? Math.round(((wins + m.draws / 2) / games) * 1000) / 1000 : null,
      bandGames: total,
    };
  });
}

/** The request one rated cell makes, as the Node realm made it. */
export const ratedRequest = (fen: string, cell: { band: string; speed: string }) => ({
  fen, ratings: cell.band, ...(cell.speed !== "all" ? { speeds: cell.speed } : {}), moves: 12, topGames: 0, recentGames: 0,
});

/* ── Filters pushed down by a query, as the host sends them: a list of the values it allows ── */

export const PLAYER = /^[A-Za-z0-9_-]{2,30}$/;
export const COLOR = /^(white|black)$/;
export const BAND = /^(0|1000|1200|1400|1600|1800|2000|2200|2500)$/;
export const SPEED = /^(ultraBullet|bullet|blitz|rapid|classical|correspondence|all)$/;
export const LEVEL = /^(beginner|intermediate|expert)$/;

/**
 * The values a query pinned for one property, or undefined when it pinned none. A value outside
 * the property's pattern is refused with PUSHDOWN_VALUE: the guest cannot tell which query sent
 * it, so it never guesses.
 */
export function pinned(values: unknown, property: string, pattern: RegExp): string[] | undefined {
  if (values === undefined || values === null) return undefined;
  if (!Array.isArray(values) || values.some((v) => typeof v !== "string")) {
    throw new Error(`PUSHDOWN_VALUE: ${property} must be a list of strings`);
  }
  for (const v of values as string[]) {
    if (!pattern.test(v)) throw new Error(`PUSHDOWN_VALUE: ${property} cannot be ${JSON.stringify(v.slice(0, 40))}`);
  }
  return [...new Set(values as string[])];
}

/**
 * Whose games to ask for: every pinned player in every pinned colour. A player without a colour
 * is White, as playerFilter reads it; a colour without a player asks nothing, since there is no
 * one to ask about.
 */
export function playerCells(players: string[] | undefined, colors: string[] | undefined): { player: string; color: "white" | "black" }[] {
  if (!players) return [];
  const cs = (colors ?? ["white"]) as ("white" | "black")[];
  return players.flatMap((player) => cs.map((color) => ({ player, color })));
}

/**
 * Which rating bands and time controls to fetch, one request each, as ratedGrid does: whichever
 * dimension is not pinned is compared across. Several pinned values are the product of the two,
 * since Lichess answers one statistic per band and time control and a combined request would
 * blend them. A pinned `all` time control is asked for as itself.
 */
export function ratedCells(bands: string[] | undefined, speeds: string[] | undefined): { band: string; speed: string }[] {
  const bs = bands ?? [...BANDS];
  const ss = speeds ?? (bands ? [...SPEEDS] : ["all"]);
  return bs.flatMap((band) => ss.map((speed) => ({ band, speed })));
}
