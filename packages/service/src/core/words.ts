// Words too common to say anything about a mission.
const commonWords = new Set(
  "the and for with from this that into about your our are was were will can have has what how why when where who all any not but you its his her their them then than there here also just some more most very".split(
    " ",
  ),
);

/** The distinct meaningful words of a text, lowercased, with a plural's final s dropped. */
export const wordsOf = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3 && !commonWords.has(word))
      .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word)),
  );
