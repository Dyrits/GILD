/** A folder path without a trailing separator or the `/private` that macOS puts in front of a resolved link. */
const normalizedPath = (path: string) => path.replace(/[\\/]+$/, "").replace(/^\/private(?=\/)/, "");

/** Whether two folder paths name the same folder; a link the service resolved differently is not recognised here. */
export const samePath = (a: string | null, b: string | null) =>
  a !== null && b !== null && normalizedPath(a) === normalizedPath(b);
