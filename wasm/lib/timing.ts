/*
 * How long each stage of a dispatch took, for tests that profile a handler. It stays off unless a
 * test entry turns it on, and nothing here is printed or returned by the realm's own verbs.
 */

export const timing: { on: boolean; stages: Record<string, number> } = { on: false, stages: {} };

/** Runs one stage, adding its wall time to the stage's total when timing is on. */
export async function timed<T>(stage: string, work: () => T | Promise<T>): Promise<T> {
  if (!timing.on) return work();
  const started = Date.now();
  try {
    return await work();
  } finally {
    timing.stages[stage] = (timing.stages[stage] ?? 0) + Date.now() - started;
  }
}

/** The synchronous form, for stages that never wait on the host. */
export function timedSync<T>(stage: string, work: () => T): T {
  if (!timing.on) return work();
  const started = Date.now();
  try {
    return work();
  } finally {
    timing.stages[stage] = (timing.stages[stage] ?? 0) + Date.now() - started;
  }
}
