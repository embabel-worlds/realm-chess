/*
 * What a handler hands back. The manifest declares a field such as `mate` or `averageRating` as
 * a number, and the host checks every result against it, so a field with no value is left out
 * of the record; it is never sent as null. Inside the realm the records keep their nulls, since
 * the board code and the plan prompt read them that way.
 */

/**
 * A record's type once its valueless fields are left out: a field that may be null becomes an
 * optional field that is never null, which is how the generated handler types declare it.
 */
export type WithValues<T> = { [K in keyof T as null extends T[K] ? never : K]: T[K] } & {
  [K in keyof T as null extends T[K] ? K : never]?: Exclude<T[K], null>;
};

/** The record with every field that has no value left out. */
export function withValues<T extends object>(record: T): WithValues<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) if (v !== null && v !== undefined) out[k] = v;
  return out as WithValues<T>;
}

/** Every record with its valueless fields left out. */
export const allWithValues = <T extends object>(records: readonly T[]): WithValues<T>[] => records.map(withValues);
