import { describe, expect, it } from "vitest";
import {
  hostEndpointOf,
  hostLinkCodes,
  isFinalLinkClose,
  linkFailureOf,
  retryDelayOf,
} from "../../src/foundation/hosts";

describe("the link to a paired host", () => {
  it("keeps the window's token and port and changes only the path", () => {
    expect(hostEndpointOf("ws://127.0.0.1:5123/?token=abc", "7f0c-12")).toBe(
      "ws://127.0.0.1:5123/host/7f0c-12?token=abc",
    );
  });

  it("tells a link that could not open, or that the host ended, from any other close", () => {
    expect(linkFailureOf(hostLinkCodes.couldNotOpen, "The host is not connected right now.")).toBe(
      "The host is not connected right now.",
    );
    expect(linkFailureOf(hostLinkCodes.ended, "The host disconnected.")).toBe("The host disconnected.");
    expect(linkFailureOf(1000, "")).toBeNull();
    expect(linkFailureOf(1006, "")).toBeNull();
  });

  it("stops trying only when the host refused this installation", () => {
    expect(linkFailureOf(hostLinkCodes.refused, "The host no longer knows this computer.")).toBe(
      "The host no longer knows this computer.",
    );
    expect([4000, 4001, 1006].map(isFinalLinkClose)).toEqual([false, false, false]);
    expect(isFinalLinkClose(hostLinkCodes.refused)).toBe(true);
  });

  it("retries the local service every second but backs off from a host, to half a minute", () => {
    expect([1, 2, 5].map((failures) => retryDelayOf(failures, false))).toEqual([1000, 1000, 1000]);
    expect([1, 2, 3, 4, 5, 6, 7, 20].map((failures) => retryDelayOf(failures, true))).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000,
    ]);
  });
});
