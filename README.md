# realm-chess

A chessboard, a strong engine, and the plans a position calls for.

The plans in a chess position come from its **imbalances** — Jeremy Silman's word for the
differences between the two sides: the bishop pair, a weak pawn, a pawn chain pointing at one
wing, more space. This realm computes those from the board, gets the engine's best lines, looks
the position up in the opening book, and then has a model with the **chess-plans** skill decide
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

and `(p)-[:HAS_PLAN]->(:Plan)` for the plans. The same answers are REST calls and are what the
**Chesscalator** app shows.

## How it is put together

| Piece | What it is |
|---|---|
| `src/lib/engine.ts` | Stockfish 19, lite single-threaded WebAssembly build, over UCI under Node. |
| `src/lib/imbalances.ts` | Silman's imbalances from a FEN, as plain sentences; and what a line changes about them. |
| `src/lib/lines.ts` | An engine line read for what it does — its moves, the imbalances it creates and removes — never for what it is for. |
| `src/lib/openings.ts` | The Lichess opening book (CC0), by position and by pawn skeleton. |
| `src/api/chess.ts` | The verbs: `analysePosition`, `positionImbalances`, `openingLookup`, `explainPlans`. |
| `producers/engine.yml` | One producer per verb, keyed by FEN, cached per position. |
| `types/chess.yml` | `Position` → `HAS_IMBALANCES` / `IN_OPENING` / `HAS_CANDIDATE` / `HAS_PLAN`. |
| `views/chess.yml` | `BestMoves`, `ImbalancesOf`, `OpeningOf`, `PlansInPosition`. |
| `skills/chess-plans/` | The plan knowledge: Silman's method, what each imbalance calls for, a table of pawn structures and their plans, how to use the engine. |
| `apps/chesscalator.html` | The board. |
| `tests/battery/positions.yml` | Fifteen common positions and the plans theory gives each side, including pairs from one opening family with opposite plans. |

`explainPlans` sends the imbalances (numbered), the opening name or the book structure the pawns
match, and the engine's candidate moves to `gateway.ai.complete` with `skills: ["chess-plans"]`.
The model activates the skill through the framework's `Skills`, the way chat does, and cites
imbalances by number, so a plan cannot cite one that is not there.

## Build, test, install

```bash
npm install
npm run check        # typecheck, unit tests, build, page harness
```

`host: docker` — the handler runs in the appliance's Node sandbox, which is seeded with `dist/`
and nothing else, so `npm run build` bundles the handler, copies the engine beside it and builds
the opening book. Install by path from a checkout under the appliance's realms mount, then
`realm_refresh` after each edit. Producer caches outlive a refresh: restart the appliance to see
a handler or skill change in the views.

- `tests/*.test.ts` — the imbalances of every battery position, and what lines change.
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
the [Lichess opening list](https://github.com/lichess-org/chess-openings) (CC0).
