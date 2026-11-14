import type { Crest } from "@iskios/contracts";
import { crestOf } from "../crest/crestShapes";

/** The id the new-realm menu draws an undesigned crest from: the folder's path, or a fixed id while none is chosen. */
export const newRealmCrestId = (path: string) => (path === "" ? "new-realm" : path);

/**
 * The crest the menu shows for a realm being made: the one designed, or the one its folder gives. The realm is made
 * wearing exactly this crest, since the saved realm has another id (its own) and would draw another default.
 */
export const shownCrestOf = (realm: { crest: Crest | null; path: string }): Crest =>
  crestOf(realm.crest, newRealmCrestId(realm.path));
