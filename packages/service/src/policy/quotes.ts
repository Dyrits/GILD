import { sensitivityOf } from "./patterns.ts";

// Words that turn a request into a refusal when they come before it in the same sentence:
// "don't push it" must not approve a push. English and French, the owner's languages.
// Erring this way only costs a question (action-approval, Asking; CHG-0063).
const negations = new Set([
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
  "ne",
  "n",
  "pas",
  "jamais",
  "sans",
  "aucun",
  "aucune",
]);

// Words too common to show that a quote names a command the sensitive list misses.
const fillers = new Set([
  "the",
  "and",
  "this",
  "that",
  "these",
  "those",
  "with",
  "for",
  "from",
  "into",
  "now",
  "please",
]);

/** The lowercase words of a text; "don't" gives "do" and "dont", and French "n'envoie" gives "n" and "envoie". */
const wordsOf = (text: string) =>
  (
    text
      .toLowerCase()
      .replaceAll("’", "'")
      .match(/[\p{L}\p{N}']+/gu) ?? []
  ).flatMap((word) =>
    word.endsWith("n't") ? [word.slice(0, -3), "dont"] : word.split("'").filter((part) => part !== ""),
  );

/** Whether a word is the verb or one of its forms, such as "pushed" for "push". */
const isFormOf = (word: string, verb: string) =>
  word === verb || word === `${verb}s` || (verb.length >= 4 && word.startsWith(verb.replace(/e$/, "")));

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The sentence text before each place the quote appears as whole words, ignoring case. */
const leadsOf = (message: string, quote: string) => {
  const found = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(quote)}(?![\\p{L}\\p{N}])`, "giu");
  return [...message.matchAll(found)].map((match) => {
    const before = message.slice(0, match.index);
    return before.slice(Math.max(...[".", "!", "?", ";", "\n"].map((end) => before.lastIndexOf(end))) + 1);
  });
};

/** Whether the quoted words name the command's kind of action or, for a command the list misses, share a word with it. */
const isNamingAction = (quoteWords: ReadonlyArray<string>, command: string) => {
  const sensitivity = sensitivityOf("Bash", { command });
  if (sensitivity !== null) {
    return quoteWords.some((word) => sensitivity.verbs.some((verb) => isFormOf(word, verb)));
  }
  const commandWords = command.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return quoteWords
    .filter((word) => word.length >= 3 && !fillers.has(word))
    .some((word) => commandWords.some((commandWord) => isFormOf(commandWord, word)));
};

/**
 * Whether the owner's message approves the command through the thread's quote (action-approval,
 * Asking): the quote appears there as whole words, no negation comes before it in its sentence or
 * inside it, and it names the action.
 */
export const isNamingQuote = (message: string, quote: string, command: string) => {
  const words = quote.trim();
  const quoteWords = wordsOf(words);
  if (quoteWords.length === 0 || quoteWords.some((word) => negations.has(word))) return false;
  if (!isNamingAction(quoteWords, command)) return false;
  return leadsOf(message, words).some((lead) => !wordsOf(lead).some((word) => negations.has(word)));
};
