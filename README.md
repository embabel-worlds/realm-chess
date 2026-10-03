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

With a Lichess token (declared in `keys.yml`; the console asks for it) a position also has
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
| `wasm/handlers.ts` | The verbs. The ten public ones keep the Node realm's names and schemas; `rows*` serve the graph's producers. |
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
| `realm.yml`, `credentials.yml`, `apis/apis.yml`, `producers/`, `types/`, `views/`, `dependencies/`, `dist/manifest.json` | Written by synth from `realm.ts`. Don't edit by hand. |
| `skills/chess-plans/` | The plan knowledge: Silman's method, what each imbalance calls for, a table of pawn structures and their plans, how to use the engine. |
| `apps/chesscalator.html` | The board. |
| `tests/battery/positions.yml` | Fifteen common positions and the plans theory gives each side. |

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
npm run check        # typecheck, vendor chess.js, write the book, synth, tests
```

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
- `tests/app.spec.mjs` — the page, headless, against envelopes captured from a live appliance
  (`tests/fixtures/capture.mjs` recaptures them).
- `tests/live/drive.mjs` — the real page on a running appliance.
- `tests/battery/run.mjs` — every battery position through `explainPlans`, graded: whether each
  expected plan is named at all, and whether it is the side's FIRST plan. Writes a readable report
  to `tests/battery/results/`. The grading is by words, so read the report; the score is how you
  notice a change between readings.

```bash
APPLIANCE=http://127.0.0.1:11043 APPLIANCE_AUTH="Basic ..." node tests/battery/run.mjs
```

## Things to know

- **Experimental.** The engine, imbalances, opening book and query surface are sound. Plans are
  a model's judgement: on the battery it names the plans theory expects almost always, and leads
  with the right one most of the time — the report says which. Improving that is editing the skill.
- **Plans need an appliance whose `gateway.ai.complete` accepts `skills`.** On an older one
  `PlansInPosition` fails; everything else works.
- **Scores are for the side to move.** `whiteCp` is for display; compare moves with `lossCp`.
- **A search is not repeatable, and neither is a model's answer.** The per-position caches keep
  the numbers and the plans shown together consistent.
- **Room for master games:** a producer keyed by FEN over the Lichess masters explorer would add
  `MASTERS_PLAYED` and `MASTER_GAME` hops; the skill already says how to weigh practice against
  the engine. It needs a Lichess token.

## Licences

Stockfish is GPL-3.0, and this realm, which ships it, is GPL-3.0 (`LICENSE`). The board is
[cm-chessboard](https://github.com/shaack/cm-chessboard) (MIT), loaded from jsdelivr; its three
SVG sprites are copied into `apps/` because an app serves only flat same-origin files. Moves are
validated with [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause). The opening book is
the [Lichess opening list](https://github.com/lichess-org/chess-openings) (CC0). Opening theory is
read at query time from the [Chess Opening Theory](https://en.wikibooks.org/wiki/Chess_Opening_Theory)
wikibook, by Wikibooks contributors, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/);
the realm shows it only as an attributed excerpt with a link to its page, and stores none of it.
CC BY-SA 4.0 is one-way compatible with GPL-3.0.
