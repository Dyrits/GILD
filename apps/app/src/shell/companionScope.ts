/** Expanded Iskios owns the Companions tab; a docked conversation shares it with the visible page. */
export const isCompanionInScope = (isIskios: boolean, isIskiosFull: boolean) => !isIskiosFull || isIskios;

/**
 * Whether the Companions tab offers a Companion: it is in scope, and Iskios's own only while Iskios is open on the
 * right. With nothing offered and no quest panel, the right-hand column and its handle are not there.
 */
export const isCompanionOffered = (isIskios: boolean, isIskiosFull: boolean, isIskiosOpen: boolean) =>
  isCompanionInScope(isIskios, isIskiosFull) && (!isIskios || isIskiosOpen);
