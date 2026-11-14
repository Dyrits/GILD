import type { Crest, RealmAppearance } from "@iskios/contracts";
import { folderNameOf } from "./realmLabels";

/** A form's real proposed values: an empty name resolves to its chosen folder's name. */
export const proposedRealmOf = <Draft extends { crest: Crest | null; name: string; path: string }>(draft: Draft) => ({
  ...draft,
  name: draft.name.trim() || folderNameOf(draft.path),
});

const crestKeyOf = (crest: Crest | null) =>
  crest === null
    ? null
    : JSON.stringify([
        crest.band,
        crest.bandWidth,
        crest.division,
        crest.edge,
        crest.emblemScale,
        crest.finish,
        crest.plate,
        crest.trim,
        crest.colors.band,
        crest.colors.edge,
        crest.colors.emblem,
        crest.colors.field,
        crest.colors.secondField,
        crest.colors.trim,
        crest.emblem._tag,
        crest.emblem._tag === "Charge"
          ? crest.emblem.id
          : crest.emblem._tag === "Glyph"
            ? crest.emblem.name
            : crest.emblem.text,
      ]);

/** Which comparison rows differ, comparing crest contents rather than object identity or property order. */
export const comparisonOf = (previous: RealmAppearance, proposed: RealmAppearance) => ({
  hasCrestDifference: crestKeyOf(previous.crest) !== crestKeyOf(proposed.crest),
  hasNameDifference: previous.name !== proposed.name,
});

/** The column chosen independently for each recoverable appearance field. */
export type RecoveryPicks = { crest: "old" | "proposed"; name: "old" | "proposed" };

/** Applies the two choices without replacing a field the owner chose to keep. */
export const recoveryAppearanceOf = (
  previous: RealmAppearance,
  proposed: RealmAppearance,
  picks: RecoveryPicks,
): RealmAppearance => ({
  crest: picks.crest === "old" ? previous.crest : proposed.crest,
  name: picks.name === "old" ? previous.name : proposed.name,
});
