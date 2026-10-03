# Parity with the Node realm (86b5bb5)

What the captured realm does that the Node realm did, and what changed. The checks named here are
in this repository; the live ones are run against an appliance.

| Feature at 86b5bb5 | Captured realm | What changes |
| --- | --- | --- |
| Stockfish `go depth 18`, five lines, server side, waits up to 45 s | the `stockfish` 19.0.0 registry module, searched to a node budget of 3,500,000 (about three seconds on a native runtime), depth capped at 18, five lines | A deliberate change: the search is bounded by work, and every row says the depth and nodes it reached. Measured: depth 18 on all fifteen battery positions (0.6 to 3.5 s under V8), the same best move, score and five candidates as the Node realm's engine on all fifteen, and BestMoves rows identical to the Node realm's recorded views for every recorded position and tolerance (`tests/views.test.ts`). A bulk query over many new positions pages at about six a page, or is refused by the host with its code. |
| Imbalances, openings, pawn skeletons | the same code in the guest; the book as SQLite rows; the skeleton search kept whole | None. ImbalancesOf, OpeningOf and OpeningOfLine equal the recorded views. |
| Wikibook theory | a gateway call, kept 7 days, misses included | Needs a Wikimedia token bound as `wikibooks`: the appliance calls no API without a credential. |
| Lichess masters, a player, ratings; one request per grid cell, 1.1 s apart | gateway calls, the player database read as NDJSON, one request per cell, the same spacing kept across dispatches in SQLite; kept 30 days (masters, ratings) and 1 day (a player) | The token is bound in the console; there is no validation call; a refusal shows in ChessStatus without its cause. Rows equal Rod's handlers on the same answers. |
| Plans by a model with the chess-plans skill, `best` role | `ai_complete` behind the owner's model grant; Rod's prompt, parser and role; plans keyed to the `analysisId` of the lines they describe | The owner grants the model. Plans are made again when the skill, the lines or the theory change. |
| Thirteen views | `views/chess.yml` written from `realm.ts` | None: equal as parsed YAML. `ChessStatus` is added. |
| Caches | SQLite rows with Rod's TTLs; negative caching where he declared it; a refusal (429 included) never kept | None visible. |
| Chesscalator: parallel view calls, plans on the button, board from jsdelivr | a captured app: three bounded calls carrying the played line, the level, `withinCp` and the filters; plans only on the button; one serialized queue; board, chess.js, sprites and styles carried as assets | Loads with no network; the same projections, order and limits (each reply runs the views' own Cypher); the model is spent at the same moments; the masters column fills in after the engine's. The level, tab and player are not remembered inside the appliance's frame, which has no storage. |
| Battery | the same files, through `chess_explainPlans` and `chess_explainLinePlans` | Scored as before; see below. |
| Internal producer names | lowercase with hyphens (`candidate-lines`) | Not visible in the graph or the views. |

## Measured depth

The `full` budget reaches depth 18, the cap, on every battery position on the SIMD module under a
JIT. On the appliance the depth depends on the runtime it gives registry modules; each row says
what it reached. The appliance figure is to be filled in once the realm's handlers run on the
appliance's native runtime.

## Battery

Not yet run on an appliance against a fixed model. The parity reading is three runs of
`tests/battery/run.mjs` on one model at the fixed depth, the `plans` table cleared between runs,
and the mean first-plan rate beside the Node realm's on the same model; the two should be within
five points. Until then: with the real engine, the side to move's expected plans are visible in
the engine's five lines on 11 of 15 positions, and with a fake model all fifteen positions come
back with plans for both sides through the verbs the runner calls.
