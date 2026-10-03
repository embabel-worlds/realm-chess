import { Chess } from "./chess.js";

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
