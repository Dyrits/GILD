/** Where a folder lies, for the line under its name in the folder picker: the folder above it. The top of the file system has no parent. */
export const parentLabelOf = (path: string): string => {
  const trimmed = path.length > 1 ? path.replace(/[\\/]+$/, "") : path;
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (cut < 0 || trimmed.length === 1) return "";
  return cut === 0 ? trimmed.slice(0, 1) : trimmed.slice(0, cut);
};
