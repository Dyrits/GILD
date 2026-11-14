import { describe, expect, it } from "vitest";
import {
  forgetSentText,
  isSentText,
  listenForSentText,
  rememberUnsentText,
  unsentTextOf,
} from "../../src/ui/unsentText";

describe("keeping unsent message text", () => {
  it("returns what a box left, by the box's own name", () => {
    rememberUnsentText("thread:a", "half a thought");
    rememberUnsentText("thread:b", "another");
    expect(unsentTextOf("thread:a")).toBe("half a thought");
    expect(unsentTextOf("thread:b")).toBe("another");
  });

  it("forgets a box that was sent or emptied", () => {
    rememberUnsentText("thread:c", "typed");
    rememberUnsentText("thread:c", "");
    expect(unsentTextOf("thread:c")).toBe("");
    rememberUnsentText("thread:c", "   \n");
    expect(unsentTextOf("thread:c")).toBe("");
  });

  it("knows nothing of a box that never held text", () => {
    expect(unsentTextOf("thread:never")).toBe("");
  });

  it("forgets text once it was sent, even after its box closed while sending", () => {
    rememberUnsentText("thread:d", "  send this \n");
    forgetSentText("thread:d", "send this");
    expect(unsentTextOf("thread:d")).toBe("");
  });

  it("keeps text typed after the send started, which was never sent", () => {
    rememberUnsentText("thread:e", "a newer thought");
    forgetSentText("thread:e", "send this");
    expect(unsentTextOf("thread:e")).toBe("a newer thought");
  });

  it("tells a box reopened under the same name what was sent, until it stops listening", () => {
    const heard: Array<string> = [];
    const stop = listenForSentText("thread:f", (sent) => heard.push(sent));
    forgetSentText("thread:f", "first");
    stop();
    forgetSentText("thread:f", "second");
    expect(heard).toEqual(["first"]);
  });

  it("takes text as the sent text whatever space surrounds it, and other text as typed since", () => {
    expect(isSentText("  hello \n", "hello")).toBe(true);
    expect(isSentText("hello there", "hello")).toBe(false);
  });
});
