import type { CapturedProducerSpec } from "@embabel/realm-types";

/*
 * Each relationship Rod's types hung off a Position or a GameLine, as a captured producer. The
 * names are internal and lowercase, as the host requires; labels and relationships are his.
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
} satisfies Record<string, CapturedProducerSpec>;
