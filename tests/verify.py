"""
The realm's battery, against a live appliance with realm-chess installed.

    APPLIANCE=http://127.0.0.1:11043 AUTH=user:pass sh tests/verify.sh

Keyless as run here. With no Lichess token bound, the six Lichess views answer empty and
ChessStatus says why; without the model granted, the two plan views do the same. Both are checked
for that explanation by tests/live/views.mjs, which verify.sh runs after this.

  L1  every view answers BY NAME on its defaults (the Lichess, plan and theory views may be empty,
      for the reasons above).
  L2  ground truth the realm does not get to choose: the engine finds a mate in one, and the
      opening book's names are the Lichess chess-openings list's own, fetched directly.
"""
import csv
import io
import re
import sys
import urllib.request
from pathlib import Path

sys.dont_write_bytecode = True  # no __pycache__ left in the checkout under test
sys.path.insert(0, str(Path(__file__).resolve().parent))
import battery_common
from battery_common import ROOT, check, invoke, problem, sweep  # noqa: E402

names = re.findall(r'^\s+name: "(\w+)",', (ROOT / "wasm/lib/views.ts").read_text(), re.M)
LICHESS = {"MastersAtPosition", "MasterGamesAtPosition", "MovesByRating", "MovesByTimeControl",
           "PlayerAtPosition", "PlayerGamesAtPosition"}
sweep(names, may_be_empty=LICHESS | {"PlansInPosition", "PlansInLine", "TheoryOfLine"})

print("== L2: ground truth")
MATE = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1"
env = invoke("BestMoves", {"fen": MATE})
best = (env.get("data") or [{}])[0]
check("BestMoves finds the back-rank mate in one (Ra8#)", best.get("uci") == "a1a8" and best.get("mate") in (1, "1") and not problem(env),
      problem(env) or f"rank 1 = {best.get('move')} {best.get('uci')}, mate={best.get('mate')}")

book = {}
for letter in "abcde":
    text = urllib.request.urlopen(f"https://raw.githubusercontent.com/lichess-org/chess-openings/master/{letter}.tsv",
                                  timeout=60).read().decode()
    for row in csv.DictReader(io.StringIO(text), delimiter="\t"):
        book[row["pgn"]] = (row["eco"], row["name"])
for fen, pgn in (("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", "1. e4"),
                 ("rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "1. e4 c5")):
    env = invoke("OpeningOf", {"fen": fen})
    row = (env.get("data") or [{}])[0]
    check(f"OpeningOf({pgn}) = the Lichess list's {book.get(pgn)}", (row.get("eco"), row.get("name")) == book.get(pgn) and not problem(env),
          problem(env) or f"got {row.get('eco')} {row.get('name')}")

# verify.sh runs tests/live/views.mjs next and prints the verdict for the whole battery.
print(f"{battery_common.failures} check(s) failed in L1-L2" if battery_common.failures else "L1-L2: no failures")
sys.exit(1 if battery_common.failures else 0)
