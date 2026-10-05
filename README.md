# realm-chess

A chessboard, a strong engine, and the plans a position calls for.

The plans in a chess position come from its **imbalances** — Jeremy Silman's word for the
differences between the two sides: the bishop pair, a weak pawn, a pawn chain pointing at one
wing, more space. This realm computes those from the board, gets the engine's best lines, names
the opening along the game's moves, reads what the Chess Opening Theory wikibook says along
them, and then has a model with the **chess-plans** skill decide
the plans for both sides from those facts. The facts are computed and checkable; the plans are
judged, and the knowledge behind the judgement is a skill anyone can read and improve.

Everything is a Virtual Cypher hop from a position:

```cypher
MATCH (p:Position {fen: $fen})
OPTIONAL MATCH (p)-[:HAS_IMBALANCES]->(i:PositionImbalances)
OPTIONAL MATCH (p)-[:IN_OPENING]->(o:Opening)
OPTIONAL MATCH (p)-[:HAS_CANDIDATE]->(c:CandidateMove) WHERE toInteger(c.lossCp) <= 50
RETURN i.facts, o.name, collect(c.san)
```

and `(p)-[:HAS_PLAN]->(:Plan)` for the plans. A game played from the start is also a
`GameLine` — its moves — with `IN_OPENING` (the deepest name along it, kept past the book),
`HAS_THEORY` (the wikibook's page for it) and `HAS_PLAN` (plans told that name and theory).

With a Lichess token (declared in `realm.ts` under `credentials`; the console asks for it) a position also has
`MASTERS_PLAYED` / `MASTER_GAME` (master practice), `PLAYER_PLAYED` / `PLAYER_GAME` (one Lichess
player's choices) and `PLAYED_AT_RATING` (each move's share of games by rating band and time
control). Comparing moves across rating bands in blitz is one query:

```cypher
MATCH (:Position {fen: $fen})-[:PLAYED_AT_RATING]->(m:RatedMove)
WHERE m.speed = 'blitz' AND toFloat(m.share) >= 5
RETURN m.bandLabel, m.san, m.share, m.scoreForMover ORDER BY toInteger(m.band), m.share DESC
``` The same answers are REST calls and are what the
**Chesscalator** app shows.

## How it is put together

The realm is a captured realm: `realm.ts` declares it, its handlers run as Wasm inside the
appliance, the engine is a registry module the appliance mounts, and everything the realm works
out is kept in its own SQLite.

| Piece | What it is |
|---|---|
| `realm.ts`, `realm/` | The definition: metadata, handlers, types, producers, views, the Lichess API, the two dependencies. |
| `wasm/handlers.ts` | The verbs. The ten public ones keep the Node realm's names and schemas; `rows*` serve the graph's producers; `app*` serve Chesscalator. |
| `wasm/lib/views.ts`, `wasm/lib/cypher.ts` | The thirteen views and ChessStatus, and a reader for the Cypher they use, so the app handlers return exactly what a view would. |
| `wasm/lib/imbalances.ts` | Silman's imbalances from a FEN, as plain sentences; and what a line changes about them. |
| `wasm/lib/lines.ts` | An engine line read for what it does, never for what it is for. |
| `wasm/lib/openings.ts` | Opening names by position, along a game line, and by pawn skeleton, over book rows. |
| `wasm/lib/engine.ts` | The call to the stockfish module, and its lines as candidate records. |
| `wasm/lib/config.ts` | The engine's identity, its node budget, the depth cap, the deadline marks, the TTL. |
| `wasm/lib/store.ts` | The realm's SQLite: book reads, kept analyses. |
| `wasm/lib/status.ts` | What the realm could not do, recorded for `ChessStatus`. |
| `wasm/lib/chess.js` | chess.js, vendored by `scripts/vendor-chess.mjs`: the guest can import only from `wasm/`. |
| `db/schema.sql` | The tables. Frozen once installed: changes go in a new `db/NNNN-*.sql` migration. |
| `db/0001-openings.sql`, `db/0002-skeletons.sql` | The Lichess opening book (CC0) and its pawn skeletons, written by `scripts/book.mjs`. |
| `realm.yml`, `credentials.yml`, `apis/apis.yml`, `producers/`, `types/`, `views/`, `dependencies/`, `dist/manifest.json`, `apps/chesscalator.html.app.json` | Written by synth from `realm.ts`. Don't edit by hand. |
| `skills/chess-plans/` | The plan knowledge: Silman's method, what each imbalance calls for, a table of pawn structures and their plans, how to use the engine. |
| `apps/chesscalator.html`, `apps/chesscalator.html.assets/` | The board, as a captured app. `chesscalator.css` is the page's own styles; `board.css` and `board.js` (cm-chessboard, chess.js and the sprites) are written by `scripts/app.mjs`. |
| `tests/battery/positions.yml` | Fifteen common positions and the plans theory gives each side. |
| `docs/PARITY.md`, `docs/HANDOFF.md` | What the captured realm does beside the Node realm, and notes for review. |

## The engine

Stockfish 19 lite, single thread, built as a Wasm library with no imports, is the registry
module `stockfish` 19.0.0. The realm declares it as its `engine` dependency with one method,
`analyse(fen, nodes, maxDepth, multiPv)`, which answers JSON.

A search is timed by a node budget, the way a chess engine is timed without a clock: the same
position with the same budget always gives the same lines. The numbers are in
`wasm/lib/config.ts`:

| | |
|---|---|
| `full` budget | 3,500,000 nodes: about three seconds on the SIMD module under a native Wasm runtime |
| depth cap | 18 |
| lines | 5 |

This is a deliberate change from the Node realm, which ran `go depth 18` and waited up to 45
seconds. Under a native runtime `full` reaches depth 18 on every battery position (0.6 to 3.5
seconds each, measured under V8). On a slower runtime the same budget takes longer, so every
row says the `depth` and `nodes` it reached.

Lines are kept in SQLite for seven days, looked up by position and configuration: the module's
hash, the budget, the depth cap and the number of lines. Each row carries `analysisId`, the hash
of that configuration and the lines. Searching again after the lines expire finds the same lines
and so the same `analysisId`; anything made from those lines still describes them.

A single position always answers in one read. For many new positions at once, a page searches
while it has spent under 60 percent of the 30 second dispatch deadline, about six at three
seconds, and hands the rest to the next page; past 90 percent it stops even for kept lines.
The host bounds a fetch, and refuses past a bound with its own code:

| Bound | Code | What it means here (measured) |
|---|---|---|
| 256 keys | `KEY_BOUND` | at most 256 positions in one query |
| 1024 rows | `ROW_BOUND` | 204 positions at five lines each |
| 1 MiB of rows | `RESULT_BYTES` | rows run to about 6 KB a position, so about 140 kept positions in one fetch; this bound comes first |
| 16 pages | `PAGE_BOUND` | about 96 new positions at six a page |

A refused fetch keeps what its pages searched, so asking again carries on from there.
`MEASURE=1 npx vitest run tests/measure.test.ts` measures the row sizes again.

## Deepening in the background

The first time a page searches a position at the graph's configuration, the position is queued
in its slot of `deepen_queue` (4096 slots, by hash, so the queue never grows past them), with a
keyed upsert. `chess.deepen` runs every minute on the host's schedule, in
its background class. Each tick takes the queued positions that were queued after they were last
deepened or given up on, oldest first, and searches them at 6,000,000 nodes and depth 22 (the
graph's own search is 3,500,000 and 18). Its first round is one search, which times the runtime;
later rounds are two side by side through the engine's batch call where the host offers it, one
where it does not. Before every round, the first included, it checks that the round still fits in
12 seconds: the first by the calibration (5 s a search), the rest by measurement. A search that
fails, or a queued position with no legal move, is written to `deep_failures`. Half a minute later
`chess.markDeepened` records what was deepened or given up on, so the next tick skips it until a
page searches it again, which happens only once its rows are a week old.

The graph's and the app's reads (BestMoves, `HAS_CANDIDATE`, Chesscalator) prefer a fresh
deeper row; its rows say the depth and nodes they reached. `analysePosition`, which takes a depth
cap, and the plans, which are kept by the analysis they were made from, read the page's own rows,
so a tick never changes their answer or makes a kept plan miss. After a tick, then, a position's
`CandidateMove` rows carry the deeper analysis's `analysisId` and its `Plan` rows keep the one
they were made from.

The two ticks can be replayed by the host when another dispatch published first: the deepen tick
reads the queue and the marks and writes only `deep_analyses` and `deep_failures`; the marking
tick reads those two and writes only the marks; every write is a keyed upsert, and a tick
delivered twice keeps the same rows. A page that searches cannot be: it reads `analyses` before
writing its new search there, so when it loses a race its analyses and queue rows are lost and
the next read searches again. Pages only ever write the queue, with a keyed upsert, and never
read it. Nothing trims `deep_analyses`, `deep_marks` or `deep_failures`; like `analyses`, they
grow with the positions people look at (see HANDOFF). The constants are in `wasm/lib/config.ts`.

## What is kept, and for how long

Everything the realm works out or fetches is kept in its SQLite, under the Node realm's times:

| Kept | Key | For |
|---|---|---|
| Engine lines (`analyses`) | position and configuration (module hash, budget, depth cap, lines) | 7 days |
| Plans (`plans`) | kind, position or line, the `analysisId` they were made from, and a hash of every other input (level, `withinCp`, role, the facts, the opening, the theory text, the skill's digest) | 7 days |
| Theory (`theory`) | the line; a page the wikibook does not have is kept too | 7 days |
| Masters, ratings (`explorer`) | operation, position and every filter | 30 days |
| A player's games (`explorer`) | the same, with the player and colour | 1 day |
| Game lines the app was sent (`game_lines`) | the line as sent: the position it reaches, its SAN, its deepest book name | while the book is unchanged |
| A position's imbalances, for the app (`position_facts`) | the position | while the book is unchanged |
| Deeper engine lines (`deep_analyses`) | position and the deeper configuration | 7 days |
| Positions to deepen (`deepen_queue`) | the position's slot (4096) | until another position takes the slot |
| When each position was deepened or given up on (`deep_marks`) | the position | until it is deepened again |
| Positions the background search gave up on (`deep_failures`) | the position | until it fails again |

Chesscalator sends the whole line on every step. The realm keeps each line it is sent, so a step
plays only the one new move from the line before it, and asking the same position again does no
board work at all: a few reads. In the guest under Node, a repeated call takes about 9 ms at any
ply of an 80-ply game (it took 70 ms at ply 1 and 475 ms at ply 80 before), and a fresh call
spends most of its time in the engine. `MEASURE=1 npx vitest run tests/latency.test.ts` prints the
stages.

An empty Lichess answer and a refused request are never kept. Lines searched again that come out
the same keep their `analysisId`, so plans made from them still describe them; a changed line, a
changed skill or changed theory text makes new plans.

The opening book is rows in SQLite too, loaded by migrations. `db/schema.sql` is the bootstrap and
is never edited once installed: a change to the tables is a new `db/NNNN-*.sql` file, added to the
end of `migrations` in `realm.ts`. The appliance applies the ones it has not applied yet, in order,
and records which. The book is `0001` and `0002`, ChessStatus `0003`, the Lichess spacing clock `0004`,
the app's kept lines and imbalances `0005`, background deepening `0006`, `0007` and `0008`, and
`0009` puts back the deepening queue `0007` dropped. A migration that changes the book's skeletons
also empties `position_facts`, and one that changes the openings empties `game_lines`.

## When one read is not enough

One position answers in one read. The exceptions, each measured in the plumbing spike and each
answered with a labelled partial answer, a cursor or the host's refusal, never a silent gap:

- Plans while the wikibook is slow: theory is skipped for time and the plans are made without it.
- Plans when the model takes more than about six seconds a call and needs the repair retry.
- A cold request that waits behind another dispatch of this realm, until the appliance locks the
  realm's SQLite only to publish.
- A query over many positions the realm has not seen: about six a page, at full depth, up to the
  host's bounds above, then the host's code.
- A Lichess grid that does not fit in one call: the app's popularity view says so, and asking again
  finishes it from the kept answers.

A checkmate or stalemate has no lines and no plans, as before.

## Chesscalator

The app runs in the appliance's sandboxed frame. It has no network and one way out,
`realm.call(handler, args)`, one call at a time. So the page asks three handlers in place of the
views it used to call in parallel:

| Call | When | Answers |
|---|---|---|
| `chess.appPosition(fen, moves?, withinCp)` | every step | ImbalancesOf, OpeningOfLine with theory (with `moves`) or OpeningOf (without), BestMoves |
| `chess.appPractice(fen, filters)` | every step for masters; on request for popularity and a player | MastersAtPosition, MasterGamesAtPosition, MovesByRating, MovesByTimeControl, PlayerAtPosition |
| `chess.appPlans(fen, moves?, level)` | only when the plans button is pressed | PlansInLine (with `moves`) or PlansInPosition |

Each reply carries the views' own rows under their names: the producers' code makes the rows and
the views' own Cypher filters, orders and limits them. It also carries `ChessStatus`, and an empty
column is explained in its words. Every action goes through one queue; stepping while a call is
pending keeps only the latest position, and an answer for a position the board has left is
dropped. cm-chessboard, chess.js, the sprites and the styles are assets inlined into the frame,
and the fonts fall back to the system's. The owner approves the app once installed.

## What the realm could not do

A query gets rows and nothing beside them, so an empty column needs somewhere to say why. That is
`ChessStatus`, reached from the owner:

```cypher
MATCH (:AssistantUser)-[:HAS_CHESS_STATUS]->(s:ChessStatus)
RETURN s.lichess, s.model, s.lastRefusal, s.at
```

or the `ChessStatus` view. `lichess` is `ok`, `refused` or `unknown`; `model` is `ok`,
`not_granted` or `unknown`; `lastRefusal` is the last refusal code a handler saw, and `at` when.

It knows only what a finished call recorded. A dispatch that died publishes nothing, so it leaves
the status as it was. And a refused Lichess call reaches the realm without its cause, so the
status says it was refused and cannot say whether the token is missing or Lichess said no.

## Build, test, install

```bash
npm install
npm run check        # typecheck, vendor chess.js, write the book, build the app's assets, synth, tests, the page
```

`npm run check` needs Bun on the path (synth runs under it) and `npx playwright install
chromium-headless-shell` once for the page tests.

The SDK is not on npm yet, so `@embabel/realm-types` and `@embabel/realm-synth` are vendored as
tarballs in `vendor/sdk/`, packed from embabel-ts branch `feat/sdk-auth-none-typed-model`. A fresh
clone installs with no SDK checkout. To refresh them from an embabel-ts checkout on that branch:

```bash
npm run vendor:sdk -- <embabel-ts checkout>
npm install --save-dev ./vendor/sdk/embabel-realm-types-0.1.0.tgz ./vendor/sdk/embabel-realm-synth-0.1.0.tgz
```

The second command records the new tarballs' integrity in `package-lock.json`. A plain `npm
install` keeps the old integrity, because the file names do not change.

`scripts/vendor-sdk.mjs` copies each package's `package.json` and `src` to a temporary folder,
limits `files` to `src`, replaces realm-synth's `workspace:*` dependency on realm-types with its
version (npm cannot install the workspace protocol), and runs `npm pack --pack-destination
vendor/sdk` there. If the version changes, name the new tarballs in the install command. When
the SDK is published, switch both to the published version and delete `vendor/sdk/`.

To install, put the realm in the world's `config/realms/chess` folder (or install it from the
Store) and admit it. Copy without macOS `._` files: admission refuses a capture that has them. The
appliance needs the `stockfish` 19.0.0 module in its registry and must run it on a native runtime.
Then, in the console:

- grant the realm the **model** capability, for plans;
- bind a Lichess personal token (no scopes) as `lichess`, for masters, players and ratings;
- approve the `wikibooks` API, for theory (it is public and takes no credential);
- approve the **Chesscalator** app.

Everything else works without the grants, and `ChessStatus` says which one is missing.

The tests that run the handlers inside the guest build `wasm/handlers.ts` the way the appliance
does, with the appliance's own build script and Javy 9, then dispatch into it with the realm's
SQLite and engine answered from the test. Point `EMBABEL_WASM_TOOLING` at the appliance's
`tooling/wasm-realm` folder, and `STOCKFISH_WASM` at the stockfish module (a `wasm-stockfish`
checkout beside this one is found by itself). Without them those tests are skipped.

- `tests/imbalances.test.ts`, `tests/lines.test.ts`, `tests/explorer.test.ts`: the unit tests,
  run under Node and again inside the guest.
- `tests/book.test.ts`: the schema, pinned by its hash, and the book in SQLite answering as the
  JSON files did at 86b5bb5.
- `tests/contract.test.ts`: labels, relationships, views and handlers compared with 86b5bb5, with
  the allowed differences listed in the test.
- `tests/handlers.test.ts`, `tests/engine.test.ts`: the handlers in the guest, the engine's
  paging and the host's bounds with a fake clock.
- `tests/status.test.ts`: what ChessStatus records and reads back.
- `tests/views.test.ts`: every view over the producers' rows. Where the inputs are the board, the
  book and the engine, the rows equal what the Node realm's views returned on a live appliance
  (`tests/fixtures/envelopes.json`); the Lichess views and theory equal Rod's 86b5bb5 handlers on
  the same answers.
- `tests/app-handlers.test.ts`: the three app calls against the views, under 30 seconds cold and
  1 MiB, no model call before the button. With `CAPTURE=1` it writes `tests/fixtures/app-replies.json`.
- `tests/app.spec.mjs`: the page, headless, in a document composed as the appliance composes
  it, against the captured replies; and in a sandboxed opaque-origin frame.
- `tests/live/views.mjs`: every view on a running appliance, compared with the recorded rows.
- `tests/live/drive.mjs`: the real app on a running appliance; writes `docs/chesscalator.png`.
- `tests/battery/run.mjs`: every battery position through `chess_explainPlans`, graded: whether each
  expected plan is named at all, and whether it is the side's FIRST plan. Writes a readable report
  to `tests/battery/results/`. The grading is by words, so read the report; the score is how you
  notice a change between readings.

```bash
APPLIANCE=http://127.0.0.1:11043 APPLIANCE_AUTH="Basic ..." node tests/battery/run.mjs
```

For a parity reading, run it three times on one fixed model, at the realm's fixed depth, and
compare the mean first-plan rate with the Node realm's on the same model. The plans are kept for a
week under their inputs, so a second run reads the first run's plans: clear the `plans` table (or
change the skill) between runs.

## Things to know

- **Experimental.** The engine, imbalances, opening book and query surface are sound. Plans are
  a model's judgement: on the battery it names the plans theory expects almost always, and leads
  with the right one most of the time — the report says which. Improving that is editing the skill.
- **Plans need the owner's model grant.** The realm asks for the `model` capability; without the
  grant, or when a model budget is spent, there are no plans and `ChessStatus` says why. Everything
  else works. A dispatch makes at most two model calls (the second only to repair invalid JSON).
- **Theory needs the `wikibooks` API approved.** The wikibook is public, so the API is declared
  with `auth: none` and no credential; the owner still approves it. Until then `HAS_THEORY` is
  empty and line plans are made without theory.
- **Lichess is asked one request at a time, 1.1 s apart, within a dispatch.** Across dispatches
  the spacing is best effort: two dispatches running at once can each ask straight away. A rating
  comparison is nine requests, about ten seconds the first time; answers are kept (masters and
  ratings 30 days, a player's games a day, theory and plans a week). An empty or refused answer is
  never kept.
- **Handler speed depends on the appliance's runtime.** The handlers are JavaScript compiled to
  Wasm. Under a JIT they take well under a second; on an interpreter they can take tens of seconds
  (imbalances alone took 26.9 s), which runs past the 30 second deadline. The appliance should run
  realm handlers on its native Wasm runtime.
- **Scores are for the side to move.** `whiteCp` is for display; compare moves with `lossCp`.
- **A search is not repeatable, and neither is a model's answer.** The per-position caches keep
  the numbers and the plans shown together consistent.

## Licences

Stockfish is GPL-3.0, and this realm, which ships it, is GPL-3.0 (`LICENSE`). The board is
[cm-chessboard](https://github.com/shaack/cm-chessboard) (MIT), bundled into the app's
`board.js` with its three SVG sprites. Moves are validated with
[chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause), bundled the same way and vendored
into the guest. The opening book is
the [Lichess opening list](https://github.com/lichess-org/chess-openings) (CC0). Opening theory is
read at query time from the [Chess Opening Theory](https://en.wikibooks.org/wiki/Chess_Opening_Theory)
wikibook, by Wikibooks contributors, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/);
the realm shows it only as an attributed excerpt with a link to its page, and stores none of it.
CC BY-SA 4.0 is one-way compatible with GPL-3.0.
