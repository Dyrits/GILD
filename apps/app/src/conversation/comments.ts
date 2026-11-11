import type { Message } from "@iskios/contracts";

// Comments on messages of a quest or side-quest. The owner writes them while reading; they wait, per thread, and go with
// the next message the owner sends. They travel inside that message's text, as terminal output does
// (`terminalSnapshot`), so the harness reads them and the conversation can draw them back as quotes.

/** One comment: on a whole message, or on a passage selected in it. */
export type Comment = {
  /** Who wrote the message it is about. */
  readonly about: Message["sender"];
  readonly id: string;
  /** Whether `quote` is a passage the owner selected, rather than the start of the whole message. */
  readonly isSelection: boolean;
  readonly messageId: string;
  /** What the owner wrote. */
  readonly note: string;
  readonly quote: string;
};

/** A comment as it is read back from a sent message, with no identity of its own. */
export type SentComment = Pick<Comment, "about" | "isSelection" | "note" | "quote">;

/** How the harness is told whose message a comment is about. */
export const aboutLabels = {
  agent: "the Companion's reply",
  thread: "a message from another quest",
  user: "your message",
} as const satisfies Record<Message["sender"], string>;

const maxQuoteLength = 300;
const ellipsis = "…";

/** A quote cut to a length that stays readable in a card and in the harness's context. */
const cutOf = (text: string) =>
  text.length > maxQuoteLength ? `${text.slice(0, maxQuoteLength - 1).trimEnd()}${ellipsis}` : text;

/** The start of a message, quoted by a comment that is on the whole of it; comments the owner sent are left out. */
export const excerptOf = (text: string) => cutOf(commentsOf(text).body.trim());

/** What a selected passage is quoted as. */
export const selectionQuoteOf = (selected: string) => cutOf(selected.trim());

// A quote or a note may hold the block's own closing tags; a backslash after the `<` keeps them from ending it.
const escaped = (text: string) => text.replaceAll("</", "<\\/");
const unescaped = (text: string) => text.replaceAll("<\\/", "</");

const intro = "Comments on earlier messages of this conversation, each with the passage it is about:";

/** The block that carries comments in a message. */
const blockOf = (comments: ReadonlyArray<Comment>) =>
  [
    "<comments>",
    intro,
    ...comments.map(
      (comment) =>
        `<comment on="${aboutLabels[comment.about]}" part="${comment.isSelection ? "selection" : "message"}">\n<quote>${escaped(comment.quote)}</quote>\n<note>${escaped(comment.note)}</note>\n</comment>`,
    ),
    "</comments>",
  ].join("\n");

/** The message to send: what the owner typed, then their comments; the comments alone when nothing is typed. */
export const messageWithComments = (text: string, comments: ReadonlyArray<Comment>) => {
  if (comments.length === 0) return text;
  return text.trim() === "" ? blockOf(comments) : `${text.trim()}\n\n${blockOf(comments)}`;
};

const blockPattern = /(?:^|\n\n)<comments>\n([\s\S]*)\n<\/comments>$/;
const commentPattern =
  /<comment on="([^"]*)" part="(selection|message)">\n<quote>([\s\S]*?)<\/quote>\n<note>([\s\S]*?)<\/note>\n<\/comment>/g;

const senderOf = (label: string): Message["sender"] | null =>
  (Object.entries(aboutLabels).find(([, known]) => known === label)?.[0] as Message["sender"] | undefined) ?? null;

/** Splits a sent message into what the owner typed and the comments it carried; an ordinary message has none. */
export const commentsOf = (text: string): { body: string; items: ReadonlyArray<SentComment> } => {
  const block = blockPattern.exec(text);
  if (block === null) return { body: text, items: [] };
  const items = [...(block[1] ?? "").matchAll(commentPattern)].flatMap((match): Array<SentComment> => {
    const about = senderOf(match[1] ?? "");
    return about === null
      ? []
      : [
          {
            about,
            isSelection: match[2] === "selection",
            note: unescaped(match[4] ?? ""),
            quote: unescaped(match[3] ?? ""),
          },
        ];
  });
  return items.length === 0 ? { body: text, items: [] } : { body: text.slice(0, block.index), items };
};

/** The part of the browser's storage the comments use. */
export type CommentStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const storageKeyOf = (threadId: string) => `iskios:comments:${threadId}`;

const isComment = (value: unknown): value is Comment => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.messageId === "string" &&
    typeof candidate.note === "string" &&
    typeof candidate.quote === "string" &&
    typeof candidate.isSelection === "boolean" &&
    typeof candidate.about === "string" &&
    senderOf(aboutLabels[candidate.about as Message["sender"]] ?? "") !== null
  );
};

/** The comments a thread kept from before; a platform without storage, or damaged content, gives none. */
export const readComments = (storage: CommentStorage | null, threadId: string): ReadonlyArray<Comment> => {
  try {
    const stored = storage?.getItem(storageKeyOf(threadId)) ?? null;
    if (stored === null) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.every(isComment) ? parsed : [];
  } catch {
    return [];
  }
};

/** Keeps a thread's comments where the platform allows; a refusal only loses the memory. */
export const rememberComments = (
  storage: CommentStorage | null,
  threadId: string,
  comments: ReadonlyArray<Comment>,
) => {
  try {
    if (comments.length === 0) storage?.removeItem(storageKeyOf(threadId));
    else storage?.setItem(storageKeyOf(threadId), JSON.stringify(comments));
  } catch {}
};
