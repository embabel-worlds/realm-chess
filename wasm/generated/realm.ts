// Generated from realm.ts by @embabel/realm-synth. Do not edit.
// Realm: chess (0.5.0)

/** One of the engine's best lines in a position (Stockfish 19, five lines, depth 18). Reached from Position via HAS_CANDIDATE. THE SCORE IS FOR THE SIDE TO MOVE; `whiteCp` is the same from White's side. `lossCp` is how much worse than the best line this one is, in centipawns — the ONLY field to filter on for 'moves within half a pawn of best' (lossCp <= 50; a pawn is 100). `rank` is the engine's order, 1 to 5. `creates` and `removes` say which imbalances the line changes once its exchanges settle — the best evidence of what a move is for. */
export interface CandidateMove {
  /** What the line belongs to: the hash of the engine, how it searched and the lines it found. Plans made from these lines carry the same id. */
  analysisId?: string;
  /** The FEN and the first move in UCI. Identity: stable across searches, where the rank is not. */
  candidateId?: string;
  /** Imbalances the line creates once its exchanges settle, one sentence per line. */
  creates?: string;
  /** Search depth reached, in plies. */
  depth?: string;
  /** Engine time for the position, in milliseconds. */
  elapsedMs?: string;
  /** Which engine produced the line. */
  engine?: string;
  /** The position this line was computed in. */
  fen?: string;
  /** Centipawns worse than the best line; 0 for the best. 'Within half a pawn' is lossCp <= 50. Null when the best line is a mate and this one is not. */
  lossCp?: string;
  /** Moves to mate, positive when the side to move mates. Null otherwise. */
  mate?: string;
  /** Positions the engine searched for this analysis. */
  nodes?: string;
  /** The whole line in SAN, space-separated. */
  pvSan?: string;
  /** The whole line in UCI. */
  pvUci?: string;
  /** The engine's order: 1 is its best, up to 5. Sort by it; never filter on it for 'within N pawns of best' — that is lossCp. */
  rank?: string;
  /** Imbalances the line removes. */
  removes?: string;
  /** First move in standard notation, e.g. `g4`. */
  san?: string;
  /** Centipawns for the side to move (100 = a pawn). Null when the line is a forced mate. */
  scoreCp?: string;
  /** `white` or `black`: who plays this move. */
  side?: string;
  /** First move in UCI, e.g. `g2g4`. */
  uci?: string;
  /** The same score from White's point of view. Null for mates. */
  whiteCp?: string;
}

/** What the realm could not do, as it last recorded it. Reached from the owner via HAS_CHESS_STATUS. It knows only what a finished call recorded: a call that died records nothing, and a refused Lichess call does not say why. */
export interface ChessStatus {
  /** When the last outcome was recorded. */
  at?: string;
  /** The code of the last refusal a handler saw, or empty. */
  lastRefusal?: string;
  /** `ok`, `refused` or `unknown`: how the last Lichess call went. */
  lichess?: string;
  /** `ok`, `not_granted` or `unknown`: whether the last model call was allowed. */
  model?: string;
  /** The owner. Identity. */
  username?: string;
}

/** A game as its moves from the starting position, in SAN, space-separated — e.g. `e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6`. Pin one with `MATCH (g:GameLine {moves: $moves})`. A line keeps the name of the deepest book position it passed through, which a position looked up alone loses once it leaves the book: this is how a game twenty moves into the Exchange Ruy Lopez is still called that. */
export interface GameLine {
  /** SAN moves from the start, space-separated. Identity. */
  moves?: string;
}

/** A top master game through a position, from the Lichess masters database: who played it, when, the result, and the move played from the position. Reached from Position via MASTER_GAME. */
export interface MasterGame {
  /** Black's name. */
  black?: string;
  /** Black's rating. */
  blackElo?: string;
  /** The position the game passed through. */
  fen?: string;
  /** The position and the Lichess game id. Identity. */
  gameId?: string;
  /** Month played, YYYY-MM. */
  month?: string;
  /** 1-0, 0-1 or ½-½. */
  result?: string;
  /** Time control class, for a Lichess game. */
  speed?: string;
  /** The move played from it in this game, in notation (e.g. Ba4). */
  uci?: string;
  /** The game on Lichess. */
  url?: string;
  /** White's name. */
  white?: string;
  /** White's rating. */
  whiteElo?: string;
  /** Year played. */
  year?: string;
}

/** A move masters played from a position, with how often and how it scored — from the Lichess masters database (over-the-board games, players rated 2200+). Reached from Position via MASTERS_PLAYED. `scoreForMover` is the side-that-played-it's points per game. This is practice, not analysis: compare it with the engine's CandidateMove lines, and where they disagree, both are worth saying. */
export interface MasterMove {
  /** Average rating of the players (masters), or of the opponents (a player's games). */
  averageRating?: string;
  /** Won by Black. */
  black?: string;
  /** Percent won by Black. */
  blackWinPct?: string;
  /** Percent drawn. */
  drawPct?: string;
  /** Drawn. */
  draws?: string;
  /** The position. */
  fen?: string;
  /** Games in which it was played here. */
  games?: string;
  /** The position and the move. Identity. */
  moveId?: string;
  /** The move in notation. */
  san?: string;
  /** Points per game for the side that played the move (1 a win, 0.5 a draw): how the move has scored for whoever chose it. */
  scoreForMover?: string;
  /** The move in UCI. */
  uci?: string;
  /** Of those, won by White. */
  white?: string;
  /** Percent won by White. */
  whiteWinPct?: string;
}

/** The named opening a position is, from the Lichess opening book (3,815 named lines, CC0). Only a position that IS a book position has one — a position deeper than the book returns none. Reached from Position via IN_OPENING. */
export interface Opening {
  /** ECO code, e.g. `C68`. */
  eco?: string;
  /** The position. Identity. */
  fen?: string;
  /** For an opening reached from a GameLine: the line's moves. */
  line?: string;
  /** The opening's name, e.g. `Ruy Lopez: Exchange Variation`. */
  name?: string;
  /** For a GameLine: the ply at which the book last named the line. */
  namedAtPly?: string;
  /** The moves that reach it. */
  pgn?: string;
  /** For a GameLine: how many plies the line has gone past that name. */
  pliesPast?: string;
}

/** What opening theory says along a game line: the text of the deepest page of the Chess Opening Theory wikibook (CC BY-SA 4.0) that the line reaches — the wikibook keeps a page per move sequence, deep into the main lines, and its prose says what each side is playing for. Reached from GameLine via HAS_THEORY. A line the wikibook has no page for returns nothing. Quote it with its title and licence. */
export interface OpeningTheory {
  /** Attribution and licence to show with the text. */
  licence?: string;
  /** The game line. Identity. */
  line?: string;
  /** How many plies of the line the page covers. */
  pliesCovered?: string;
  /** How many plies the line has gone past the page. */
  pliesPast?: string;
  /** The page's theory as plain text, up to about 3,000 characters. */
  theory?: string;
  /** The wikibook page, e.g. `Chess Opening Theory/1. e4/1...e5/2. Nf3/2...Nc6/3. Bb5/3...a6/4. Bxc6`. */
  title?: string;
  /** Link to the page. */
  url?: string;
}

/** A plan for one side in a position: what it should be trying to achieve and why, with its key moves, the imbalances it uses and which of the engine's candidate moves carry it. Decided by a model with the chess-plans skill, from the position's imbalances, opening and engine lines — a judgement, not a computation. Reached from Position via HAS_PLAN; up to three per side, `priority` 1 first. `summary` is the same on every plan of a position: who stands better and how the plans meet. Costs one engine search and one model call per new position. */
export interface Plan {
  /** The engine analysis these plans were made from: the same id as the CandidateMove rows they describe. */
  analysisId?: string;
  /** Which of the engine's candidate moves carry the plan. */
  engineEvidence?: string;
  /** The position. */
  fen?: string;
  /** What the plan achieves and why the position calls for it. */
  idea?: string;
  /** The imbalances the plan exploits or repairs, one per line. */
  imbalances?: string;
  /** Who the plans were written for: `beginner`, `intermediate` or `expert`. Filter on it — `WHERE pl.level = 'beginner'` — to ask for that level; it is passed to the model, and each level is judged and cached separately. */
  level?: string;
  /** For plans reached from a GameLine: the line's moves. */
  line?: string;
  /** The model role that judged it. */
  model?: string;
  /** Key moves and manoeuvres, in notation. */
  moves?: string;
  /** The plan in a few words. */
  name?: string;
  /** The book name of the position, if it has one. */
  opening?: string;
  /** The position, side, priority and plan name. Identity. */
  planId?: string;
  /** 1 is the side's most important plan. */
  priority?: string;
  /** `white` or `black`. */
  side?: string;
  /** The row of the chess-plans skill's structure table the model judged this to be, or `none`. */
  structure?: string;
  /** Who stands better and why, and how the two sides' plans meet. */
  summary?: string;
}

/** A recent game of one Lichess player through a position, as one colour. Reached from Position via PLAYER_GAME; asked with the player and colour, like PlayerMove. */
export interface PlayerGame {
  /** Black's name. */
  black?: string;
  /** Black's rating. */
  blackElo?: string;
  /** The colour the player had. */
  color?: string;
  /** The position the game passed through. */
  fen?: string;
  /** The position, player, colour and game id. Identity. */
  gameId?: string;
  /** Month played, YYYY-MM. */
  month?: string;
  /** The Lichess username asked about. */
  player?: string;
  /** 1-0, 0-1 or ½-½. */
  result?: string;
  /** Time control class, for a Lichess game. */
  speed?: string;
  /** The move played from it in this game, in notation (e.g. Ba4). */
  uci?: string;
  /** The game on Lichess. */
  url?: string;
  /** White's name. */
  white?: string;
  /** White's rating. */
  whiteElo?: string;
  /** Year played. */
  year?: string;
}

/** A move one Lichess player chose from a position, as one colour, with how it scored for them — from the Lichess player explorer, across their whole Lichess history. Reached from Position via PLAYER_PLAYED, and ALWAYS asked with the player and colour: `WHERE m.player = 'DrNykterstein' AND m.color = 'white'`. Without a player the hop returns nothing. */
export interface PlayerMove {
  /** Average rating of the players (masters), or of the opponents (a player's games). */
  averageRating?: string;
  /** Won by Black. */
  black?: string;
  /** Percent won by Black. */
  blackWinPct?: string;
  /** `white` or `black`: the colour the player had. Filter on it. */
  color?: string;
  /** Percent drawn. */
  drawPct?: string;
  /** Drawn. */
  draws?: string;
  /** The position. */
  fen?: string;
  /** Games in which it was played here. */
  games?: string;
  /** The position, player, colour and move. Identity. */
  moveId?: string;
  /** The Lichess username asked about. Filter on it. */
  player?: string;
  /** The move in notation. */
  san?: string;
  /** Points per game for the side that played the move (1 a win, 0.5 a draw): how the move has scored for whoever chose it. */
  scoreForMover?: string;
  /** The move in UCI. */
  uci?: string;
  /** Of those, won by White. */
  white?: string;
  /** Percent won by White. */
  whiteWinPct?: string;
}

/** A chess position, identified by its FEN. Rarely stored: pin one with `MATCH (p:Position {fen: $fen})` and its imbalances, opening, engine lines and plans are computed on demand. The FEN must be complete — six fields — because who is to move changes every score. */
export interface Position {
  /** Full FEN, e.g. `rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1`. Identity. */
  fen?: string;
}

/** Jeremy Silman's imbalances of a position — material, the minor pieces (bishop pair, good and bad bishops), pawn structure (doubled, isolated, backward, passed, hanging, isolated queen's pawn, majorities, locked chains and the wing they point to), space, open and half-open files, outposts, development and king safety. Computed from the board, not judged. Reached from Position via HAS_IMBALANCES. `facts` is one plain sentence per imbalance and is what to read. */
export interface PositionImbalances {
  /** Whether Black has the bishop pair. */
  bishopPairBlack?: string;
  /** Whether White has the bishop pair. */
  bishopPairWhite?: string;
  /** The whole computation as JSON. */
  detail?: string;
  /** Every imbalance, one sentence per line, White's then Black's then shared. Quote these. */
  facts?: string;
  /** The position. Identity. */
  fen?: string;
  /** Whether Black has an isolated d-pawn. */
  isolatedQueenPawnBlack?: string;
  /** Whether White has an isolated d-pawn. */
  isolatedQueenPawnWhite?: string;
  /** Black's material in points. */
  materialBlack?: string;
  /** White's material in points (pawn 1, knight and bishop 3, rook 5, queen 9). */
  materialWhite?: string;
  /** Files with no pawns, space-separated. */
  openFiles?: string;
  /** Whether each side has one bishop, on different colours, and no knights. */
  oppositeColouredBishops?: string;
  /** Whether the kings stand on opposite wings. */
  oppositeSideCastling?: string;
  /** Black's passed pawns. */
  passedBlack?: string;
  /** White's passed pawns, space-separated squares. */
  passedWhite?: string;
  /** `opening`, `middlegame` or `endgame`. */
  phase?: string;
  /** `white` or `black`. */
  sideToMove?: string;
  /** Which named opening's pawn structure this is — matched on the pawns alone against every line in the opening book, exactly or within two pawns. Empty when nothing is that close. */
  structure?: string;
}

/** How often a move is played from a position on Lichess, in one rating band and one time control, and how it scores — for comparing what players at different levels or speeds choose. Reached from Position via PLAYED_AT_RATING. Pin ONE dimension and the other is compared across: `WHERE m.speed = 'blitz'` returns every rating band in blitz; `WHERE m.band = '1600'` returns every time control at 1600; pin neither and every band over all time controls comes back (speed `all`). `share` is the move's percent of the games from the position in that band and time control — compare shares, not raw game counts, across bands. */
export interface RatedMove {
  /** Rating band floor as Lichess names it: 0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500. Filter on it. */
  band?: string;
  /** All games from the position in this band and time control. */
  bandGames?: string;
  /** The band as a person reads it: under 1000, 1000-1199, …, 2500+. */
  bandLabel?: string;
  /** Percent won by Black. */
  blackWinPct?: string;
  /** Percent drawn. */
  drawPct?: string;
  /** The position. */
  fen?: string;
  /** Games in which it was played, in this band and time control. */
  games?: string;
  /** Position, band, time control and move. Identity. */
  rowId?: string;
  /** The move in notation. */
  san?: string;
  /** Points per game for the side that played it. */
  scoreForMover?: string;
  /** Its percent of all games from the position in this band and time control. */
  share?: string;
  /** Time control: ultraBullet, bullet, blitz, rapid, classical, correspondence — or all. Filter on it. */
  speed?: string;
  /** The move in UCI. */
  uci?: string;
  /** Percent won by White. */
  whiteWinPct?: string;
}

/** Every domain type this realm contributes, keyed by label. */
export interface RealmTypes {
  CandidateMove: CandidateMove;
  ChessStatus: ChessStatus;
  GameLine: GameLine;
  MasterGame: MasterGame;
  MasterMove: MasterMove;
  Opening: Opening;
  OpeningTheory: OpeningTheory;
  Plan: Plan;
  PlayerGame: PlayerGame;
  PlayerMove: PlayerMove;
  Position: Position;
  PositionImbalances: PositionImbalances;
  RatedMove: RatedMove;
}

/**
 * The supplied type with every field the declaration does not have turned into `never`, so
 * an undeclared field is a compile error even when the value was built somewhere else
 * first: excess-property checking only ever looks at a literal written at the call.
 */
type OnlyDeclaredFields<Declared, Supplied> = {
  [Key in keyof Supplied]: Key extends keyof Declared
    ? OnlyDeclaredFieldValue<NonNullable<Declared[Key]>, Supplied[Key]>
    : never;
};

/**
 * One field's value, checked the same way a level further down when the declaration says
 * exactly which fields it has. A declaration that takes free-form keys — a proposal's
 * `fields`, a body the document left as any JSON object — takes whatever it always did, and
 * so does a scalar or an `unknown`. An array whose elements have a closed shape is checked
 * element by element the same way.
 */
type OnlyDeclaredFieldValue<Declared, Supplied> = Supplied extends null | undefined
  ? Supplied
  : [Supplied] extends [object]
    ? [Supplied] extends [readonly unknown[]]
      ? {
          [Index in keyof Supplied]: OnlyDeclaredFieldValue<
            DeclaredArrayElement<Declared>,
            Supplied[Index]
          >;
        }
      : [keyof Declared] extends [never]
        ? Supplied
        : string extends keyof Declared
          ? Supplied
          : OnlyDeclaredFields<Declared, Supplied>
    : Supplied;

/**
 * The element type of a declared array field, so an array field's elements get checked one
 * level further down instead of passing through untouched. Falls back to `unknown` — which
 * lets the element through as-is — when the declaration itself says nothing about elements,
 * the same free-form fallback the field-level check already gives an untyped body.
 */
type DeclaredArrayElement<Declared> = Declared extends readonly (infer Element)[]
  ? Element
  : unknown;

/** One event for the journal. */
export interface ChannelEventInput {
  /** Stable across retries: a retry with the same id, stream and payload is the same event. */
  eventId: string;
  streamId: string;
  /** An ISO instant. */
  occurredAt: string;
  payload: { [key: string]: unknown };
}

/** What `gateway.channel.publish` resolves to once the event is durably appended. */
export interface ChannelPublishReceipt {
  receiptId: string;
  /** Where the event landed in the source's sequence. */
  offset: number;
  /** True when the journal already held this event and handed the first receipt back. */
  replayed: boolean;
}

/** What `gateway.channel.publishBatch` resolves to: one offset per event, in order. */
export interface ChannelBatchReceipt {
  receiptId: string;
  offsets: number[];
  replayed: boolean;
}

/** The journal calls on `ctx.gateway.channel`. Each needs the matching source grant. */
export interface HostChannelGateway {
  /** Appends one event to one of this realm's sources. */
  publish(event: ChannelEventInput & { source: string }): Promise<ChannelPublishReceipt>;
  /**
   * Appends a page of events and moves the source's cursor in one step. A mismatched
   * `expectedPosition` refuses the batch. An empty event list may still move the cursor.
   */
  publishBatch(batch: {
    source: string;
    batchId: string;
    expectedPosition: string | null;
    nextPosition: string;
    events: ChannelEventInput[];
  }): Promise<ChannelBatchReceipt>;
  /** Reads where a source's cursor stands. Null before the first batch. */
  position(request: { source: string }): Promise<{ position: string | null }>;
}

/** Operations from lichess.json. */
interface LichessGateway {
  lichessExplorer(args?: Record<string, unknown>): Promise<unknown>;
  mastersExplorer(args?: Record<string, unknown>): Promise<unknown>;
  /** Reads a newline-delimited JSON stream: every complete record, and `truncated` when the host dropped an incomplete last line. */
  playerExplorer<T = unknown>(args?: Record<string, unknown>): Promise<{ records: T[]; truncated: boolean }>;
}

/** Operations from wikibooks.json. */
interface WikibooksGateway {
  wikibooksQuery(args?: Record<string, unknown>): Promise<unknown>;
}

interface DefaultGateway {
  [namespace: string]: unknown;
}

/** The bridge to a mounted SQLite dependency. State is ephemeral unless the declaration set persistent. The realm owns its database entirely. */
export interface SqliteBridge {
  exec(
    sql: string,
    params?: (string | number | null)[],
  ): Promise<Record<string, string | number | null>[]>;
}

/** The bridge to the "stockfish" dependency, typed from exactly the methods this realm declares it calls. */
export interface EngineBridge {
  analyse: {
    (arg0: string, arg1: number, arg2: number, arg3: number): Promise<string>;
    /**
     * Runs many calls at once on the host and resolves to one result per entry, in the
     * order given. Each entry is one call's arguments: the value itself when the method
     * takes one, otherwise an array of them. The host takes 1 to 256 entries.
     */
    batch(calls: readonly (readonly [arg0: string, arg1: number, arg2: number, arg3: number])[]): Promise<string[]>;
  };
}

/**
 * The sha256 of each skill folder this realm ships, exactly as synth copied it. Admission
 * checks these against the captured files, so a cache keyed on one changes whenever the
 * skill text the model is given does.
 */
export const skills = {
  digest: {
    "chess-plans": "165937bd01a1e0ed955f1da46f8d77afae8549eee668ee31be144ade5f6e43ee",
  },
} as const;

/** How a proposed write reaches the graph: through a named, approved method, or as a plain field decoration. */
export type WriteProposalKind = "method-write-back" | "decoration";

/** Whether a proposed write stays in the owner's own storage or reaches something outside it. */
export type WriteProposalEffect = "private-storage" | "external";

/**
 * The alphabet, written out so a template literal can fix the first character of a name the
 * host's grammar pins. Only the first character: the rest of each grammar — letters and
 * digits, up to 64 of them — stays a refusal at dispatch.
 */
type WriteProposalUpperLetter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";
type WriteProposalLowerLetter = Lowercase<WriteProposalUpperLetter>;

/** A node label, which the host reads as a type name: `Note`, never `note` or `com.foo.Note`. */
export type WriteProposalLabel = `${WriteProposalUpperLetter}${string}`;

/** A write-back method name, which the host reads as a member name: `archive`, never `Archive`. */
export type WriteProposalMethodName = `${WriteProposalLowerLetter}${string}`;

/** The record a proposed write targets: its label and its key. */
export interface WriteProposalTarget {
  label: WriteProposalLabel;
  /** The record's own key. At most 2048 bytes of UTF-8. */
  key: string;
}

/**
 * Field names a proposed write may never carry, at any depth: the host's own identity and
 * ownership fields, plus anything starting with an underscore. They are `never` rather than
 * absent so a separately declared object holding one is caught too, not just a fresh literal.
 */
export type WriteProposalReservedFields = {
  userId?: never;
  worldId?: never;
  workspaceId?: never;
  visibleTo?: never;
  owner?: never;
  ownerId?: never;
  labels?: never;
} & { [name: `_${string}`]: never };

/** A leaf a proposed write can carry. */
type WriteProposalScalar = string | number | boolean | null;

/**
 * The nesting cap, one type per level, because the host counts levels and refuses past four:
 * the `fields` object is level one, so three nested objects or arrays inside it are as deep as
 * a proposal goes.
 */
type WriteProposalLevel4 =
  | WriteProposalScalar
  | WriteProposalScalar[]
  | ({ [name: string]: WriteProposalScalar } & WriteProposalReservedFields);
type WriteProposalLevel3 =
  | WriteProposalScalar
  | WriteProposalLevel4[]
  | ({ [name: string]: WriteProposalLevel4 } & WriteProposalReservedFields);
type WriteProposalLevel2 =
  | WriteProposalScalar
  | WriteProposalLevel3[]
  | ({ [name: string]: WriteProposalLevel3 } & WriteProposalReservedFields);

/**
 * What a proposed write actually sets: at least one field, at most 64 in any one object or
 * array, none of them reserved. The count is the part a type cannot say, so it stays a
 * refusal at dispatch.
 */
export type WriteProposalFields = {
  [name: string]: WriteProposalLevel2;
} & WriteProposalReservedFields;

/** Fields every proposed write carries, whichever kind it is. */
interface WriteProposalBase {
  /** The document version the host reads. There is one. */
  version: 1;
  target: WriteProposalTarget;
  fields: WriteProposalFields;
  effect: WriteProposalEffect;
  /**
   * The revision the guest believes the record is at, so the host can refuse a write built on
   * a stale read. A whole number, never negative. Absent or null means don't check.
   */
  expectedRevision?: number | null;
}

/**
 * What a captured handler hands the host when it wants to write something back to the graph.
 * It is only a proposal: the host still validates it, shows it and confirms it, and nothing is
 * applied by proposing. The whole document is at most 65536 bytes of UTF-8.
 */
export type WriteProposal =
  | (WriteProposalBase & {
      kind: "method-write-back";
      /** The approved method the host calls on the record. */
      method: WriteProposalMethodName;
    })
  | (WriteProposalBase & {
      kind: "decoration";
      /** A decoration sets fields directly, so naming a method is a compile error. */
      method?: never;
    });

/**
 * What comes back when the host accepts a proposal: the id it filed it under. A refusal
 * arrives as a rejected promise carrying one fixed message, never as a value.
 */
export interface WriteProposalResult {
  proposalId: string;
}

/** Which of the owner's models answers: the cheapest, the everyday one, or the best. */
export type ModelRole = "cheap" | "workhorse" | "best";

/** What a handler sends the owner's model with `ctx.call("ai_complete", ...)`. The host refuses any other field. */
export interface AiCompleteRequest {
  /** What to ask. Not blank. */
  prompt: string;
  /** Which model answers. The owner's default when left out. */
  role?: ModelRole;
  /**
   * Up to eight skill names, each 1 to 64 characters: this realm's own, bare or as
   * `<realm>-<skill>`, or one the owner's world has.
   */
  skills?: readonly string[];
  /** The most tokens the reply may run to. A positive whole number. */
  maxOutputTokens?: number;
}

/** What the model sends back. */
export interface AiCompleteReply {
  /** The model's text, cut to the host's limit when it ran longer. */
  text: string;
  /** True when the host cut `text`. */
  truncated: boolean;
}

/** What the host passes a handler as its second argument. */
export interface HandlerContext {
  /** Writes a line to the host log, attributed to this realm. */
  log(message: string): void;
  /**
   * Calls out through the host. Credentials stay host-side: the guest never sees
   * an API key, and the host injects it on the way out.
   */
  gateway: DefaultGateway & { channel: HostChannelGateway } & { lichess: LichessGateway } & { wikibooks: WikibooksGateway };
  /**
   * Proposes a write back to the graph. This hands the host a description of the write and
   * nothing more: the host validates it, shows it for confirmation, and only then applies
   * anything, so a resolved promise means the proposal was filed under the id it carries,
   * not that the write happened.
   *
   * The host reads it as the `write_propose` call. A refused proposal — a reserved field
   * name, an object nested too deep, a document over 65536 bytes — comes back as a rejected
   * promise carrying one fixed message that names nothing, which is why as much of the
   * document as a type can hold is checked here instead. That includes the field list being
   * exact: a field the document does not declare is a compile error even when the proposal
   * was built as a value first, which is what the generic here is for.
   */
  writePropose<Proposal extends WriteProposal>(
    proposal: Proposal & OnlyDeclaredFields<WriteProposal, Proposal>,
  ): Promise<WriteProposalResult>;
  /**
   * Asks the owner's model, once the owner has granted this realm the model. It answers in
   * place, so the reply is there without awaiting. A refusal is thrown as an Error whose
   * `code` says why: MODEL_NOT_GRANTED, MODEL_SKILL_UNKNOWN, MODEL_CALL_BUDGET,
   * MODEL_DAILY_BUDGET or MODEL_PROMPT_TOO_LARGE. A request the host cannot read is
   * refused with no code. A field the request does not declare is a compile error even
   * when the request was built as a value first, which is what the generic is for.
   */
  call<Request extends AiCompleteRequest>(
    tool: "ai_complete",
    request: Request & OnlyDeclaredFields<AiCompleteRequest, Request>,
  ): AiCompleteReply;
  /** The dependencies this realm declared, each under the name it was declared with. They live in their own container so an author's chosen name can never collide with a context member the host adds later. */
  deps: {
    db: SqliteBridge;
    engine: EngineBridge;
  };
}

/** A verb this realm exposes. */
export type Handler<Input, Output> = (input: Input, ctx: HandlerContext) => Promise<Output>;

/** Input for the analysePosition handler. */
export interface AnalysePositionInput {
  depth?: number;
  fens: string[];
  multiPv?: number;
}

export type AnalysePositionOutput = {
  candidateId: string;
  creates: string;
  depth: number;
  elapsedMs: number;
  engine: string;
  fen: string;
  lossCp?: number;
  mate?: number;
  pvSan: string;
  pvUci: string;
  rank: number;
  removes: string;
  san: string;
  scoreCp?: number;
  side: string;
  uci: string;
  whiteCp?: number;
}[];

/** Input for the appPlans handler. */
export interface AppPlansInput {
  /**
   * The position, as a complete FEN.
   *
   * Min length: 1.
   * Max length: 100.
   */
  fen: string;
  /**
   * Who the plans are for. intermediate when absent.
   *
   * Enum: 'beginner' | 'intermediate' | 'expert'.
   */
  level?: "beginner" | "intermediate" | "expert";
  /**
   * The game's moves from the start in SAN, space-separated, when the game was played from the start. They must reach `fen`.
   *
   * Max length: 4096.
   */
  moves?: string;
}

export type AppPlansOutput = unknown;

/** Input for the appPosition handler. */
export interface AppPositionInput {
  /**
   * The position, as a complete FEN.
   *
   * Min length: 1.
   * Max length: 100.
   */
  fen: string;
  /**
   * The game's moves from the start in SAN, space-separated, when the game was played from the start. They must reach `fen`.
   *
   * Max length: 4096.
   */
  moves?: string;
  /**
   * Keep moves at most this many centipawns worse than the best. 50 when absent.
   *
   * Minimum: 0.
   * Maximum: 1000.
   */
  withinCp?: number;
}

export type AppPositionOutput = unknown;

/** Input for the appPractice handler. */
export interface AppPracticeInput {
  /**
   * The position, as a complete FEN.
   *
   * Min length: 1.
   * Max length: 100.
   */
  fen: string;
  filters: {
  /** Enum: '0' | '1000' | '1200' | '1400' | '1600' | '1800' | '2000' | '2200' | '2500'. */
  band?: "0" | "1000" | "1200" | "1400" | "1600" | "1800" | "2000" | "2200" | "2500";
  /** Enum: 'white' | 'black'. */
  color?: "white" | "black";
  masters?: boolean;
  /**
   * Minimum: 0.
   * Maximum: 100.
   */
  minShare?: number;
  /** Max length: 30. */
  player?: string;
  /** Enum: 'ultraBullet' | 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence' | 'all'. */
  speed?: "ultraBullet" | "bullet" | "blitz" | "rapid" | "classical" | "correspondence" | "all";
};
}

export type AppPracticeOutput = unknown;

export type DeepenInput = Record<string, never>;

export type DeepenOutput = {
  deepened: number;
  failed: number;
  rounds: number;
};

export type ExplainLinePlansInput = Record<string, never>;

export type ExplainLinePlansOutput = {
  engineEvidence: string;
  fen: string;
  idea: string;
  imbalances: string;
  level: string;
  line: string;
  model: string;
  moves: string;
  name: string;
  opening: string;
  planId: string;
  priority: number;
  side: string;
  structure: string;
  summary: string;
}[];

export type ExplainPlansInput = Record<string, never>;

export type ExplainPlansOutput = {
  engineEvidence: string;
  fen: string;
  idea: string;
  imbalances: string;
  level: string;
  model: string;
  moves: string;
  name: string;
  opening: string;
  planId: string;
  priority: number;
  side: string;
  structure: string;
  summary: string;
}[];

export type MarkDeepenedInput = Record<string, never>;

export type MarkDeepenedOutput = {
  marked: number;
};

/** Input for the mastersAtPosition handler. */
export interface MastersAtPositionInput {
  fens: string[];
}

export type MastersAtPositionOutput = {
  games: {
  black: string;
  blackElo?: number;
  color: string;
  fen: string;
  gameId: string;
  month: string;
  player: string;
  result: string;
  speed: string;
  uci: string;
  url: string;
  white: string;
  whiteElo?: number;
  year?: number;
}[];
  moves: {
  averageRating?: number;
  black: number;
  blackWinPct?: number;
  color: string;
  drawPct?: number;
  draws: number;
  fen: string;
  games: number;
  moveId: string;
  player: string;
  san: string;
  scoreForMover?: number;
  uci: string;
  white: number;
  whiteWinPct?: number;
}[];
};

/** Input for the openingLookup handler. */
export interface OpeningLookupInput {
  fens: string[];
}

export type OpeningLookupOutput = {
  eco: string;
  fen: string;
  name: string;
  pgn: string;
}[];

/** Input for the openingOfGameLine handler. */
export interface OpeningOfGameLineInput {
  lines: string[];
}

export type OpeningOfGameLineOutput = {
  eco: string;
  fen: string;
  line: string;
  name: string;
  namedAtPly: number;
  pgn: string;
  pliesPast: number;
}[];

/** Input for the playerAtPosition handler. */
export interface PlayerAtPositionInput {
  fens: string[];
  filters?: string;
}

export type PlayerAtPositionOutput = {
  games: {
  black: string;
  blackElo?: number;
  color: string;
  fen: string;
  gameId: string;
  month: string;
  player: string;
  result: string;
  speed: string;
  uci: string;
  url: string;
  white: string;
  whiteElo?: number;
  year?: number;
}[];
  moves: {
  averageRating?: number;
  black: number;
  blackWinPct?: number;
  color: string;
  drawPct?: number;
  draws: number;
  fen: string;
  games: number;
  moveId: string;
  player: string;
  san: string;
  scoreForMover?: number;
  uci: string;
  white: number;
  whiteWinPct?: number;
}[];
};

/** Input for the positionImbalances handler. */
export interface PositionImbalancesInput {
  fens: string[];
}

export type PositionImbalancesOutput = {
  bishopPairBlack: boolean;
  bishopPairWhite: boolean;
  detail: string;
  facts: string;
  fen: string;
  isolatedQueenPawnBlack: boolean;
  isolatedQueenPawnWhite: boolean;
  materialBlack: number;
  materialWhite: number;
  openFiles: string;
  oppositeColouredBishops: boolean;
  oppositeSideCastling: boolean;
  passedBlack: string;
  passedWhite: string;
  phase: string;
  sideToMove: string;
  structure: string;
}[];

/** Input for the ratedMoves handler. */
export interface RatedMovesInput {
  fens: string[];
  filters?: string;
}

export type RatedMovesOutput = {
  band: string;
  bandGames: number;
  bandLabel: string;
  blackWinPct?: number;
  drawPct?: number;
  fen: string;
  games: number;
  rowId: string;
  san: string;
  scoreForMover?: number;
  share?: number;
  speed: string;
  uci: string;
  whiteWinPct?: number;
}[];

/** Input for the rowsCandidates handler. */
export interface RowsCandidatesInput {
  /**
   * This realm's own next cursor, resent by the host.
   *
   * Max length: 8.
   */
  cursor?: string;
  /** The Position FENs the host is fetching for. */
  fens: string[];
}

export type RowsCandidatesOutput = unknown;

/** Input for the rowsImbalances handler. */
export interface RowsImbalancesInput {
  /** The Position FENs the host is fetching for. */
  fens: string[];
}

export type RowsImbalancesOutput = unknown[];

/** Input for the rowsLinePlans handler. */
export interface RowsLinePlansInput {
  /**
   * This realm's own next cursor, resent by the host.
   *
   * Max length: 8.
   */
  cursor?: string;
  /** The reader's levels the query pinned: beginner, intermediate or expert. */
  level?: string[];
  /** The GameLine move lists the host is fetching for: SAN from the start, space-separated. */
  lines: string[];
}

export type RowsLinePlansOutput = unknown;

/** Input for the rowsMasterGames handler. */
export interface RowsMasterGamesInput {
  /**
   * This realm's own next cursor, resent by the host.
   *
   * Max length: 8.
   */
  cursor?: string;
  /** The Position FENs the host is fetching for. */
  fens: string[];
}

export type RowsMasterGamesOutput = unknown;

/** Input for the rowsMasterMoves handler. */
export interface RowsMasterMovesInput {
  /**
   * This realm's own next cursor, resent by the host.
   *
   * Max length: 8.
   */
  cursor?: string;
  /** The Position FENs the host is fetching for. */
  fens: string[];
}

export type RowsMasterMovesOutput = unknown;

/** Input for the rowsOpeningOfLine handler. */
export interface RowsOpeningOfLineInput {
  /** The GameLine move lists the host is fetching for: SAN from the start, space-separated. */
  lines: string[];
}

export type RowsOpeningOfLineOutput = unknown[];

/** Input for the rowsOpeningOfPosition handler. */
export interface RowsOpeningOfPositionInput {
  /** The Position FENs the host is fetching for. */
  fens: string[];
}

export type RowsOpeningOfPositionOutput = unknown[];

/** Input for the rowsPlayerGames handler. */
export interface RowsPlayerGamesInput {
  /** The colours the query pinned: white or black. */
  color?: string[];
  /**
   * This realm's own next cursor, resent by the host.
   *
   * Max length: 8.
   */
  cursor?: string;
  /** The Position FENs the host is fetching for. */
  fens: string[];
  /** The Lichess usernames the query pinned. */
  player?: string[];
}

export type RowsPlayerGamesOutput = unknown;

/** Input for the rowsPlayerMoves handler. */
export interface RowsPlayerMovesInput {
  /** The colours the query pinned: white or black. */
  color?: string[];
  /**
   * This realm's own next cursor, resent by the host.
   *
   * Max length: 8.
   */
  cursor?: string;
  /** The Position FENs the host is fetching for. */
  fens: string[];
  /** The Lichess usernames the query pinned. */
  player?: string[];
}

export type RowsPlayerMovesOutput = unknown;

/** Input for the rowsPositionPlans handler. */
export interface RowsPositionPlansInput {
  /**
   * This realm's own next cursor, resent by the host.
   *
   * Max length: 8.
   */
  cursor?: string;
  /** The Position FENs the host is fetching for. */
  fens: string[];
  /** The reader's levels the query pinned: beginner, intermediate or expert. */
  level?: string[];
}

export type RowsPositionPlansOutput = unknown;

/** Input for the rowsRatedMoves handler. */
export interface RowsRatedMovesInput {
  /** The rating band floors the query pinned: 0, 1000, 1200, 1400, 1600, 1800, 2000, 2200 or 2500. */
  band?: string[];
  /**
   * This realm's own next cursor, resent by the host.
   *
   * Max length: 8.
   */
  cursor?: string;
  /** The Position FENs the host is fetching for. */
  fens: string[];
  /** The time controls the query pinned, or all. */
  speed?: string[];
}

export type RowsRatedMovesOutput = unknown;

/** Input for the rowsTheory handler. */
export interface RowsTheoryInput {
  /**
   * This realm's own next cursor, resent by the host.
   *
   * Max length: 8.
   */
  cursor?: string;
  /** The GameLine move lists the host is fetching for: SAN from the start, space-separated. */
  lines: string[];
}

export type RowsTheoryOutput = unknown;

/** Input for the status handler. */
export interface StatusInput {
  /** The AssistantUser usernames the host is fetching for. */
  username: string[];
}

export type StatusOutput = unknown[];

/** Input for the theoryOfGameLine handler. */
export interface TheoryOfGameLineInput {
  lines: string[];
}

export type TheoryOfGameLineOutput = {
  licence: string;
  line: string;
  pliesCovered: number;
  pliesPast: number;
  theory: string;
  title: string;
  url: string;
}[];

/** Every handler this realm exposes, keyed by name and typed by input/output. */
export interface Handlers {
  analysePosition: Handler<AnalysePositionInput, AnalysePositionOutput>;
  appPlans: Handler<AppPlansInput, AppPlansOutput>;
  appPosition: Handler<AppPositionInput, AppPositionOutput>;
  appPractice: Handler<AppPracticeInput, AppPracticeOutput>;
  deepen: Handler<DeepenInput, DeepenOutput>;
  explainLinePlans: Handler<ExplainLinePlansInput, ExplainLinePlansOutput>;
  explainPlans: Handler<ExplainPlansInput, ExplainPlansOutput>;
  markDeepened: Handler<MarkDeepenedInput, MarkDeepenedOutput>;
  mastersAtPosition: Handler<MastersAtPositionInput, MastersAtPositionOutput>;
  openingLookup: Handler<OpeningLookupInput, OpeningLookupOutput>;
  openingOfGameLine: Handler<OpeningOfGameLineInput, OpeningOfGameLineOutput>;
  playerAtPosition: Handler<PlayerAtPositionInput, PlayerAtPositionOutput>;
  positionImbalances: Handler<PositionImbalancesInput, PositionImbalancesOutput>;
  ratedMoves: Handler<RatedMovesInput, RatedMovesOutput>;
  rowsCandidates: Handler<RowsCandidatesInput, RowsCandidatesOutput>;
  rowsImbalances: Handler<RowsImbalancesInput, RowsImbalancesOutput>;
  rowsLinePlans: Handler<RowsLinePlansInput, RowsLinePlansOutput>;
  rowsMasterGames: Handler<RowsMasterGamesInput, RowsMasterGamesOutput>;
  rowsMasterMoves: Handler<RowsMasterMovesInput, RowsMasterMovesOutput>;
  rowsOpeningOfLine: Handler<RowsOpeningOfLineInput, RowsOpeningOfLineOutput>;
  rowsOpeningOfPosition: Handler<RowsOpeningOfPositionInput, RowsOpeningOfPositionOutput>;
  rowsPlayerGames: Handler<RowsPlayerGamesInput, RowsPlayerGamesOutput>;
  rowsPlayerMoves: Handler<RowsPlayerMovesInput, RowsPlayerMovesOutput>;
  rowsPositionPlans: Handler<RowsPositionPlansInput, RowsPositionPlansOutput>;
  rowsRatedMoves: Handler<RowsRatedMovesInput, RowsRatedMovesOutput>;
  rowsTheory: Handler<RowsTheoryInput, RowsTheoryOutput>;
  status: Handler<StatusInput, StatusOutput>;
  theoryOfGameLine: Handler<TheoryOfGameLineInput, TheoryOfGameLineOutput>;
}

export type AnalysePositionHandler = Handler<AnalysePositionInput, AnalysePositionOutput>;
export type AppPlansHandler = Handler<AppPlansInput, AppPlansOutput>;
export type AppPositionHandler = Handler<AppPositionInput, AppPositionOutput>;
export type AppPracticeHandler = Handler<AppPracticeInput, AppPracticeOutput>;
export type DeepenHandler = Handler<DeepenInput, DeepenOutput>;
export type ExplainLinePlansHandler = Handler<ExplainLinePlansInput, ExplainLinePlansOutput>;
export type ExplainPlansHandler = Handler<ExplainPlansInput, ExplainPlansOutput>;
export type MarkDeepenedHandler = Handler<MarkDeepenedInput, MarkDeepenedOutput>;
export type MastersAtPositionHandler = Handler<MastersAtPositionInput, MastersAtPositionOutput>;
export type OpeningLookupHandler = Handler<OpeningLookupInput, OpeningLookupOutput>;
export type OpeningOfGameLineHandler = Handler<OpeningOfGameLineInput, OpeningOfGameLineOutput>;
export type PlayerAtPositionHandler = Handler<PlayerAtPositionInput, PlayerAtPositionOutput>;
export type PositionImbalancesHandler = Handler<PositionImbalancesInput, PositionImbalancesOutput>;
export type RatedMovesHandler = Handler<RatedMovesInput, RatedMovesOutput>;
export type RowsCandidatesHandler = Handler<RowsCandidatesInput, RowsCandidatesOutput>;
export type RowsImbalancesHandler = Handler<RowsImbalancesInput, RowsImbalancesOutput>;
export type RowsLinePlansHandler = Handler<RowsLinePlansInput, RowsLinePlansOutput>;
export type RowsMasterGamesHandler = Handler<RowsMasterGamesInput, RowsMasterGamesOutput>;
export type RowsMasterMovesHandler = Handler<RowsMasterMovesInput, RowsMasterMovesOutput>;
export type RowsOpeningOfLineHandler = Handler<RowsOpeningOfLineInput, RowsOpeningOfLineOutput>;
export type RowsOpeningOfPositionHandler = Handler<RowsOpeningOfPositionInput, RowsOpeningOfPositionOutput>;
export type RowsPlayerGamesHandler = Handler<RowsPlayerGamesInput, RowsPlayerGamesOutput>;
export type RowsPlayerMovesHandler = Handler<RowsPlayerMovesInput, RowsPlayerMovesOutput>;
export type RowsPositionPlansHandler = Handler<RowsPositionPlansInput, RowsPositionPlansOutput>;
export type RowsRatedMovesHandler = Handler<RowsRatedMovesInput, RowsRatedMovesOutput>;
export type RowsTheoryHandler = Handler<RowsTheoryInput, RowsTheoryOutput>;
export type StatusHandler = Handler<StatusInput, StatusOutput>;
export type TheoryOfGameLineHandler = Handler<TheoryOfGameLineInput, TheoryOfGameLineOutput>;
