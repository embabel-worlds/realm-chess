/* What a position and a game line are on their own: their imbalances and the opening the book calls them. */
import type { HandlerSpec } from "@embabel/realm-types";
import { z } from "zod";

/*
 * What the graph's producers send and expect back. A captured producer sends the anchor keys it is
 * fetching for as one list. A paged producer expects `{ rows, next }` back; one with no page
 * expects the rows as a plain list. The other concern modules build their producer handlers from these.
 */

/** A list of anchor keys the host is fetching for, at most 256 of them. */
const keys = (description: string) => z.array(z.string().min(1).max(2048)).min(1).max(256).describe(description);

/** The Position FENs a producer is fetching for. */
export const fens = keys("The Position FENs the host is fetching for.");

/** The GameLine move lists a producer is fetching for. */
export const lines = keys("The GameLine move lists the host is fetching for: SAN from the start, space-separated.");

/** This realm's own next cursor, which the host sends back for the next page. */
export const cursor = z.string().max(8).describe("This realm's own next cursor, resent by the host.");

/** What a paged producer's handler answers: one page of rows and the next cursor. */
export const rows = z.object({});

/** What an unpaged producer's handler answers: every row, as a list. */
export const rowList = z.array(z.object({}));

/** One position's imbalances, as positionImbalances returns them. */
export const imbalancesRecord = z.object({
  fen: z.string(),
  sideToMove: z.string(),
  phase: z.string(),
  facts: z.string(),
  structure: z.string(),
  materialWhite: z.number(),
  materialBlack: z.number(),
  bishopPairWhite: z.boolean(),
  bishopPairBlack: z.boolean(),
  isolatedQueenPawnWhite: z.boolean(),
  isolatedQueenPawnBlack: z.boolean(),
  passedWhite: z.string(),
  passedBlack: z.string(),
  openFiles: z.string(),
  oppositeSideCastling: z.boolean(),
  oppositeColouredBishops: z.boolean(),
  detail: z.string(),
});

/** One named opening from the book, as openingLookup returns it. */
export const openingRecord = z.object({
  fen: z.string(),
  eco: z.string(),
  name: z.string(),
  pgn: z.string(),
});

/** The deepest named opening along one game line, as openingOfGameLine returns it. */
export const lineOpeningRecord = z.object({
  line: z.string(),
  namedAtPly: z.number(),
  pliesPast: z.number(),
  fen: z.string(),
  eco: z.string(),
  name: z.string(),
  pgn: z.string(),
});

export const positionImbalances = {
  namespace: "chess",
  description:
    "Jeremy Silman's imbalances for each position: material, minor pieces, pawn structure, space, files, key squares, development and king safety.",
  input: z.object({ fens: z.array(z.string()) }),
  output: z.array(imbalancesRecord),
} satisfies HandlerSpec;

export const openingLookup = {
  namespace: "chess",
  description: "The named opening each position is, from the Lichess opening book. A position the book does not name returns nothing.",
  input: z.object({ fens: z.array(z.string()) }),
  output: z.array(openingRecord),
} satisfies HandlerSpec;

export const openingOfGameLine = {
  namespace: "chess",
  description:
    "The deepest named opening along each game line (SAN from the start): the name a game keeps after it leaves the book. A line the book never names returns nothing.",
  input: z.object({ lines: z.array(z.string()) }),
  output: z.array(lineOpeningRecord),
} satisfies HandlerSpec;

export const rowsImbalances = {
  namespace: "chess",
  description: "Silman's imbalances of each position the host names, as PositionImbalances rows.",
  input: z.strictObject({ fens }),
  output: rowList,
} satisfies HandlerSpec;

export const rowsOpeningOfPosition = {
  namespace: "chess",
  description: "The book's name for each position the host names, as Opening rows. A position the book does not name has none.",
  input: z.strictObject({ fens }),
  output: rowList,
} satisfies HandlerSpec;

export const rowsOpeningOfLine = {
  namespace: "chess",
  description: "The deepest book name along each game line the host names, as Opening rows.",
  input: z.strictObject({ lines }),
  output: rowList,
} satisfies HandlerSpec;

/** The position handlers, in the order the realm declares them. */
export const positionHandlers = {
  positionImbalances,
  openingLookup,
  openingOfGameLine,
  rowsImbalances,
  rowsOpeningOfPosition,
  rowsOpeningOfLine,
};
