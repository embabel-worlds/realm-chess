import { defineRealm } from "@embabel/realm-types";
import { appHandlers } from "./realm/app-handlers.ts";
import { producerHandlers } from "./realm/handlers.ts";
import { producers } from "./realm/producers.ts";
import { rodHandlers } from "./realm/rod-handlers.ts";
import { rodTypes } from "./realm/types.ts";
import { views } from "./realm/views.ts";
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
  skills: ["chess-plans"],
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
    "ChessStatus",
  ],

  handlers: { ...rodHandlers, ...producerHandlers, ...appHandlers },

  apps: {
    "chesscalator.html": {
      handlers: ["chess.appPosition", "chess.appPractice", "chess.appPlans"],
      resources: [
        "apps/chesscalator.html.assets/board.css",
        "apps/chesscalator.html.assets/chesscalator.css",
        "apps/chesscalator.html.assets/board.js",
      ],
    },
  },

  types: {
    ...rodTypes,
    CandidateMove: {
      ...rodTypes.CandidateMove,
      properties: {
        ...rodTypes.CandidateMove.properties,
        analysisId:
          "What the line belongs to: the hash of the engine, how it searched and the lines it found. Once the background tick has searched the position deeper, the rows are the deeper search's and carry its id.",
        nodes: "Positions the engine searched for this analysis.",
      },
    },
    Plan: {
      ...rodTypes.Plan,
      properties: {
        ...rodTypes.Plan.properties,
        analysisId:
          "The engine analysis these plans were made from: the position's own search at the full budget. It is the id of the position's CandidateMove rows until the background tick searches it deeper; then the candidates carry the deeper search's id and the plans keep the one they were made from, so the model is not asked again.",
      },
    },
    ChessStatus: {
      description:
        "What the realm could not do, as it last recorded it. Reached from the owner via HAS_CHESS_STATUS. It knows only what a finished call recorded: a call that died records nothing, and a refused Lichess call does not say why.",
      properties: {
        username: { description: "The owner. Identity.", metadata: { identity: "true" } },
        lichess: "`ok`, `refused` or `unknown`: how the last Lichess call went.",
        model: "`ok`, `not_granted` or `unknown`: whether the last model call was allowed.",
        lastRefusal: "The code of the last refusal a handler saw, or empty.",
        at: "When the last outcome was recorded.",
      },
    },
  },

  producers,

  views,

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
      url: "lichess.yml",
      type: "openapi",
      name: "lichess",
      auth: "bearer",
      credential: "lichess",
      operationIds: ["mastersExplorer", "lichessExplorer", "playerExplorer"],
      // playerExplorer streams NDJSON. The host reads an undeclared reply as JSON, so it is declared.
      operations: { playerExplorer: { response: "ndjson" } },
    },
    wikibooks: {
      url: "wikibooks.yml",
      type: "openapi",
      name: "wikibooks",
      // The wikibook is public: the host calls it with no credential, once the owner approves the API.
      auth: "none",
      operationIds: ["wikibooksQuery"],
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
      migrations: ["db/0001-openings.sql", "db/0002-skeletons.sql", "db/0003-status.sql", "db/0004-lichess.sql", "db/0005-app.sql", "db/0006-deepen.sql", "db/0007-deepen-slots.sql", "db/0008-deep-failures.sql", "db/0009-requeue-deepen.sql"],
    },
    /** Stockfish 19 lite from the registry. How long it searches is in wasm/lib/config.ts. */
    engine: {
      ...ENGINE_MODULE,
      methods: { analyse: { args: ["string", "i32", "i32", "i32"], returns: "string" } },
    },
  },
});
