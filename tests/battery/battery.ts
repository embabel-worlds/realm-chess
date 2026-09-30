import { Chess } from "chess.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

/* The battery of common positions, with each position's FEN computed from its moves. */
export interface ExpectedPlan { plan: string; anyOf: string[]; not?: string[] }
export interface BatteryPosition {
  id: string;
  opening: string;
  moves?: string;
  fen: string;
  source: string;
  imbalances: string[];
  plans: { white: ExpectedPlan[]; black: ExpectedPlan[] };
}

export function battery(): BatteryPosition[] {
  const raw = parse(readFileSync(join(__dirname, "positions.yml"), "utf8")) as (Omit<BatteryPosition, "fen"> & { fen?: string })[];
  return raw.map((p) => {
    if (p.fen) return { ...p, fen: p.fen } as BatteryPosition;
    const c = new Chess();
    for (const m of p.moves!.split(/\s+/)) c.move(m);
    return { ...p, fen: c.fen() } as BatteryPosition;
  });
}
