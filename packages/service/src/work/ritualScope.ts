import type { RitualScope, RitualScopeEntry } from "@iskios/contracts";
import { Effect } from "effect";
import { invalid } from "../core/index.ts";
import { changeableSettings } from "./guildmasterSettings.ts";

// A Ritual's reviewed scope (CHG-0208): the structural actions its later runs may take without asking. The owner sets
// it in the Ritual's form and can empty it at any time; nothing a run writes widens it.

/** The JSON value of a setting's text, compared whole; undefined when it is not JSON. */
const jsonTextOf = (text: string) => {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return undefined;
  }
};

/** Refuses a scope entry that is not exact: a missing or stray new value, or a setting Iskios may not change. */
export const validateScope = (scope: RitualScope) =>
  Effect.gen(function* () {
    for (const entry of scope) {
      if (entry.target.trim() === "") return yield* invalid("Each allowed action needs its exact target.");
      const isValued = entry.operation === "Rename" || entry.operation === "ChangeSetting";
      if (isValued && (entry.payload === null || entry.payload.trim() === ""))
        return yield* invalid(`${entry.operation} needs its exact new value.`);
      if (!isValued && entry.payload !== null) return yield* invalid(`${entry.operation} takes no new value.`);
      if (entry.operation === "ChangeSetting") {
        if (!(changeableSettings as ReadonlyArray<string>).includes(entry.target.trim()))
          return yield* invalid(`A Ritual cannot be allowed to change ${entry.target}.`);
        if (jsonTextOf(entry.payload ?? "") === undefined)
          return yield* invalid("A setting's value must be JSON text, such as true or 14.");
      }
    }
    return scope;
  });

/** One structural action as the service derived it, in the terms a scope entry uses. */
export interface ScopedAction {
  readonly operation: RitualScopeEntry["operation"];
  readonly payload: string | null;
  /** The names the target goes by: a quest's id and title, or a setting's name. */
  readonly targets: ReadonlyArray<string>;
}

/** Whether a scope entry covers the action exactly: same operation, same target, same new value. */
const covers = (entry: RitualScopeEntry, action: ScopedAction) => {
  if (entry.operation !== action.operation) return false;
  const target = entry.target.trim().toLowerCase();
  if (!action.targets.some((name) => name.trim().toLowerCase() === target)) return false;
  if (action.operation === "ChangeSetting")
    return (
      entry.payload !== null && action.payload !== null && jsonTextOf(entry.payload) === jsonTextOf(action.payload)
    );
  return (entry.payload?.trim() ?? null) === (action.payload?.trim() ?? null);
};

/** The scope entry covering the action, or null: anything outside the reviewed scope asks. */
export const coveringEntryOf = (scope: RitualScope, action: ScopedAction) =>
  scope.find((entry) => covers(entry, action)) ?? null;
