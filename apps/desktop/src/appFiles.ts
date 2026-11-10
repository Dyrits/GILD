import { existsSync, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";

/**
 * The file inside `root` that answers a request path of the packaged window's own scheme. A path with no file
 * extension, or one that names nothing, is a screen of the single-page app, so it answers with `index.html`;
 * a path that leaves `root` answers null.
 */
export const appFileOf = (root: string, requestPath: string): string | null => {
  const relative = normalize(join(sep, decodeURIComponent(requestPath))).slice(1);
  const file = join(root, relative);
  if (file !== root && !file.startsWith(root + sep)) return null;
  if (existsSync(file) && statSync(file).isFile()) return file;
  return extname(relative) === "" ? join(root, "index.html") : null;
};
