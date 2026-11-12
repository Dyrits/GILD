/** Expanded Iskios owns the Companions tab; a docked conversation shares it with the visible page. */
export const isCompanionInScope = (isIskios: boolean, isIskiosFull: boolean) => !isIskiosFull || isIskios;
