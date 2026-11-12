import { Effect } from "effect";
import type { ToolAnswer } from "../core/index.ts";
import { type GuideTopic, guideTopics } from "./appGuideTopics.ts";
import { unchanged, type WithFollowUps } from "./commands.ts";
import { isGuildmasterThread } from "./guildmaster.ts";
import type { ArgumentsOf } from "./threadTools.ts";

// Iskios's app guide tool (quest coordination, "Iskios explains how the app works"): it reads one topic of the user
// guide (appGuideTopics.ts) when a question about the app needs it, as `read_journal` reads a quest's journal, so the
// guide is never part of every turn. Only Iskios reads it.

const answer = (value: ToolAnswer): WithFollowUps<ToolAnswer> => unchanged(value);

/** What every answer ends with: Iskios answers from the guide, and says so when the guide does not cover the question. */
const reminder =
  "Answer only from this guide. If it does not cover the question, say you do not know and, when it helps, point the owner to the README or GitHub Issues; do not guess how the app works.";

/** Words that carry no meaning in a question, so they do not match topics. */
const fillers = new Set([
  "about",
  "and",
  "are",
  "can",
  "could",
  "does",
  "for",
  "get",
  "have",
  "how",
  "iskios",
  "make",
  "need",
  "please",
  "should",
  "something",
  "the",
  "this",
  "use",
  "want",
  "what",
  "when",
  "where",
  "which",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

const indexOf = () =>
  [
    "Topics in the app guide; call read_app_guide with a topic id, or with a few words of the owner's question:",
    ...guideTopics.map((topic) => `- ${topic.id}: ${topic.title}. ${topic.summary}.`),
  ].join("\n");

const sectionOf = (topic: GuideTopic) => `## ${topic.title} (${topic.id})\n${topic.body}`;

const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !fillers.has(word));

/** How well the question fits the topic: its keywords and title count most, then its summary and text. */
const scoreOf = (topic: GuideTopic, question: string, words: ReadonlyArray<string>) => {
  const title = topic.title.toLowerCase();
  const summary = topic.summary.toLowerCase();
  const body = topic.body.toLowerCase();
  let score = 0;
  for (const keyword of topic.keywords) {
    const isMark = /^[^\p{L}\p{N}]+$/u.test(keyword);
    // A mark such as `@` or `!` or a phrase counts when the question holds it; a word, when it is one of the question's
    // or the start of one (`approvals` for `approval`).
    if (isMark || keyword.includes(" ")) {
      if (question.includes(keyword)) score += 4;
    } else if (words.includes(keyword)) score += 4;
    else if (
      keyword.length >= 4 &&
      words.some((word) => word.length >= 4 && (word.startsWith(keyword) || keyword.startsWith(word)))
    )
      score += 2;
  }
  for (const word of words) {
    if (title.includes(word)) score += 3;
    if (summary.includes(word)) score += 2;
    if (body.includes(word)) score += 1;
  }
  return score;
};

/** The topics a question points to, best first, at most two; none when nothing in the guide fits. */
export const topicsFor = (question: string): ReadonlyArray<GuideTopic> => {
  const asked = question.trim().toLowerCase();
  const exact = guideTopics.find((topic) => topic.id === asked || topic.title.toLowerCase() === asked);
  if (exact !== undefined) return [exact];
  const words = wordsOf(asked);
  const scored = guideTopics
    .map((topic) => ({ score: scoreOf(topic, asked, words), topic }))
    .filter((entry) => entry.score >= 3)
    .toSorted((a, b) => b.score - a.score);
  const best = scored[0];
  if (best === undefined) return [];
  // A second topic joins only when it fits nearly as well.
  return scored
    .filter((entry) => entry.score >= best.score * 0.6)
    .slice(0, 2)
    .map((entry) => entry.topic);
};

/** `read_app_guide`: the index with no topic, else the topic or topics that fit; a refusal for any thread but Iskios. */
export const readAppGuideByGuildmaster = (callerId: string, args: ArgumentsOf<"read_app_guide">) =>
  Effect.gen(function* () {
    if (!(yield* isGuildmasterThread(callerId)))
      return answer({ isError: true, text: "Only Iskios reads the app guide here." });
    const question = args.topic?.trim() ?? "";
    if (question === "") return answer({ isError: false, text: `${indexOf()}\n\n${reminder}` });
    const topics = topicsFor(question);
    if (topics.length === 0)
      return answer({
        isError: false,
        text: `The app guide does not cover "${question}".\n\n${indexOf()}\n\nIf none of these topics fits, say you do not know. ${reminder}`,
      });
    return answer({
      isError: false,
      text: `${topics.map(sectionOf).join("\n\n")}\n\n${reminder}`,
    });
  });
