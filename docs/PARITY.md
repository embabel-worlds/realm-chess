# Parity with the Node realm (86b5bb5)

What the captured realm does that the Node realm did, and what changed. The checks named here are
in this repository; the live ones are run against an appliance.

| Feature at 86b5bb5 | Captured realm | What changes |
| --- | --- | --- |
| Stockfish `go depth 18`, five lines, server side, waits up to 45 s | the `stockfish` 19.0.0 registry module, searched to a node budget of 3,500,000 (about three seconds on a native runtime), depth capped at 18, five lines | A deliberate change: the search is bounded by work, and every row says the depth and nodes it reached. Measured: depth 18 on all fifteen battery positions (0.6 to 3.5 s under V8), the same best move, score and five candidates as the Node realm's engine on all fifteen, and BestMoves rows identical to the Node realm's recorded views for every recorded position and tolerance (`tests/views.test.ts`). A bulk query over many new positions pages at about six a page, or is refused by the host with its code. |
| Imbalances, openings, pawn skeletons | the same code in the guest; the book as SQLite rows; the skeleton search kept whole | None. ImbalancesOf, OpeningOf and OpeningOfLine equal the recorded views. |
| Wikibook theory | a gateway call to a keyless API (`auth: none`), kept 7 days, misses included | No token: the owner approves the `wikibooks` API, and the host sends a fixed User-Agent. Returns rows on the appliance. |
| Lichess masters, a player, ratings; one request per grid cell, 1.1 s apart | gateway calls, the player database read as NDJSON, one request per cell, 1.1 s apart within a dispatch; across dispatches the spacing is best effort, from the last request time each dispatch reads from SQLite, so two dispatches running at once can each ask straight away; kept 30 days (masters, ratings) and 1 day (a player) | The token is bound in the console; there is no validation call; a refusal shows in ChessStatus without its cause. Rows equal Rod's handlers on the same answers. |
| Plans by a model with the chess-plans skill, `best` role | `ai_complete` behind the owner's model grant; Rod's prompt, parser and role; plans keyed to the `analysisId` of the lines they were made from, which each Plan row carries | The owner grants the model. Plans are made again when the skill, the lines at the `full` budget or the theory change. A deeper search by the background tick does not remake them: after it, CandidateMove rows carry the deeper search's `analysisId` and Plan rows keep the one they were made from. |
| Thirteen views | `views/chess.yml` written from `realm.ts` | None: equal as parsed YAML. `ChessStatus` is added. |
| Caches | SQLite rows with Rod's TTLs; negative caching where he declared it; a refusal (429 included) never kept | None visible. |
| Chesscalator: parallel view calls, plans on the button, board from jsdelivr | a captured app: three bounded calls carrying the played line, the level, `withinCp` and the filters; plans only on the button; one serialized queue; board, chess.js, sprites and styles carried as assets | Loads with no network; the same projections, order and limits (each reply runs the views' own Cypher); the model is spent at the same moments; the masters column fills in after the engine's. The level, tab and player are kept per reader through `realm.prefs`, and the owner page's hash opens a game. |
| Battery | the same files, through `chess_explainPlans` and `chess_explainLinePlans` | Scored as before; see below. |
| Internal producer names | lowercase with hyphens (`candidate-lines`) | Not visible in the graph or the views. |

## Measured depth

The `full` budget reaches depth 18, the cap, on every battery position on the SIMD module under a
JIT. On the appliance (handlers and the SIMD module on wasmtime), game 3, 80 plies:

| | Median | p90 | Min |
| --- | --- | --- | --- |
| Depth reached | 18 | | 16 |
| Fresh analysis | 4.7 s | 6.7 s | |
| Same position asked again | 612 ms | 738 ms | |

Background deepening ticks reach depth 20 to 22, at 5 to 6.4 s a search. Every row says the depth
and nodes it reached.

## Schedules

Deepening runs only once the owner grants `schedule:chess.deepen` and
`schedule:chess.markDeepened`. Without them positions are still queued, and every read answers at
the `full` budget.

## Battery

Three cold runs of `tests/battery/run.mjs` on the appliance, model gpt-4.1 as `best`, the engine
at the `full` budget, the realm's kept state cleared before each run:

| Run | Expected plans found | Found as the first plan |
| --- | --- | --- |
| 1 | 30 of 30 | 24 of 30 |
| 2 | 30 of 30 | 22 of 30 |
| 3 | 29 of 30 | 21 of 30 |
| Mean | 98.9% | 74.4% |

There is no Node realm baseline on this model or this appliance, so the comparison within five
points of the Node realm is still open.
