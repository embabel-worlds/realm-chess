import { CATEGORIES, imbalancesOf } from "../wasm/lib/imbalances";
import { readLine } from "../wasm/lib/lines";
import { openingOfLine, positionAfter, structureOf, type Book, type Skeletons } from "../wasm/lib/openings";
import { pageUrl, theoryText, theoryTitles } from "../wasm/lib/theory";
import { explorerAnswer, playerFilter, ratedGrid } from "../wasm/lib/explorer";
import { buildGuest, call, hasTooling } from "./guest/runtime";
import { chessHost, FakeDb } from "./guest/host";
// @ts-expect-error the book script is plain JavaScript
import { bookLines, buildBook, buildSkeletons } from "../scripts/book.mjs";

/*
 * The pure board code, twice: as Node runs it, and inside the realm's built Javy guest, where
 * each call is a real dispatch into the module the appliance would run, reading the book from
 * SQLite. The tests run against both, since passing under Node says nothing about the guest.
 */
export interface Lib {
  name: string;
  imbalancesOf: typeof imbalancesOf;
  CATEGORIES: readonly string[];
  readLine: typeof readLine;
  openingOfLine: (moves: string[]) => ReturnType<typeof openingOfLine>;
  positionAfter: typeof positionAfter;
  structureOf: (fen: string) => ReturnType<typeof structureOf>;
  theoryTitles: typeof theoryTitles;
  theoryText: typeof theoryText;
  pageUrl: typeof pageUrl;
  explorerAnswer: typeof explorerAnswer;
  playerFilter: typeof playerFilter;
  ratedGrid: typeof ratedGrid;
}

let book: Book | undefined;
let skeletons: Skeletons | undefined;

/** The whole book, built from data/openings.tsv as the migrations are. */
export function fullBook(): Book {
  return (book ??= buildBook(bookLines()));
}

/** Every skeleton, read as the store reads a row: every family counted, the first six names. */
export function fullSkeletons(): Skeletons {
  if (!skeletons) {
    skeletons = {};
    const built = buildSkeletons(bookLines()) as Record<string, { families: string[]; names: { eco: string; name: string }[] }>;
    for (const [k, s] of Object.entries(built)) skeletons[k] = { families: s.families.length, openings: s.names.slice(0, 6) };
  }
  return skeletons;
}

export const nodeLib: Lib = {
  name: "node",
  imbalancesOf, CATEGORIES, readLine, positionAfter, theoryTitles, theoryText, pageUrl, explorerAnswer, playerFilter, ratedGrid,
  openingOfLine: (moves) => openingOfLine(moves, fullBook()),
  structureOf: (fen) => structureOf(fen, fullSkeletons()),
};

/* A test-only entry that hands each lib function to the test. */
export const PROBE = `
import { CATEGORIES, imbalancesOf } from "./lib/imbalances.ts";
import { readLine } from "./lib/lines.ts";
import { lineKeys, openingOfLine, pawnKey, positionAfter, structureOf } from "./lib/openings.ts";
import { bookFor, skeletonsFor } from "./lib/store.ts";
import { pageUrl, theoryText, theoryTitles } from "./lib/theory.ts";
import { explorerAnswer, playerFilter, ratedGrid } from "./lib/explorer.ts";

export const run = async (input, ctx) => {
  const a = input.args;
  switch (input.fn) {
    case "imbalancesOf": return imbalancesOf(a[0]);
    case "CATEGORIES": return CATEGORIES;
    case "readLine": return readLine(a[0], a[1]);
    case "openingOfLine": return openingOfLine(a[0], await bookFor(ctx.deps.db, lineKeys(a[0])));
    case "positionAfter": return positionAfter(a[0]);
    case "structureOf": return structureOf(a[0], await skeletonsFor(ctx.deps.db, pawnKey(a[0])));
    case "theoryTitles": return theoryTitles(a[0]);
    case "theoryText": return theoryText(a[0]);
    case "pageUrl": return pageUrl(a[0]);
    case "explorerAnswer": return explorerAnswer(a[0]);
    case "playerFilter": return playerFilter(a[0]);
    case "ratedGrid": return ratedGrid(a[0]);
  }
  throw new Error("no such function " + input.fn);
};
`;

function guestLib(): Lib {
  let db: FakeDb | undefined;
  const run = (fn: string) => (...args: unknown[]) => {
    db ??= new FakeDb();
    // JSON has no undefined; the guest reads null the same way.
    return call(buildGuest(PROBE), "probe.run", { fn, args: args.map((x) => (x === undefined ? null : x)) }, {
      host: chessHost(db, () => {
        throw new Error("no engine here");
      }),
    }) as never;
  };
  return {
    name: "guest",
    imbalancesOf: run("imbalancesOf"),
    get CATEGORIES() {
      return run("CATEGORIES")() as readonly string[];
    },
    readLine: run("readLine"),
    openingOfLine: run("openingOfLine"),
    positionAfter: run("positionAfter"),
    structureOf: run("structureOf"),
    theoryTitles: run("theoryTitles"),
    theoryText: run("theoryText"),
    pageUrl: run("pageUrl"),
    explorerAnswer: run("explorerAnswer"),
    playerFilter: run("playerFilter"),
    ratedGrid: run("ratedGrid"),
  };
}

/** Node always; the guest when the appliance's build tooling is there to build it. */
export const libs: Lib[] = hasTooling ? [nodeLib, guestLib()] : [nodeLib];
