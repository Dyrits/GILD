import type { Message } from "@iskios/contracts";
import type { ReactNode } from "react";

/** What a card needs to be commented on. */
export type CommentableProps = {
  /** Who wrote the message. */
  about: Message["sender"];
  children: ReactNode;
  messageId: string;
  /** The message's text, whose start a comment on the whole message quotes. */
  text: string;
};

/** Commenting needs the web build, where text can be selected and a pointer hovers: elsewhere a message is drawn as it is. */
export function Commentable({ children }: CommentableProps) {
  return <>{children}</>;
}
