---
name: chess-plans
description: Turn a chess engine's best moves into PLANS a player can understand — which candidate moves pursue the same idea (a kingside pawn storm, a minority attack, a central break, a quiet regrouping), how those ideas differ, and what each one concedes. Use for "what are the best moves here", "explain the engine's line", "what is White's plan", "why g4 and not a3", "what does the engine want me to do", or any chess position given as a FEN or a list of moves; also when reviewing or extending the realm's plan rules.
---

# Plans from engine lines

An engine gives moves and numbers. A player wants to know what the moves are FOR. This skill is
the bridge: get the engine's best lines, read each one for the plan it pursues, group the moves
that share a plan, and contrast the plans — always from facts a player can check on the board.

## 1. Get the lines

Everything starts from a complete FEN (six fields — who is to move changes every score).

| You want | Call |
|---|---|
| The best moves, filtered | view `BestMoves` — `{fen, withinCp: 50, maxLines: 5}` |
| The moves grouped by plan | view `PlansInPosition` — `{fen, withinCp: 50}` |
| A written explanation | view `ExplainPlans` — `{fen, withinCp: 50}` (one model call) |
| The vocabulary | view `PlanCatalogue`; one plan by name: `WhatPlanMeans` — `{plan: 'pawn storm'}` |
| Raw lines, any depth | `gateway.chess.analysePosition({fens: [fen], multiPv: 5, depth: 18})` |
| Your own question | `kg_query`: `MATCH (p:Position {fen: $fen})-[:HAS_CANDIDATE]->(c:CandidateMove) WHERE toInteger(c.lossCp) <= 50 ...` |

Given moves instead of a FEN, play them out with a chess library and take the FEN; do not
construct one by hand.

The engine is Stockfish 19 (lite, single-threaded WebAssembly) in the appliance's sandbox: five
lines at depth 18, one to four seconds for a new position, instant for one seen within the week.

## 2. Read the numbers correctly

- **Scores are for the side to move.** `scoreCp` +81 with Black to move is good for Black.
  `whiteCp` is the same number from White's side — use it only for display.
- **Compare moves by `lossCp`**, how much worse than the best line. 100 centipawns is a pawn.
- **Within 20 centipawns is style, not strength.** At depth 18 the engine cannot reliably order
  moves that close; say so. 20-50 is a real but small concession; over 100 is a mistake.
- **A forced mate outranks every number.** `mate` 3 means mate in three for the side to move;
  other lines' `lossCp` is null because they cannot be compared with it.
- **A search is not repeatable.** Two runs at the same depth can swap two close moves. The
  realm caches a position's lines for a week so an explanation and the numbers beside it agree;
  do not present a swap between runs as the engine "changing its mind".

## 3. Read each line for its plan

Every CandidateMove carries `plan` (the most specific plan its line matched), `planTags` (all
of them) and `facts` (what the rules saw: pawn moves by wing, breaks, castling and when, where
the kings end up, captures, settled material). **Write from `facts`, not from the raw moves** —
a model reading `g2g4 c8e6 d4e6` cold misreads it; the facts were computed on a real board.

The rules read the first ten plies (five moves by the side to move). The vocabulary, most
specific first — when a line matches several, the first wins:

| Plan | What it is | Read when |
|---|---|---|
| `mating-attack` | forced mate | the engine reports mate for the mover |
| `wins-material` | comes out 2+ points up | settled material +2 or more |
| `passed-pawn` | a free pawn runs | a pawn move lands with no enemy pawn ahead on its file or either neighbour |
| `kingside-pawn-storm` | f/g/h-pawns at the enemy king | middlegame, enemy king on the kingside, 2 pawn moves on f-h (1 if kings on opposite wings) |
| `queenside-pawn-storm` | a/b/c-pawns at the enemy king | mirror of the above |
| `minority-attack` | two pawns against three to leave a weakness | fewer a-c pawns than the opponent, b-pawn pushed, enemy king not there |
| `sacrifice-for-initiative` | material for time | settled material 2+ points down, no mate |
| `central-break` | a c-f pawn strikes an enemy pawn | own initiative — recapturing a pawn that just arrived is answering, not breaking |
| `central-control` | prepare a break | a pawn covers the square in front of your own centre pawn (f3 behind e3 for e4) |
| `simplification` | exchanges | 4+ captures in ten plies, or queens off |
| `kingside-expansion` / `queenside-expansion` | space, no king to hit | 2 pawn moves on a wing, not a storm or minority attack |
| `king-activity` | the king walks | queenless, 2+ king moves |
| `king-safety` | castle first | castles with its first or second move |
| `prophylaxis` | stop their idea | quiet king step (Kb1, Kh1), or a3/h3/a6/h6 not part of a storm |
| `development` | minor pieces out | develops a knight or bishop from the back rank |
| `piece-improvement` | quiet regrouping | 2+ quiet piece moves, nothing more specific |
| `manoeuvring` | nothing nameable | no rule matched |

`PlanCatalogue` returns the same table with what each plan concedes and when it is right.

## 4. Go past the tag where the tag is generic

The rules name what they can CHECK. Four tags mean "the rules could not say more", and there the
explanation must do the work, from the line and the structure:

- **`piece-improvement` / `manoeuvring`**: say WHICH piece goes WHERE and why that square — a rook
  to the only open file, a knight heading for an outpost, a bishop re-routed to the long diagonal.
- **`king-safety`**: castling is the move, but what does it prepare? If the kings end on opposite
  wings (`ownKing` vs `enemyKing` in the facts), the game is about to become a pawn-storm race.
- **`central-control`**: name the break it prepares (f3 → e4; c4 → d5 pressure) and when it comes.

Recognise the structure; each has plans players already know by name:

| Structure | Recognise it by | The plans |
|---|---|---|
| Opposite-side castling | kings on different wings | both sides storm; speed decides; pawns in front of your OWN king stay put |
| Carlsbad (QGD Exchange) | White d4/e3 vs Black c6/d5, White's c-pawn gone | White: minority attack b4-b5, or Ne5 + f4 (Pillsbury), or f3 + e4. Black: kingside play, ...Ne4 |
| Isolated queen's pawn | a lone d-pawn, no c/e pawns beside it | its owner attacks (kingside, d4-d5 break); the other side blockades d5 and trades pieces |
| Closed centre, pawn chains (French, King's Indian) | locked d/e pawns | attack on the wing your pawn chain points toward; break at the base of theirs (f3-f5 / c5) |
| Maroczy bind | White c4 + e4 vs a Sicilian | White squeezes; Black waits for ...b5 or ...d5 |
| Queenless middlegame | queens off, many pieces | king to the centre, rooks to open files, the better pawn structure wins |

Read the opponent's replies in the line too: they are the engine's best defence, and usually
show what the plan provokes (Black's ...d5 answering g4 in the Yugoslav is the counter-break
every storm invites).

## 5. Group, then contrast

1. **Group moves by plan.** Moves pursuing one plan are one idea however the engine ranks them:
   in the Yugoslav, g4 (+0.81) and Bb5 (h4 and g4 to follow) are one kingside storm; O-O-O is
   king safety with the same storm behind it.
2. **Name each plan in plain words** and cite its moves in notation — never "candidate 2".
3. **Keep now and later apart.** The first move is played now; everything after is the line.
   Write "Nb3, with O-O-O to follow", never "Nb3 castles".
4. **Contrast**: which plan is sharper, which quieter; what each concedes (`PlanCatalogue`); what
   the opponent gets in return.
5. **Weigh by the numbers from §2**: say "a matter of style" only within 20 centipawns.

A good answer, from a real run (Yugoslav Attack, White to move):

> Two plans. The engine's first choice is the kingside storm: g4 (+0.81), and Bb5 heads the
> same way, with h4 and g4 to follow. The quieter alternative is to castle first — O-O-O
> (+0.47) — and storm afterwards; it is 34 centipawns worse, a real if small concession,
> because Black's ...d5 break arrives before White's pawns do. Bc4 (+0.41) trades the
> light-squared bishops and aims for a simpler middlegame.

## 6. Never

- Never invent a move, a square or an evaluation. If the line does not show it, it did not
  happen.
- Never describe the engine's line past what it shows, or present a line as forced when the
  engine only prefers it.
- Never call a `lossCp` over 20 "equal" or "a matter of style".
- Never treat `plan` as a verdict on the POSITION. It is a reading of one line.

## 7. When a reading is wrong

The rules live in `src/lib/plans.ts`; the vocabulary in `reference/plans.yml`; the table above
restates both. When a line is read wrongly:

1. Capture the line (FEN + SAN) as a case in `tests/plans.test.ts` that fails.
2. Change the rule in `plans.ts` — prefer a rule a player could check on the board.
3. Update `detectedBy` in `reference/plans.yml` and the table in §3 in the same edit.
4. `npm run check`, then `realm_refresh`. Cached lines keep their old reading for a week; a
   restart of the worlds container clears the producer cache.
