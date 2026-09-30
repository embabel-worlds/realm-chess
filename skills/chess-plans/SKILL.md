---
name: chess-plans
description: Decide the PLANS in a chess position for both sides — what each side should be trying to do and why — from the position's imbalances (Silman), its opening, and a strong engine's candidate moves. Use for "what's the plan here", "what should White be aiming for", "explain the engine's moves", "why g4 and not a3", "what is Black's counterplay", or any chess position given as a FEN or moves; and whenever realm-chess asks a model to name plans.
---

# Plans in a chess position

A plan is what a side is trying to achieve over the next several moves, and why the position
calls for it. Plans come from the **imbalances** — the differences between the two sides
(Jeremy Silman) — and are checked against the **engine's candidate moves**, which say which
plans work concretely, and in which move order. The engine gives moves; this skill turns them
into ideas a player can carry.

## 1. What you are given

realm-chess gives you, for one position:

- the **FEN** and the side to move;
- the **opening-book name** when the position is a named line (Lichess opening book). A name
  tells you which structure and which known plans are in play — use it;
- the **imbalances**, computed from the board and stated as sentences. They are correct; do not
  re-derive them, and do not invent ones that are not listed;
- the **engine's candidate moves** for the side to move (Stockfish, depth 18): each with its
  score, how much worse than the best it is, its line, and what imbalances it **creates** and
  **removes** once its exchanges settle.

Asked in conversation, get the same inputs from the realm: views `PositionImbalances`,
`OpeningOf`, `BestMoves` and `PlansInPosition` (all take `{fen}`).

## 2. The method

1. **Read the imbalances for both sides.** Sort them into *static* (pawn structure, bishop
   pair, material, outposts — they last) and *dynamic* (development lead, king in the centre,
   initiative, open lines to a king — they fade if not used).
2. **For each side, list its pluses and its minuses.** A plan does one of four things: exploit
   your plus, attack their minus, repair your minus, or neutralise their plus. A side with
   dynamic pluses must act before they fade; a side with static pluses can be patient.
3. **Find where the play is.** Locked chains decide the wing (§3). Kings on opposite wings mean
   a race. A half-open file decides where the rooks go. A weak square decides where a knight goes.
4. **Check against the engine.** For the side to move, which candidate moves carry which plan?
   Moves that serve one plan belong together however the engine ranks them. If the best move
   fits no plan — it is tactical, a threat that must be met, or a necessary prophylactic move —
   say that, plainly. If a natural plan appears in none of the candidate lines, the engine is
   telling you it does not work *now*: say what it is waiting for.
5. **Name the plans for BOTH sides**, most important first. The side not to move has plans too;
   read them from the imbalances and from the replies inside the engine's lines.

## 3. What each imbalance calls for

**Minor pieces**
- *Bishop pair*: open the position (pawn breaks, exchanges of pawns, not of bishops); in an
  endgame it is worth about half a pawn. The other side keeps the position closed and tries to
  trade one of the bishops.
- *Knight against bishop*: knights want closed positions and **outposts** — a square no enemy
  pawn can attack. Bring the knight there (name the route). The bishop's side opens lines.
- *Bad bishop* (most own pawns on its colour): trade it, reroute it outside the chain, or move
  the pawns to the other colour. *Bad but active* (outside its chain) is fine now and poor in an
  endgame — do not exchange it for a good knight carelessly.
- *Opposite-coloured bishops*: with queens and rooks on, the attacker is effectively a piece up
  — attack the king on the colour the defender's bishop cannot cover. In a pure endgame, drawish.

**Pawn structure**
- *Isolated queen's pawn (IQP)*: its owner has space and active pieces — attack, often on the
  kingside, with the d4-d5 break as the key lever; avoid exchanges. The opponent blockades the
  square in front (d5, ideally with a knight), trades pieces, and wins the pawn in the endgame.
- *Hanging pawns* (c+d abreast, no neighbours): dynamic while they stand; their owner advances
  one at the right moment. The opponent pressures them to force an advance that leaves holes.
- *Backward pawn*: the square in front of it is an outpost for the opponent (d5 in the Najdorf,
  e5 in the Stonewall) — occupy it. Its owner tries to advance it (…d5 in the Najdorf) or trade it.
- *Doubled pawns*: weak in endgames, but they often bring open files and bishops (Ruy Exchange).
- *Passed pawn*: push it when it is supported; the opponent blockades it, ideally with a knight.
- *Pawn majority*: a healthy majority makes a passed pawn — its owner simplifies toward the
  endgame. A crippled majority (doubled pawns) cannot. The side with the queenside majority
  often wants the endgame; the side with the kingside majority often attacks.
- *Minority attack*: two pawns advanced against three (b4-b5 against a6/b7/c6) to leave a
  weak, backward or isolated pawn — slow, positional.

**Space and chains**
- *More space*: avoid exchanges — the cramped side needs them. Squeeze; prevent the freeing
  breaks. The cramped side exchanges pieces and prepares a freeing pawn break.
- *Locked pawn chain*: **play on the wing the chain points to** (the side its head faces), and
  **attack the base** of the opponent's chain. King's Indian: White's d5/e4 points queenside
  (c4-c5), Black's e5/d6 points kingside (…f5, …f4, …g5). French: White's e5/d4 points kingside,
  Black's d5/e6 points queenside (…c5 against d4, the base).

**Files and squares**
- *Open file*: whoever doubles rooks on it first controls it; an entry square on the 7th rank
  is the goal.
- *Half-open file*: the rook presses the pawn at the end of it (the minority attack uses the
  c-file; Black in the Dragon uses the c-file).
- *Outpost*: plant a knight there; name the route (Nf1-e3-d5, Nd2-b3-c5).

**Development and kings**
- *Development lead, king in the centre*: open the centre now, before the lead fades.
- *Kings on opposite wings*: pawn storms cost nothing in king safety — both sides throw pawns
  at the other king and the faster attack wins. Speed matters more than material.
- *Exposed king*: bring pieces to it; open lines with pawn breaks.

**Material**
- *The exchange up*: open files for the rook; trade the opponent's active minor pieces.
- *Minor piece for pawns*: the pawns want to run in an endgame; the piece wants targets.
- *Queen against rooks*: the queen wants loose pawns and a king to harass; rooks want to
  double and hold together.

## 4. Structures and the plans that go with them

When the opening-book name or the structure matches one of these, use its plans — and say
which it is. **Openings with the same name can call for opposite plans.** Pay particular
attention to the pairs.

| Structure | How to recognise it | White's plans | Black's plans |
|---|---|---|---|
| **King's Indian, Classical (Mar del Plata)** | White d5/e4/c4, Black d6/e5, closed centre, both castled short | queenside: c4-c5, b4, Nd3, Rc1 — the chain points queenside | kingside storm: …Ne8/…Nd7, …f5, …f4, …g5-g4 — the chain points kingside; a race |
| **King's Indian, Sämisch** | White f3, Be3, Qd2, king often still in the centre | kingside attack: O-O-O, Bh6 to trade the fianchettoed bishop, h4-h5, g4 | queenside counterplay: …a6, …Rb8, …b5 (Panno), or …c5 against d4 |
| **Ruy Lopez, Exchange** | Bxc6 dxc6: Black has the bishop pair and doubled c-pawns, White a healthy kingside majority | simplify toward the endgame (queens off), make a passed pawn from the kingside majority with f4/e5; a knight against a bad bishop | use the bishop pair, keep pieces active, avoid a pure pawn endgame, …f6/…c5 structure |
| **Ruy Lopez, Closed (Ba4 lines)** | c3/d4 against …d6/…e5, …b5, …Na5/…c5 | regroup Nbd2-f1-g3 toward the kingside; keep the centre or close it with d5 and attack; a4 against b5 | queenside expansion (…c4, …Nc6, …cxd4), pressure d4; …Re8/…Bf8 regroup |
| **Carlsbad (QGD Exchange)** | White d4/e3 against …d5/…c6, White's c-pawn gone | minority attack: Rab1, b4-b5; or f3 and e4 in the centre; or Ne5 and f4 (Pillsbury) | kingside play: …Ne4, …Nf8-g6, …Bd6; against the minority attack, …a5 or accept …c6 and use c4 |
| **IQP (Panov, Tarrasch, Nimzo lines)** | an isolated d-pawn, c- and e-files half-open | attack: Bc2/Qd3 battery, Ne5, Re1-e3 lifts, the d4-d5 break | blockade d5, trade pieces, press d4 with …Rd8 and a knight |
| **French, Advance** | White e5/d4 against …d5/…e6 | hold d4, kingside space and attack; f4-f5 | attack the base: …c5, …Qb6, …Nc6, …Nge7-f5 on d4; …f6 to hit the head |
| **Sicilian Najdorf, English Attack** | White Be3/f3, Black …e5 or …e6 | Qd2, O-O-O, g4-g5 storm; control d5 | …b5-b4 queenside attack; the …d5 break |
| **Sicilian Dragon, Yugoslav** | White Be3/f3/Qd2, Black …g6/…Bg7 | O-O-O, h4-h5 to open the h-file, Bh6 to trade the dragon bishop | down the c-file (…Rc8, …Rxc3 sacrifices), …b5, …d5 |
| **Maroczy Bind** | White c4+e4 against the Accelerated Dragon | keep the bind, prevent …b5 and …d5, slow squeeze | trade pieces, then …a5/…b5 or …f5 to break the bind; dark squares |
| **Modern Benoni** | White d5 with a central majority, Black a queenside majority | e4-e5 break (prepared by f4, Re1) | queenside majority …a6/…b5; …Re8 against e4 |
| **Stonewall (Dutch)** | Black …f5/…e6/…d5/…c6 | occupy the e5 hole, trade dark-squared bishops (Ba3), light-square play | kingside attack: …Ne4, …Qe8-h5, …g5 |
| **Catalan** | White g3/Bg2 against …d5/…e6 | long diagonal and the queenside: a4, Rc1, Bf4, the c-file | free the position with …c5; develop …Nbd7, …Bb7 |
| **Hedgehog** | Black pawns a6/b6/d6/e6 | slow squeeze, prevent …b5 and …d5 | wait, then break with …b5 or …d5 at the right moment |
| **Rook endgames** | rooks and pawns | activate the king and rook; rook behind passed pawns; Lucena: build a bridge (rook to the 4th rank) | Philidor: rook on the 3rd rank, then check from behind; activity over material |

## 5. Using the engine

- Scores are for the side to move unless stated "from White's side".
- **Within 20 centipawns is style, not strength.** Two candidate moves that close serving
  different plans are a genuine choice — say so; that is what the player wants to know.
  20–50 is a real but small concession; over 100 is a mistake.
- **A forced mate outranks every plan.** Say so and stop.
- A move's **creates / removes** list is the best evidence of what it is for: "Bxc6 creates:
  Black has the bishop pair; Black has doubled pawns on the c-file" is the Exchange Ruy plan.
- The lines are the engine's best guess for both sides after the first move. Read the
  opponent's replies: they show the counterplay each plan provokes.

## 6. How to write it

- Name each plan in plain words, then its idea in two to four sentences, then its key moves in
  notation, then the imbalances it uses — quoted as they were given.
- Plans for **both** sides, most important first, at most three each.
- **The first plan is the strategic one the structure calls for** — the §4 row's plan when a row
  matches. Development, castling, trading a bad piece, putting a rook on a file: these are almost
  always *steps* in carrying a plan out, so put them in that plan's moves, not first in the list.
  Lead with one only when it IS the point of the position (a king caught in the centre that must
  castle now; a bad bishop whose exchange decides the game).
- The engine's best move for the side to move is often such a step (Nc1 regrouping in the
  Samisch, Rab1 in the Carlsbad). Explain which strategic plan it serves; do not promote the step
  to the plan.
- Tie the side to move's plans to candidate moves ("carried by c5 and b4, the engine's first and
  third choices"). If none of the candidates carries a plan, say that too.
- The summary says who stands better and why, in terms of the imbalances, and how the plans
  collide — a race, a squeeze, a blockade against an attack.
- Never invent a move, a square, an evaluation or an imbalance. If the inputs do not show it,
  it is not there.
- Never describe a line past what it shows, or call a preferred line forced.

## 7. Opening book and master games

The opening name is a strong prior: the structure's known plans (§4) are usually right, and a
plan that contradicts the named structure needs strong evidence from the engine.

When the realm also provides **master-game statistics** for the position (the moves strong
players chose and how they scored), treat them as evidence of which plans work *in practice*,
next to the engine's which-plan-works-*concretely*. Where the two disagree, say so — a move
masters favour that the engine rates slightly lower is often the more practical plan.
