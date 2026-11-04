# realm-chess

A chessboard, a strong engine, and the plans a position calls for, as an Embabel realm.

- **Stockfish 19** gives the best lines. It travels with the realm as a WebAssembly module and
  runs inside the appliance, so nothing has to be installed for it.
- **Imbalances**, in Jeremy Silman's sense, are computed from the board: material, the minor
  pieces, pawn structure, space, files, outposts, development and king safety.
- **The opening** is named along the game's moves from the Lichess opening list, so a line keeps
  its name after it leaves the book. The Chess Opening Theory wikibook says what theory holds
  along the line.
- **Plans** for both sides are decided by your model with the realm's `chess-plans` skill, from
  those facts.
- With a Lichess token, it also shows what masters and Lichess players chose in a position, and
  how they scored.

Everything is a Virtual Cypher hop from a position, so the analysis is a query and a REST call as
well as a page:

```cypher
MATCH (p:Position {fen: $fen})
OPTIONAL MATCH (p)-[:HAS_IMBALANCES]->(i:PositionImbalances)
OPTIONAL MATCH (p)-[:IN_OPENING]->(o:Opening)
OPTIONAL MATCH (p)-[:HAS_CANDIDATE]->(c:CandidateMove) WHERE toInteger(c.lossCp) <= 50
RETURN i.facts, o.name, collect(c.san)
```

The realm is `chess`, version 0.5.0, and is marked **experimental**.

## Install

On an Embabel appliance, open **Realms**, find **chess** and install it. Or install it from
`https://github.com/embabel-worlds/realm-chess`.

The engine, the imbalances, the opening book and the theory work as soon as it is installed.
The rest needs one approval each, in the console:

| To get | Grant |
|---|---|
| Plans for both sides | the **model** capability. Each plan spends your model budget. |
| Masters, players and popularity by rating | a Lichess personal token (no scopes needed), bound as `lichess` |
| The Chesscalator app | approve **Chesscalator** |
| Background deepening of analysed lines | `schedule:chess.deepen` and `schedule:chess.markDeepened` |

The `ChessStatus` view says which of these is missing when a view comes back empty.

## Views

| View | What it answers |
|---|---|
| `BestMoves` | the engine's best lines for a position |
| `ImbalancesOf` | the position's imbalances, as facts |
| `OpeningOf`, `OpeningOfLine` | the opening, from a position or along a line of moves |
| `TheoryOfLine` | what the wikibook says along a line, as an attributed excerpt |
| `PlansInPosition`, `PlansInLine` | plans for both sides, at the level asked for |
| `MastersAtPosition`, `MasterGamesAtPosition` | what masters played, and the games |
| `MovesByRating`, `MovesByTimeControl` | what Lichess players choose, by rating band or speed |
| `PlayerAtPosition`, `PlayerGamesAtPosition` | what one Lichess player chooses there |
| `ChessStatus` | how the last Lichess and model calls went |

The **Chesscalator** app, at `/apps/chess/chesscalator.html`, puts all of it beside a board.

## Developing

[docs/REALM.md](docs/REALM.md) explains how the realm is built: the handlers, the engine's
budgets, the SQLite schema, the tests, and how to change a declaration.
[vendor/stockfish/README.md](vendor/stockfish/README.md) explains how the engine module is built.

## Licence

GPL-3.0, like Stockfish. `vendor/stockfish/` holds the engine's source, patches and build script.
The opening book is the [Lichess opening list](https://github.com/lichess-org/chess-openings)
(CC0). Opening theory is read at query time from the
[Chess Opening Theory](https://en.wikibooks.org/wiki/Chess_Opening_Theory) wikibook, by Wikibooks
contributors, under CC BY-SA 4.0, and shown only as an attributed excerpt. The other licences are
listed in [docs/REALM.md](docs/REALM.md#licences).
