// Structural actions by provenance (CHG-0208): whether one of the owner's own messages names a structural action the
// service derived from a tool call, with its resolved target and new value. The model supplies nothing here: the
// service picks the owner's messages (current turn only) and the target. Anything short of an unambiguous naming
// returns false, which costs one question, never a grant.

/** The structural actions the service derives from Iskios's tool calls. */
export type StructuralOperation =
  | "Stop"
  | "Done"
  | "Archive"
  | "Rename"
  | "ChangeSetting"
  | "CreateRealm"
  | "RenameRealm"
  | "CreateRitual";

/** One structural action as the owner would name it: what, on which target, and to what new value. */
export interface NamedAction {
  readonly operation: StructuralOperation;
  /** The names of the other targets of the same kind, such as the other quests' titles: naming one is ambiguous. */
  readonly rivals?: ReadonlyArray<string>;
  /** The names the target goes by, such as a quest's title or a setting's key; any one may be used. */
  readonly targets: ReadonlyArray<string>;
  /** The new value the owner must name too (a new title or name, a setting's value), or null. */
  readonly value: string | null;
}

const create = ["create", "make", "add", "new", "crée", "créer", "cree", "creer", "ajoute", "ajouter"];
const rename = ["rename", "renames", "retitle", "renomme", "renommer"];

/** The words that name each operation, and the nouns it also needs (a realm, a Ritual), in English and French. */
const vocabulary: Record<
  StructuralOperation,
  { readonly verbs: ReadonlyArray<string>; readonly nouns: ReadonlyArray<string> }
> = {
  Archive: { nouns: [], verbs: ["archive", "archives", "archiver", "archivé", "archivée"] },
  ChangeSetting: {
    nouns: [],
    verbs: [
      "set",
      "change",
      "turn",
      "switch",
      "enable",
      "disable",
      "mets",
      "mettre",
      "changer",
      "active",
      "activer",
      "désactive",
      "désactiver",
    ],
  },
  CreateRealm: { nouns: ["realm", "royaume"], verbs: create },
  CreateRitual: { nouns: ["ritual", "rituel"], verbs: [...create, "schedule", "planifie"] },
  Done: {
    nouns: [],
    verbs: [
      "done",
      "finish",
      "finished",
      "complete",
      "completed",
      "termine",
      "terminé",
      "terminée",
      "terminer",
      "fini",
      "finie",
    ],
  },
  Rename: { nouns: [], verbs: rename },
  RenameRealm: { nouns: ["realm", "royaume"], verbs: rename },
  Stop: { nouns: [], verbs: ["stop", "stops", "halt", "arrête", "arrete", "arrêter", "arreter", "stoppe", "stopper"] },
};

// Words that turn a request into a refusal, a doubt, or a question: "don't archive it", "maybe archive it".
const blockers = new Set([
  "no",
  "not",
  "never",
  "nor",
  "without",
  "dont",
  "cannot",
  "avoid",
  "stop",
  "wait",
  "hold",
  "postpone",
  "maybe",
  "perhaps",
  "should",
  "could",
  "would",
  "might",
  "if",
  "whether",
  "instead",
  "except",
  "unless",
  "ne",
  "n",
  "pas",
  "jamais",
  "sans",
  "aucun",
  "aucune",
  "peut",
  "si",
  "sauf",
  "plutôt",
]);

/** The lowercase words of a text; "don't" gives "do" and "dont", and French "n'archive" gives "n" and "archive". */
const wordsOf = (text: string) =>
  (
    text
      .toLowerCase()
      .replaceAll("’", "'")
      .match(/[\p{L}\p{N}']+/gu) ?? []
  ).flatMap((word) =>
    word.endsWith("n't") ? [word.slice(0, -3), "dont"] : word.split("'").filter((part) => part !== ""),
  );

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Where a phrase appears as whole words, ignoring case. */
const phraseOf = (phrase: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase.trim())}(?![\\p{L}\\p{N}])`, "giu");

// A sentence ends at . ! ? ; followed by a space or the end, or at a line break, so "v1.2" stays whole.
const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
// One request per segment: "rename A to B and archive C" names two separate actions.
const segmentsOf = (sentence: string) =>
  sentence
    .split(/,|\s(?:and|then|but|also|et|puis|mais|aussi)\s/i)
    .map((part) => part.trim())
    .filter(Boolean);

interface Span {
  readonly end: number;
  readonly start: number;
}

/** Every place a name appears in the text as whole words; names shorter than 3 characters never count. */
const spansOf = (text: string, names: ReadonlyArray<string>): Array<Span> =>
  names
    .map((name) => name.trim())
    .filter((name) => name.length >= 3)
    .flatMap((name) => [...text.matchAll(phraseOf(name))].map((m) => ({ end: m.index + m[0].length, start: m.index })));

/** Whether a span lies inside a strictly longer one. */
const isWithin = (inner: Span, outer: Span) =>
  outer.start <= inner.start && inner.end <= outer.end && outer.end - outer.start > inner.end - inner.start;

/** The text with the spans blanked out, so their words are not read as the request's own. */
const blanked = (text: string, spans: ReadonlyArray<Span>) =>
  spans.reduce(
    (rest, span) => rest.slice(0, span.start) + " ".repeat(span.end - span.start) + rest.slice(span.end),
    text,
  );

/** Whether the segment names the action: its words, its target, then its value, with nothing else asked. */
const isNamedIn = (segment: string, sentence: string, action: NamedAction) => {
  const rivals = spansOf(segment, action.rivals ?? []);
  // A target inside a longer rival name ("Report" in "Weekly report draft") is that rival, not the target.
  const target = spansOf(segment, action.targets).find((span) => !rivals.some((rival) => isWithin(span, rival)));
  if (target === undefined) return false;
  const spans: Array<Span> = [target];
  if (action.value !== null) {
    const after = segment.slice(target.end);
    const value = spansOf(after, [action.value])[0];
    if (value === undefined) return false;
    spans.push({ end: target.end + value.end, start: target.end + value.start });
  }
  // Any other target named beside it, outside the target and the new value, makes the request ambiguous.
  const isCovered = (rival: Span) => spans.some((span) => span.start <= rival.start && rival.end <= span.end);
  if (rivals.some((rival) => !isCovered(rival))) return false;
  const rest = blanked(segment, spans);
  const offset = sentence.indexOf(segment);
  const whole =
    offset === -1
      ? rest
      : blanked(
          sentence,
          spans.map((span) => ({ end: span.end + offset, start: span.start + offset })),
        );
  const own = vocabulary[action.operation];
  const ownWords = new Set([...own.verbs, ...own.nouns]);
  const words = wordsOf(rest);
  if (!words.some((word) => own.verbs.includes(word))) return false;
  if (own.nouns.length > 0 && !words.some((word) => own.nouns.includes(word))) return false;
  const others = Object.entries(vocabulary)
    .filter(([operation]) => operation !== action.operation)
    .flatMap(([, other]) => other.verbs)
    .filter((word) => !ownWords.has(word));
  if (words.some((word) => others.includes(word))) return false;
  return !wordsOf(whole).some((word) => blockers.has(word) && !ownWords.has(word));
};

/**
 * Whether the owner's message names the action unambiguously: in one sentence that is not a question, one request
 * holds the action's words, its target, then its new value where it has one, with no refusal, doubt, or other action.
 */
export const isNamedByOwner = (message: string, action: NamedAction) =>
  sentencesOf(message).some(
    (sentence) =>
      !sentence.endsWith("?") && segmentsOf(sentence).some((segment) => isNamedIn(segment, sentence, action)),
  );
