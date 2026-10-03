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
  // Theory along a game line: two wikibook requests a line, so a page serves what fits.
  "theory-of-game-line": {
    handler: "chess.rowsTheory" as const,
    keyArgument: "lines",
    joins: [join("OpeningTheory", "GameLine", "HAS_THEORY", "moves", "line")],
    page: { argument: "cursor", maxPages: 16 },
  },
  // Plans: a search and a model call or two a position, so one position a page.
  "position-plans": {
    handler: "chess.rowsPositionPlans" as const,
    keyArgument: "fens",
    joins: [join("Plan", "Position", "HAS_PLAN", "fen", "fen")],
    pushdown: [{ property: "level", argument: "level" }],
    page: { argument: "cursor", maxPages: 16 },
  },
  "line-plans": {
    handler: "chess.rowsLinePlans" as const,
    keyArgument: "lines",
    joins: [join("Plan", "GameLine", "HAS_PLAN", "moves", "line")],
    pushdown: [{ property: "level", argument: "level" }],
    page: { argument: "cursor", maxPages: 16 },
  },
  // The Lichess explorer, one request a position or a cell, 1.1 seconds apart.
  "master-moves": {
    handler: "chess.rowsMasterMoves" as const,
    keyArgument: "fens",
    joins: [join("MasterMove", "Position", "MASTERS_PLAYED", "fen", "fen")],
    page: { argument: "cursor", maxPages: 16 },
  },
  "master-games": {
    handler: "chess.rowsMasterGames" as const,
    keyArgument: "fens",
    joins: [join("MasterGame", "Position", "MASTER_GAME", "fen", "fen")],
    page: { argument: "cursor", maxPages: 16 },
  },
  "player-moves": {
    handler: "chess.rowsPlayerMoves" as const,
    keyArgument: "fens",
    joins: [join("PlayerMove", "Position", "PLAYER_PLAYED", "fen", "fen")],
    pushdown: [{ property: "player", argument: "player" }, { property: "color", argument: "color" }],
    page: { argument: "cursor", maxPages: 16 },
  },
  "player-games": {
    handler: "chess.rowsPlayerGames" as const,
    keyArgument: "fens",
    joins: [join("PlayerGame", "Position", "PLAYER_GAME", "fen", "fen")],
    pushdown: [{ property: "player", argument: "player" }, { property: "color", argument: "color" }],
    page: { argument: "cursor", maxPages: 16 },
  },
  "rated-moves": {
    handler: "chess.rowsRatedMoves" as const,
    keyArgument: "fens",
    joins: [join("RatedMove", "Position", "PLAYED_AT_RATING", "fen", "fen")],
    pushdown: [{ property: "band", argument: "band" }, { property: "speed", argument: "speed" }],
    page: { argument: "cursor", maxPages: 16 },
  },
  // Keyed by the owner's username: the host sends the AssistantUser usernames it is fetching for
  // and each row carries its username back as the key.
  "chess-status": {
    handler: "chess.status" as const,
    keyArgument: "username",
    joins: [join("ChessStatus", "AssistantUser", "HAS_CHESS_STATUS", "username", "username")],
  },
} satisfies Record<string, CapturedProducerSpec>;
