`openings.tsv` is the Lichess opening list — https://github.com/lichess-org/chess-openings —
concatenated from its `a.tsv` … `e.tsv`, released under CC0. `npm run build` keys each line by
the position it reaches and writes `dist/data/openings.json`.
