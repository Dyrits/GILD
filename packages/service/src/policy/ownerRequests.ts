// Structural actions by provenance (CHG-0208): whether one of the owner's own messages names a structural action the
// service derived from a tool call, with its resolved target and new value. The model supplies nothing here: the
// service picks the owner's messages (current turn only) and the target. Anything short of an unambiguous naming
// returns false, which costs one question, never a grant.

import { blockers, type NamedAction, type StructuralOperation, vocabulary, wordsOf } from "./ownerRequestWords.ts";

export type { NamedAction, StructuralOperation };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A folder path stands alone: after the start, a space, or opening quotes, brackets or emphasis that follow one; and
// before an optional trailing separator, closing quotes, brackets or emphasis, sentence punctuation, then a space or
// the end. Anything else joined to it makes it part of a longer path.
const pathBefore = "(?<=^|\\s|(?:^|\\s)[\"'`([{<“‘«*]+)";
const pathAfter = "(?=(?:[/\\\\]?[\"'`)\\]}>»”’]*|\\*+)[.,;:!?]*(?:\\s|$))";

/**
 * Where a phrase appears as whole words, ignoring case. A folder path is found only as a whole path (audit SA-02): not
 * `/dummy/root` inside `/dummy/root/projects/app`, `/dummy/root//app`, `/dummy/root/)old`, `/dummy/root-old` or
 * `/other/dummy/root`. Anything short of a whole path asks, which costs a question, never a grant.
 */
const phraseOf = (phrase: string) => {
  const trimmed = phrase.trim();
  const escaped = escapeRegExp(trimmed);
  if (/^[/\\]/.test(trimmed)) return new RegExp(`${pathBefore}${escaped}${pathAfter}`, "giu");
  return new RegExp(`(?<![\\p{L}\\p{N}]|\\S[/\\\\])${escaped}(?![\\p{L}\\p{N}]|[/\\\\]\\S)`, "giu");
};

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
    .flatMap((name) =>
      [...text.matchAll(phraseOf(name))].map((match) => ({ end: match.index + match[0].length, start: match.index })),
    );

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

/** Whether the action's target also names one of its rivals: two quests with one title cannot be told apart by name. */
const isTargetShared = (action: NamedAction) => {
  const rivals = new Set((action.rivals ?? []).map((name) => name.trim().toLowerCase()));
  return action.targets.some((name) => rivals.has(name.trim().toLowerCase()));
};

/** Whether the other sentences of the message take it back, hesitate, or change the subject (audit SA-03). */
const isRetractedElsewhere = (others: ReadonlyArray<string>, action: NamedAction) => {
  const own = vocabulary[action.operation];
  const ownWords = new Set([...own.verbs, ...own.nouns]);
  return wordsOf(others.join(" ")).some((word) => blockers.has(word) && !ownWords.has(word));
};

/**
 * Whether the owner's message names the action unambiguously: in one sentence that is not a question, one request
 * holds the action's words, its target, then its new value where it has one, with no refusal, doubt, or other action,
 * and no other sentence of the message that retracts it. A target that another quest shares is never unambiguous.
 */
export const isNamedByOwner = (message: string, action: NamedAction) => {
  if (isTargetShared(action)) return false;
  const sentences = sentencesOf(message);
  return sentences.some(
    (sentence, index) =>
      !sentence.endsWith("?") &&
      segmentsOf(sentence).some((segment) => isNamedIn(segment, sentence, action)) &&
      !isRetractedElsewhere(
        sentences.filter((_, other) => other !== index),
        action,
      ),
  );
};
