import type { CapturedProducerSpec } from "@embabel/realm-types";

/*
 * Each relationship from a Position or a GameLine, as a captured producer. The names are
 * internal and lowercase, as the host requires; the labels and relationships are the graph's own.
 */
const join = (targetLabel: string, anchorLabel: string, relationship: string, keyField: string, recordKeyField: string) => ({
  targetLabel, anchorLabel, relationship, keyField, recordKeyField,
});

export const producers = {
  "position-imbalances": {
    handler: "chess.rowsImbalances" as const,
    keyArgument: "fens",
    joins: [join("PositionImbalances", "Position", "HAS_IMBALANCES", "fen", "fen")],
  },
  "opening-lookup": {
    handler: "chess.rowsOpeningOfPosition" as const,
    keyArgument: "fens",
    joins: [join("Opening", "Position", "IN_OPENING", "fen", "fen")],
  },
  "opening-of-game-line": {
    handler: "chess.rowsOpeningOfLine" as const,
    keyArgument: "lines",
    joins: [join("Opening", "GameLine", "IN_OPENING", "moves", "line")],
  },
  // About six new positions a page at three seconds a search; sixteen pages is the host's most.
  "candidate-lines": {
    handler: "chess.rowsCandidates" as const,
    keyArgument: "fens",
    joins: [join("CandidateMove", "Position", "HAS_CANDIDATE", "fen", "fen")],
    page: { argument: "cursor", maxPages: 16 },
  },
} satisfies Record<string, CapturedProducerSpec>;
