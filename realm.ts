import { defineRealm } from "@embabel/realm-types";
import { producerHandlers } from "./realm/handlers.ts";
import { producers } from "./realm/producers.ts";
import { rodHandlers } from "./realm/rod-handlers.ts";
import { rodTypes } from "./realm/types.ts";
import { rodViews } from "./realm/views.ts";
import { ENGINE_MODULE } from "./wasm/lib/config.ts";

/**
 * Chess, as a captured realm: the handlers run as Wasm inside the appliance, the engine is the
 * stockfish registry module, and what the realm computes is kept in its own SQLite.
 *
 * `npm run synth` writes realm.yml, credentials.yml, apis/apis.yml, producers/, types/, views/,
 * dependencies/ and dist/manifest.json from this file. Edit this file, never those.
 */
export default defineRealm({
  name: "chess",
  host: "wasm",
  execution: "captured",
  version: "0.5.0",
  maturity: "experimental",
  description: `A chessboard, a strong engine, and the plans a position calls for.

Stockfish 19, compiled to WebAssembly and running in the appliance's own sandbox, gives the best
lines, each saying how deep it searched. The position's imbalances, in Jeremy Silman's sense, are
computed from the board: material, the minor pieces, pawn structure, space, files, outposts,
development, king safety. The Lichess opening book names it, along the game's moves, so a line
keeps its name long after it leaves the book.

Everything is a Virtual Cypher hop from a pinned Position (HAS_IMBALANCES, IN_OPENING,
HAS_CANDIDATE) or GameLine (IN_OPENING), so the analysis is a query and a REST call, not only a
page. The engine is GPL-3.0, and so is this realm.`,
  url: "https://github.com/embabel-worlds/realm-chess",
  author: "Rod Johnson",
  tags: ["chess", "games", "engine", "virtual-cypher", "apps", "skills"],
  capabilities: ["model"],
  exports: [
    "chess",
    "lichess",
    "Position",
    "GameLine",
    "PositionImbalances",
    "Opening",
    "CandidateMove",
    "Plan",
    "OpeningTheory",
    "MasterMove",
    "MasterGame",
    "PlayerMove",
    "PlayerGame",
    "RatedMove",
    "BestMoves",
    "ImbalancesOf",
    "OpeningOf",
    "PlansInPosition",
    "OpeningOfLine",
    "PlansInLine",
    "TheoryOfLine",
    "MastersAtPosition",
    "MasterGamesAtPosition",
    "PlayerAtPosition",
    "PlayerGamesAtPosition",
    "MovesByRating",
    "MovesByTimeControl",
  ],

  handlers: { ...rodHandlers, ...producerHandlers },

  types: {
    ...rodTypes,
    CandidateMove: {
      ...rodTypes.CandidateMove,
      properties: {
        ...rodTypes.CandidateMove.properties,
        analysisId:
          "What the line belongs to: the hash of the engine, how it searched and the lines it found. Plans made from these lines carry the same id.",
        nodes: "Positions the engine searched for this analysis.",
      },
    },
  },

  producers,

  views: rodViews,

  credentials: {
    lichess: {
      kind: "bearer",
      provider: "Lichess",
      docs: "https://lichess.org/account/oauth/token",
      description: "A Lichess personal API token, no scopes needed: master games and a player's own games by position.",
    },
  },

  apis: {
    lichess: {
      url: "lichess.json",
      type: "openapi",
      name: "lichess",
      auth: "bearer",
      credential: "lichess",
      operationIds: ["mastersExplorer", "lichessExplorer", "playerExplorer"],
      operations: { playerExplorer: { response: "ndjson" } },
    },
  },

  dependencies: {
    /** The realm's own SQLite: the opening book and every result it keeps. Tables in db/schema.sql. */
    db: {
      module: "sqlite3-wasi",
      version: "3.53",
      sha256: "9a5542e25e42fbbb48501bae0ab4295cdf0fd0f41219ec3b6c891c4a282e7779",
      persistent: true,
      init: "db/schema.sql",
      migrations: ["db/0001-openings.sql", "db/0002-skeletons.sql"],
    },
    /** Stockfish 19 lite from the registry. How long it searches is in wasm/lib/config.ts. */
    engine: {
      ...ENGINE_MODULE,
      methods: { analyse: { args: ["string", "i32", "i32", "i32"], returns: "string" } },
    },
  },
});
