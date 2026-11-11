import { createContext, useContext, useRef, useState } from "react";
import { type Comment, type CommentStorage, readComments, rememberComments } from "./comments";

/** What a conversation offers for commenting on its messages, and the comments waiting to be sent. */
export type CommentsApi = {
  readonly add: (comment: Omit<Comment, "id">) => void;
  readonly clear: () => void;
  readonly countOf: (messageId: string) => number;
  readonly items: ReadonlyArray<Comment>;
  readonly remove: (id: string) => void;
  readonly update: (id: string, note: string) => void;
};

/** Absent where comments are not offered, such as in the Guildmaster's conversation; its messages then draw plain. */
const CommentsContext = createContext<CommentsApi | null>(null);
export const CommentsProvider = CommentsContext.Provider;
export const useComments = () => useContext(CommentsContext);

/** Reading `localStorage` can itself be refused, so a platform without it, or one that refuses, has none. */
const storageOf = (): CommentStorage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const newCommentId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** A thread's pending comments, kept in the browser's storage until they are sent or removed. */
export function useThreadComments(threadId: string): CommentsApi {
  const [items, setItems] = useState<ReadonlyArray<Comment>>(() => readComments(storageOf(), threadId));
  // Several changes can land before a render; each builds on the latest list, not on the one its closure saw.
  const latest = useRef(items);
  const commit = (next: ReadonlyArray<Comment>) => {
    latest.current = next;
    setItems(next);
    rememberComments(storageOf(), threadId, next);
  };
  return {
    add: (comment) => commit([...latest.current, { ...comment, id: newCommentId() }]),
    clear: () => commit([]),
    countOf: (messageId) => items.filter((comment) => comment.messageId === messageId).length,
    items,
    remove: (id) => commit(latest.current.filter((comment) => comment.id !== id)),
    update: (id, note) => commit(latest.current.map((comment) => (comment.id === id ? { ...comment, note } : comment))),
  };
}
