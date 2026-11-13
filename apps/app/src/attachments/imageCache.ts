/**
 * A cache of fetched images by identifier, holding at most `limit` characters of data: when a fetched image takes it over the limit, the least recently shown ones are dropped, and shown again they are fetched again.
 * A fetch still running is kept until it settles, so showing the same image twice makes one request; a failed fetch is forgotten.
 */
export function imageCache(limit: number) {
  const entries = new Map<string, { promise: Promise<string>; size: number }>();
  let total = 0;
  const evict = (keep: string) => {
    for (const [id, entry] of entries) {
      if (total <= limit) return;
      // Only fetched images count against the limit, and the one just fetched stays however large.
      if (entry.size === 0 || id === keep) continue;
      total -= entry.size;
      entries.delete(id);
    }
  };
  return {
    has: (id: string) => entries.has(id),
    /** The image's data, fetched with `fetch` unless already held. */
    load(id: string, fetch: () => Promise<string>) {
      const held = entries.get(id);
      if (held !== undefined) {
        // Most recently shown goes last.
        entries.delete(id);
        entries.set(id, held);
        return held.promise;
      }
      const entry = { promise: fetch(), size: 0 };
      entries.set(id, entry);
      entry.promise.then(
        (data) => {
          if (entries.get(id) !== entry) return;
          entry.size = data.length;
          total += data.length;
          evict(id);
        },
        () => {
          if (entries.get(id) === entry) entries.delete(id);
        },
      );
      return entry.promise;
    },
    get size() {
      return total;
    },
  };
}
