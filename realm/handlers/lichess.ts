/* What people played from a position on Lichess: masters, one chosen player, and every rating band. */
import type { HandlerSpec } from "@embabel/realm-types";

export const mastersAtPosition = {
  namespace: "chess",
  description:
    "What masters played from each position — every move with its game count and results — and the top master games through it. One request per position feeds both: the moves (MASTERS_PLAYED) and the games (MASTER_GAME). Needs the Lichess token.",
  input: { type: "object", properties: { fens: { type: "array", items: { type: "string" } } }, required: ["fens"] },
  output: {
    type: "object",
    properties: {
      moves: {
        type: "array",
        items: {
          type: "object",
          properties: {
            moveId: { type: "string" },
            fen: { type: "string" },
            uci: { type: "string" },
            san: { type: "string" },
            games: { type: "number" },
            white: { type: "number" },
            draws: { type: "number" },
            black: { type: "number" },
            whiteWinPct: { type: "number" },
            drawPct: { type: "number" },
            blackWinPct: { type: "number" },
            scoreForMover: { type: "number" },
            averageRating: { type: "number" },
            player: { type: "string" },
            color: { type: "string" },
          },
          required: ["moveId", "fen", "uci", "san", "games", "white", "draws", "black", "player", "color"],
        },
      },
      games: {
        type: "array",
        items: {
          type: "object",
          properties: {
            gameId: { type: "string" },
            fen: { type: "string" },
            uci: { type: "string" },
            white: { type: "string" },
            whiteElo: { type: "number" },
            black: { type: "string" },
            blackElo: { type: "number" },
            result: { type: "string" },
            year: { type: "number" },
            month: { type: "string" },
            speed: { type: "string" },
            url: { type: "string" },
            player: { type: "string" },
            color: { type: "string" },
          },
          required: ["gameId", "fen", "uci", "white", "black", "result", "month", "speed", "url", "player", "color"],
        },
      },
    },
    required: ["moves", "games"],
  },
} satisfies HandlerSpec;

export const rowsMasterMoves = {
  namespace: "chess",
  description:
    "What masters played from each position the host names, as MasterMove rows. Shares one kept Lichess answer with rowsMasterGames.",
  input: {
    type: "object",
    properties: {
      fens: {
        minItems: 1,
        maxItems: 256,
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 2048 },
        description: "The Position FENs the host is fetching for.",
      },
      cursor: { type: "string", maxLength: 8, description: "This realm's own next cursor, resent by the host." },
    },
    required: ["fens"],
    additionalProperties: false,
  },
  output: { type: "object" },
} satisfies HandlerSpec;

export const rowsMasterGames = {
  namespace: "chess",
  description:
    "The top master games through each position the host names, as MasterGame rows. Shares one kept Lichess answer with rowsMasterMoves.",
  input: {
    type: "object",
    properties: {
      fens: {
        minItems: 1,
        maxItems: 256,
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 2048 },
        description: "The Position FENs the host is fetching for.",
      },
      cursor: { type: "string", maxLength: 8, description: "This realm's own next cursor, resent by the host." },
    },
    required: ["fens"],
    additionalProperties: false,
  },
  output: { type: "object" },
} satisfies HandlerSpec;

export const playerAtPosition = {
  namespace: "chess",
  description:
    "What one Lichess player played from each position, as one colour — every move with its results — and their recent games through it (PLAYER_PLAYED, PLAYER_GAME). Covers the player's whole Lichess history in one request. Needs the Lichess token.",
  input: {
    type: "object",
    properties: { fens: { type: "array", items: { type: "string" } }, filters: { type: "string" } },
    required: ["fens"],
  },
  output: {
    type: "object",
    properties: {
      moves: {
        type: "array",
        items: {
          type: "object",
          properties: {
            moveId: { type: "string" },
            fen: { type: "string" },
            uci: { type: "string" },
            san: { type: "string" },
            games: { type: "number" },
            white: { type: "number" },
            draws: { type: "number" },
            black: { type: "number" },
            whiteWinPct: { type: "number" },
            drawPct: { type: "number" },
            blackWinPct: { type: "number" },
            scoreForMover: { type: "number" },
            averageRating: { type: "number" },
            player: { type: "string" },
            color: { type: "string" },
          },
          required: ["moveId", "fen", "uci", "san", "games", "white", "draws", "black", "player", "color"],
        },
      },
      games: {
        type: "array",
        items: {
          type: "object",
          properties: {
            gameId: { type: "string" },
            fen: { type: "string" },
            uci: { type: "string" },
            white: { type: "string" },
            whiteElo: { type: "number" },
            black: { type: "string" },
            blackElo: { type: "number" },
            result: { type: "string" },
            year: { type: "number" },
            month: { type: "string" },
            speed: { type: "string" },
            url: { type: "string" },
            player: { type: "string" },
            color: { type: "string" },
          },
          required: ["gameId", "fen", "uci", "white", "black", "result", "month", "speed", "url", "player", "color"],
        },
      },
    },
    required: ["moves", "games"],
  },
} satisfies HandlerSpec;

export const rowsPlayerMoves = {
  namespace: "chess",
  description:
    "What the pinned Lichess players played from each position, in the pinned colours (White when none is pinned), as PlayerMove rows.",
  input: {
    type: "object",
    properties: {
      fens: {
        minItems: 1,
        maxItems: 256,
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 2048 },
        description: "The Position FENs the host is fetching for.",
      },
      player: {
        maxItems: 64,
        type: "array",
        items: { type: "string", maxLength: 64 },
        description: "The Lichess usernames the query pinned.",
      },
      color: {
        maxItems: 64,
        type: "array",
        items: { type: "string", maxLength: 64 },
        description: "The colours the query pinned: white or black.",
      },
      cursor: { type: "string", maxLength: 8, description: "This realm's own next cursor, resent by the host." },
    },
    required: ["fens"],
    additionalProperties: false,
  },
  output: { type: "object" },
} satisfies HandlerSpec;

export const rowsPlayerGames = {
  namespace: "chess",
  description:
    "The pinned Lichess players' recent games through each position, in the pinned colours (White when none is pinned), as PlayerGame rows.",
  input: {
    type: "object",
    properties: {
      fens: {
        minItems: 1,
        maxItems: 256,
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 2048 },
        description: "The Position FENs the host is fetching for.",
      },
      player: {
        maxItems: 64,
        type: "array",
        items: { type: "string", maxLength: 64 },
        description: "The Lichess usernames the query pinned.",
      },
      color: {
        maxItems: 64,
        type: "array",
        items: { type: "string", maxLength: 64 },
        description: "The colours the query pinned: white or black.",
      },
      cursor: { type: "string", maxLength: 8, description: "This realm's own next cursor, resent by the host." },
    },
    required: ["fens"],
    additionalProperties: false,
  },
  output: { type: "object" },
} satisfies HandlerSpec;

export const ratedMoves = {
  namespace: "chess",
  description:
    "How often each move is played from a position by rating band and time control on Lichess, and how it scores.",
  input: {
    type: "object",
    properties: { fens: { type: "array", items: { type: "string" } }, filters: { type: "string" } },
    required: ["fens"],
  },
  output: {
    type: "array",
    items: {
      type: "object",
      properties: {
        rowId: { type: "string" },
        fen: { type: "string" },
        band: { type: "string" },
        bandLabel: { type: "string" },
        speed: { type: "string" },
        san: { type: "string" },
        uci: { type: "string" },
        games: { type: "number" },
        share: { type: "number" },
        whiteWinPct: { type: "number" },
        drawPct: { type: "number" },
        blackWinPct: { type: "number" },
        scoreForMover: { type: "number" },
        bandGames: { type: "number" },
      },
      required: ["rowId", "fen", "band", "bandLabel", "speed", "san", "uci", "games", "bandGames"],
    },
  },
} satisfies HandlerSpec;

export const rowsRatedMoves = {
  namespace: "chess",
  description:
    "How often each move is played from each position by rating band and time control on Lichess, one request per band and time control, as RatedMove rows.",
  input: {
    type: "object",
    properties: {
      fens: {
        minItems: 1,
        maxItems: 256,
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 2048 },
        description: "The Position FENs the host is fetching for.",
      },
      band: {
        maxItems: 64,
        type: "array",
        items: { type: "string", maxLength: 64 },
        description: "The rating band floors the query pinned: 0, 1000, 1200, 1400, 1600, 1800, 2000, 2200 or 2500.",
      },
      speed: {
        maxItems: 64,
        type: "array",
        items: { type: "string", maxLength: 64 },
        description: "The time controls the query pinned, or all.",
      },
      cursor: { type: "string", maxLength: 8, description: "This realm's own next cursor, resent by the host." },
    },
    required: ["fens"],
    additionalProperties: false,
  },
  output: { type: "object" },
} satisfies HandlerSpec;

/** The Lichess handlers, in the order the realm declares them. */
export const lichessHandlers = {
  mastersAtPosition,
  rowsMasterMoves,
  rowsMasterGames,
  playerAtPosition,
  rowsPlayerMoves,
  rowsPlayerGames,
  ratedMoves,
  rowsRatedMoves,
};
