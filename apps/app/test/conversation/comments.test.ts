import { describe, expect, it } from "vitest";
import {
  type Comment,
  commentsOf,
  excerptOf,
  messageWithComments,
  readComments,
  rememberComments,
} from "../../src/conversation/comments";

const comment = (overrides: Partial<Comment> = {}): Comment => ({
  about: "agent",
  id: "c1",
  isSelection: true,
  messageId: "m1",
  note: "Why not use the existing helper?",
  quote: "I wrote a new parser",
  ...overrides,
});

/** A stand-in for the browser's storage. */
const fakeStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
};

describe("sending comments with the next message", () => {
  it("sends comments alone when no text is typed", () => {
    const sent = messageWithComments("", [comment()]);
    expect(sent.startsWith("<comments>")).toBe(true);
    expect(sent).toContain("I wrote a new parser");
    expect(sent).toContain("Why not use the existing helper?");
  });

  it("puts the typed text first and leaves a message with no comments untouched", () => {
    expect(messageWithComments("  Go on  ", [])).toBe("  Go on  ");
    expect(messageWithComments("Go on", [comment()]).startsWith("Go on\n\n<comments>")).toBe(true);
  });

  it("names what each comment is about", () => {
    const sent = messageWithComments("", [
      comment({ about: "user", id: "a" }),
      comment({ about: "agent", id: "b" }),
      comment({ about: "thread", id: "c" }),
    ]);
    expect(sent).toContain('on="your message"');
    expect(sent).toContain('on="the Companion\'s reply"');
    expect(sent).toContain('on="a message from another quest"');
  });

  it("reads back what it wrote, whole messages and selections, in order", () => {
    const first = comment({ id: "a", isSelection: false, note: "Too long.\nShorten it.", quote: "Line one\nLine two" });
    const second = comment({ about: "user", id: "b", note: "Yes" });
    const sent = messageWithComments("Please revise", [first, second]);
    const read = commentsOf(sent);
    expect(read.body).toBe("Please revise");
    expect(read.items).toEqual([
      { about: "agent", isSelection: false, note: "Too long.\nShorten it.", quote: "Line one\nLine two" },
      { about: "user", isSelection: true, note: "Yes", quote: "I wrote a new parser" },
    ]);
  });

  it("keeps closing tags inside a quote or a note from ending the block early", () => {
    const tricky = comment({ note: "Use </note> carefully", quote: "a </quote> and </comments> inside" });
    const read = commentsOf(messageWithComments("x", [tricky]));
    expect(read.items).toHaveLength(1);
    expect(read.items[0]?.quote).toBe("a </quote> and </comments> inside");
    expect(read.items[0]?.note).toBe("Use </note> carefully");
  });

  it("finds no comments in an ordinary message", () => {
    expect(commentsOf("Just a message")).toEqual({ body: "Just a message", items: [] });
    expect(commentsOf("Mentions <comments> but never closes it").items).toEqual([]);
  });
});

describe("the excerpt a whole-message comment quotes", () => {
  it("keeps a short message whole and cuts a long one with an ellipsis", () => {
    expect(excerptOf("  Short  ")).toBe("Short");
    const cut = excerptOf("x".repeat(500));
    expect(cut.length).toBeLessThan(500);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("leaves out the comments an earlier message of the owner carried", () => {
    expect(excerptOf(messageWithComments("Please revise", [comment()]))).toBe("Please revise");
  });
});

describe("comments kept for a thread until they are sent", () => {
  it("remembers a thread's comments apart from another's", () => {
    const storage = fakeStorage();
    rememberComments(storage, "t1", [comment()]);
    expect(readComments(storage, "t1")).toEqual([comment()]);
    expect(readComments(storage, "t2")).toEqual([]);
  });

  it("forgets a thread's comments once none remain", () => {
    const storage = fakeStorage();
    rememberComments(storage, "t1", [comment()]);
    rememberComments(storage, "t1", []);
    expect(storage.getItem("iskios:comments:t1")).toBeNull();
  });

  it("starts empty from damaged or foreign storage content", () => {
    expect(readComments(fakeStorage({ "iskios:comments:t1": "{not json" }), "t1")).toEqual([]);
    expect(readComments(fakeStorage({ "iskios:comments:t1": '[{"id":1}]' }), "t1")).toEqual([]);
    expect(readComments(null, "t1")).toEqual([]);
  });

  it("loses only the memory when the storage refuses", () => {
    const refusing = {
      getItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readComments(refusing, "t1")).toEqual([]);
    expect(() => rememberComments(refusing, "t1", [comment()])).not.toThrow();
  });
});
