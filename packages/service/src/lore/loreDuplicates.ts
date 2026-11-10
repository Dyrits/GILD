import { wordsOf } from "../core/index.ts";
import { type LoreEntryRow, type Placement, type ScopeChain, widthOf } from "./lore.ts";
import { type Fading, stateOfLoreEntry } from "./loreFading.ts";

// Duplicates (scoped-intel, Duplicates): before a save, the closest lore entries in the same scope and the scopes
// above it. One in the same scope close enough says the same thing, or an older version of it, and the save
// replaces it; when in doubt the save stays new and the answer names the close ones. Provisional
// (work-in-progress, Batch 14): closeness is the share of meaningful words two texts have in common, with no
// semantic matching; and a lore entry in a wider scope is never replaced, only named, since a narrower lore entry that
// differs from it is an override (scoped-intel, Lookup: the most specific wins).

/** At or above this closeness a save replaces the lore. */
const sameAt = 0.6;
/** At or above this closeness, but below `sameAt`, the answer names the lore for the thread to check. */
const closeAt = 0.3;
/** The fewest shared words for a replacement, so two short texts sharing one word stay apart. */
const fewestShared = 2;
/** The most close lore entries an answer names. */
const closeLimit = 3;

/** Twice the shared words over both texts' words (the Dice coefficient), from 0 to 1, with the count shared. */
const closenessOf = (a: ReadonlySet<string>, b: ReadonlySet<string>) => {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return { closeness: a.size + b.size === 0 ? 0 : (2 * shared) / (a.size + b.size), shared };
};

/** Whether two texts say the same thing, as a save that replaces a lore entry does. */
export const isSameOf = (a: string, b: string) => {
  const { closeness, shared } = closenessOf(wordsOf(a), wordsOf(b));
  return closeness >= sameAt && shared >= fewestShared;
};

/** What a save finds among the lore entries already kept. */
export interface Duplicates {
  /** Lore entries close to the save but not the same, closest first. */
  readonly close: ReadonlyArray<LoreEntryRow>;
  /** The lore the save replaces, or null when it saves a new one. */
  readonly replaced: LoreEntryRow | null;
}

/**
 * The lore entries in the saving thread's scope, in the save's scope or a wider one, that the save may repeat.
 * Archived lore is left out, as search leaves it out. `inScope` is the thread's scope, most specific first.
 */
export const duplicatesOf = (
  text: string,
  placement: Placement,
  chain: ScopeChain,
  inScope: ReadonlyArray<LoreEntryRow>,
  fading: Fading,
): Duplicates => {
  const width = widthOf(placement, chain.topThreadId);
  const words = wordsOf(text);
  const scored = inScope
    .filter(
      (row) =>
        widthOf({ scope: row.scope, threadId: row.threadId, workspaceId: row.workspaceId }, chain.topThreadId) >=
          width && stateOfLoreEntry(row, fading) !== "Archived",
    )
    .map((row) => ({ row, ...closenessOf(words, wordsOf(row.text)) }))
    // Stable: equally close lore entries keep the scope order, most specific first.
    .toSorted((a, b) => b.closeness - a.closeness);
  const isSamePlace = (row: LoreEntryRow) =>
    row.scope === placement.scope && row.threadId === placement.threadId && row.workspaceId === placement.workspaceId;
  const same = scored.find(
    (candidate) => isSamePlace(candidate.row) && candidate.closeness >= sameAt && candidate.shared >= fewestShared,
  );
  return {
    close: scored
      .filter((candidate) => candidate !== same && candidate.closeness >= closeAt)
      .slice(0, closeLimit)
      .map(({ row }) => row),
    replaced: same?.row ?? null,
  };
};
