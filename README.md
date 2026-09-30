# realm-chess

A chessboard, a strong engine, and the plans behind its best moves.

Play moves in the **Chesscalator** app and Stockfish 19 returns its best lines. Each line is read for
the plan it pursues — a kingside pawn storm, a minority attack, a central break, a quiet
regrouping — and moves that share a plan are grouped, so "g4, or Bb5 with h4 to follow" reads as
one idea and "O-O-O first" as another. An explanation contrasts the plans in plain words, written
from facts a player can check against the moves.

The engine is not a page feature. It is a realm verb behind a producer, so the same analysis is a
Virtual Cypher query, a REST call, and something an assistant can reason with through the
`chess-plans` skill.

```cypher
MATCH (p:Position {fen: $fen})-[:HAS_CANDIDATE]->(c:CandidateMove)
WHERE toInteger(c.lossCp) <= 50
RETURN c.san, c.whiteCp, c.plan, c.pvSan ORDER BY toInteger(c.rank)
```

## How it is put together

| Piece | What it is |
|---|---|
| `src/api/chess.ts` | `chess.analysePosition({fens, multiPv, depth})` — the one verb. Runs the engine, reads each line. |
| `src/lib/engine.ts` | Stockfish 19, lite single-threaded WebAssembly build, driven over UCI under Node. |
| `src/lib/plans.ts` | The line reader: which plan a line pursues, by rules over the moves. |
| `producers/engine.yml` | `candidateLines` — the verb as a producer, keyed by FEN, cached for a week. |
| `types/chess.yml` | `Position` → `HAS_CANDIDATE` → `CandidateMove`; `PlanMeaning`. |
| `reference/plans.yml` | The plan vocabulary: meaning, when it is right, what it concedes, the rule that detects it. |
| `views/chess.yml` | `BestMoves`, `PlansInPosition`, `ExplainPlans`, `PlanCatalogue`, `WhatPlanMeans`. |
| `apps/chesscalator.html` | The board. Calls `BestMoves` per move, `ExplainPlans` on request. |
| `skills/chess-plans/` | How to turn engine lines into plans: reading the numbers, the vocabulary, pawn structures, wording. |

The realm is `host: docker`: the handler runs in the appliance's Node sandbox, which is seeded
with `dist/` and nothing else. `npm run build` bundles each handler with its imports (chess.js)
and copies the engine's `.js` and `.wasm` beside it.

## Build, test, install

```bash
npm install
npm run check        # typecheck, line-reader tests, build, browser harness
```

Install by path from a checkout under the appliance's realms mount (`install_realm_from_path
realm-chess`), then `realm_refresh` after each edit. `dist/` must be built before installing —
a path install runs no build.

`tests/plans.test.ts` pins the line reader against real engine lines captured as SAN.
`tests/app.spec.mjs` drives the page's own bytes headless against envelopes captured from live
view runs (`tests/fixtures/envelopes.json`) — no network. `tests/live/drive.mjs` drives the real
page on a running appliance:

```bash
APPLIANCE=http://127.0.0.1:11043 APPLIANCE_AUTH="Basic ..." node tests/live/drive.mjs
```

## Things to know

- **Experimental.** The engine, the views, REST and the query surface work. The plan reader does
  not work well yet: its rules name a plan only when the first ten plies make one unmistakable,
  and they misread many real positions. Treat `plan` as a hint, and read the line.
- **Scores are for the side to move.** `whiteCp` is for display; compare moves with `lossCp`.
- **A search is not repeatable** — two runs can order close moves differently. The week-long cache
  is what keeps an explanation consistent with the numbers beside it.
- **A plan is a reading of one line, not a verdict on the position.** When a reading is wrong,
  add the line as a failing case in `tests/plans.test.ts`, fix the rule, and update
  `reference/plans.yml` and the skill's table in the same change.
- **The explanation's quality is the world's model's.** The facts it is given are computed; the
  prose is not. The numbers beside each move are authoritative.

## Licences

Stockfish is GPL-3.0, and this realm, which ships it, is GPL-3.0 (`LICENSE`). The board is
[cm-chessboard](https://github.com/shaack/cm-chessboard) (MIT), loaded from jsdelivr; its three
SVG sprites are copied into `apps/` because an app can only serve flat same-origin files, and a
sprite from another origin is refused by the browser. Moves are validated with
[chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause).
