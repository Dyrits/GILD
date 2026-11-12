/** The outcome of an operation that can fail in an expected way: a value, or a named kind of failure. */
export type Result<Value, Kind extends string> = { ok: true; value: Value } | { kind: Kind; ok: false };

export function succeed<Value>(value: Value): { ok: true; value: Value } {
  return { ok: true, value };
}

export function fail<Kind extends string>(kind: Kind): { kind: Kind; ok: false } {
  return { kind, ok: false };
}
