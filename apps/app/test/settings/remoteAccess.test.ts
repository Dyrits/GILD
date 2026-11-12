import type { PairedDevice } from "@iskios/contracts";
import { describe, expect, it } from "vitest";
import { agoOf, codeLifeOf, deviceLineOf, relayStatusTextOf } from "../../src/settings/remoteAccess";

const device = (change: Partial<PairedDevice>) =>
  ({
    id: "d",
    isConnected: false,
    kind: "desktop",
    lastActiveAt: null,
    name: "Laptop",
    pairedAt: 0,
    ...change,
  }) as PairedDevice;

describe("Charter's remote access wording", () => {
  it("says the host is unreachable by anyone while it is off, whatever the relay says", () => {
    expect(relayStatusTextOf("Connected", false)).toContain("Off");
    expect(relayStatusTextOf("Connected", true)).toContain("any network");
    expect(relayStatusTextOf("Unreachable", true)).toContain("cannot be reached");
    expect(relayStatusTextOf("Connecting", true)).toContain("Connecting");
  });

  it("says how long ago in the largest whole unit", () => {
    const now = 10 * 24 * 3_600_000;
    expect(agoOf(now - 20_000, now)).toBe("just now");
    expect(agoOf(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(agoOf(now - 3 * 3_600_000, now)).toBe("3 h ago");
    expect(agoOf(now - 3 * 24 * 3_600_000, now)).toBe("3 days ago");
  });

  it("describes a device by kind, and by connection or last activity", () => {
    const now = 1_000_000;
    expect(deviceLineOf(device({ isConnected: true }), now)).toBe("Desktop · connected now");
    expect(deviceLineOf(device({ kind: "phone" }), now)).toBe("Phone · never connected");
    expect(deviceLineOf(device({ lastActiveAt: now - 120_000 }), now)).toBe("Desktop · last active 2 min ago");
  });

  it("counts a pairing code's remaining minutes and says when it has expired", () => {
    expect(codeLifeOf(10 * 60_000, 0)).toBe("Works once and expires in 10 min.");
    expect(codeLifeOf(60_000, 1_000)).toBe("Works once and expires in 1 min.");
    expect(codeLifeOf(60_000, 60_000)).toContain("expired");
  });
});
