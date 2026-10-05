import { Chess } from "./chess.js";
import { sha256Hex } from "./sha256.ts";

/*
 * The Chess Opening Theory wikibook keeps a page per move sequence — "Chess Opening Theory/1. e4/
 * 1...e5/2. Nf3/…" — deep into the main lines, and its prose says what each side is playing for.
 * That is opening theory in the sense a player means it, and the best single piece of evidence
 * about plans in a book position. Its text is CC BY-SA 4.0.
 */

const ROOT = "Chess Opening Theory";

/* The page title for each prefix of a line, shortest first: "Chess Opening Theory/1. e4", … */
export function theoryTitles(moves: string[]): string[] {
  const c = new Chess();
  const parts: string[] = [];
  const titles: string[] = [];
  for (const m of moves) {
    const n = c.moveNumber();
    const white = c.turn() === "w";
    let san: string;
    try {
      san = c.move(m).san;
    } catch {
      break;
    }
    parts.push(white ? `${n}. ${san}` : `${n}...${san}`);
    titles.push(`${ROOT}/${parts.join("/")}`);
  }
  return titles;
}

/*
 * The same titles from a line's moves as the board already wrote them (its own SAN, from the
 * start), with no board to replay: White's moves are the even plies.
 */
export function titlesOfSans(sans: string[]): string[] {
  const parts: string[] = [];
  return sans.map((san, i) => {
    parts.push(i % 2 === 0 ? `${i / 2 + 1}. ${san}` : `${(i + 1) / 2}...${san}`);
    return `${ROOT}/${parts.join("/")}`;
  });
}

export const pageUrl = (title: string) => `https://en.wikibooks.org/wiki/${encodeURIComponent(title.replace(/ /g, "_")).replace(/%2F/g, "/")}`;

/*
 * The part of a page that is theory: everything before the theory table, references and
 * contribution boilerplate, with runs of blank lines closed up. Bounded, because it goes into a
 * model's prompt as well as onto a page.
 */
export function theoryText(extract: string, maxChars = 3000): string {
  const cut = extract.search(/\n==\s*(Theory table|References|See also|Statistics)\s*==/i);
  const body = (cut >= 0 ? extract.slice(0, cut) : extract)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (body.length <= maxChars) return body;
  const clipped = body.slice(0, maxChars);
  return clipped.slice(0, Math.max(clipped.lastIndexOf("\n"), clipped.lastIndexOf(". ") + 1)).trim() + " …";
}

/* ── Asking the wikibook, and keeping what it says ── */

export interface TheoryRecord {
  /** The game line: SAN moves from the start, space-separated. */
  line: string;
  /** The deepest page along the line that exists. */
  title: string;
  url: string;
  /** How many plies of the line the page covers, and how many the line has gone past it. */
  pliesCovered: number;
  pliesPast: number;
  /** The page's theory, as plain text. Not called `text`: a gateway result whose record has a
   *  `text` field is unwrapped to that string, and the producer then sees no records at all. */
  theory: string;
  licence: string;
}

export const LICENCE =
  "Excerpt from the Chess Opening Theory wikibook, by Wikibooks contributors, CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); references and tables omitted.";

type Page = { title?: unknown; missing?: unknown; extract?: unknown };

export interface WikibooksGateway {
  wikibooks: { wikibooksQuery(a: Record<string, string>): Promise<unknown> };
}

/** The pages of a MediaWiki query answer, or none when it is not one. */
function pagesOf(answer: unknown): Page[] {
  const pages = (answer as { query?: { pages?: unknown } } | null)?.query?.pages;
  return pages && typeof pages === "object" ? (Object.values(pages) as Page[]).filter((p) => p && typeof p === "object") : [];
}

/** The longest extract the realm reads before cutting it to an excerpt. */
const MAX_EXTRACT = 200_000;

function recordFor(moves: string[], titles: string[], title: string, theory: string): TheoryRecord {
  const covered = titles.indexOf(title) + 1;
  return { line: moves.join(" "), title, url: pageUrl(title), pliesCovered: covered, pliesPast: moves.length - covered, theory, licence: LICENCE };
}

/**
 * The deepest page of the Chess Opening Theory wikibook along a line: one request asks which of
 * the line's prefix pages exist (the deepest 50), a second reads that one's text. Only a title the
 * realm asked about is believed, and only the excerpt is kept, never the whole page. A line with
 * no page is kept as a miss for the same week. A refused request
 * throws and keeps nothing.
 *
 * `mayFetch` is asked before each of the two requests. When it says there is no time, the
 * lookup stops, keeps nothing, and answers "later". A caller that already has the line's titles
 * (from titlesOfSans) passes them, and the line is not replayed.
 */
export async function theoryFor(
  db: { exec(sql: string): Promise<Record<string, string | number | null>[]> },
  gateway: WikibooksGateway,
  moves: string[],
  ttlMs: number,
  mayFetch: () => boolean,
  knownTitles?: string[],
): Promise<TheoryRecord | null | "later"> {
  const titles = knownTitles ?? theoryTitles(moves);
  if (titles.length === 0) return null;
  const line = moves.join(" ");
  const q = (s: string) => `'${s.replaceAll("'", "''")}'`;
  const kept = (await db.exec(`SELECT title, extract, fetched_at, found FROM theory WHERE line_key = ${q(line)}`))[0];
  if (kept && Date.now() - Date.parse(String(kept.fetched_at)) < ttlMs) {
    return String(kept.found) === "1" ? recordFor(moves, titles, String(kept.title), String(kept.extract)) : null;
  }
  if (!mayFetch()) return "later";
  const keep = (title: string, excerpt: string, found: boolean) =>
    db.exec(
      `INSERT OR REPLACE INTO theory (line_key, title, extract, url, text_sha, fetched_at, found) VALUES (${q(line)}, ${q(title)}, ` +
        `${q(excerpt)}, ${q(title ? pageUrl(title) : "")}, ${q(excerpt ? sha256Hex(excerpt) : "")}, ${q(new Date().toISOString())}, ${found ? 1 : 0})`,
    );
  const candidates = titles.slice(-50);
  const info = await gateway.wikibooks.wikibooksQuery({ action: "query", format: "json", prop: "info", titles: candidates.join("|") });
  const present = new Set(pagesOf(info).filter((p) => p.missing === undefined && typeof p.title === "string").map((p) => p.title as string));
  const deepest = [...candidates].reverse().find((t) => present.has(t));
  if (!deepest) {
    await keep("", "", false);
    return null;
  }
  if (!mayFetch()) return "later";
  const page = await gateway.wikibooks.wikibooksQuery({ action: "query", format: "json", prop: "extracts", explaintext: "1", redirects: "1", titles: deepest });
  const extract = pagesOf(page).map((p) => p.extract).find((e): e is string => typeof e === "string") ?? "";
  const text = theoryText(extract.slice(0, MAX_EXTRACT));
  if (!text) {
    await keep("", "", false);
    return null;
  }
  await keep(deepest, text, true);
  return recordFor(moves, titles, deepest, text);
}
