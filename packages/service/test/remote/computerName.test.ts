import { describe, expect, it } from "vitest";
import { computerNameOf } from "../../src/remote/config.ts";

describe("the name a host offers for its computer", () => {
  it("drops the network suffix a machine name often carries", () => {
    expect(computerNameOf("Studio.local")).toBe("Studio");
    expect(computerNameOf("Mac.lan")).toBe("Mac");
    expect(computerNameOf("dylans-macbook-air.home.arpa")).toBe("dylans-macbook-air");
  });

  it("keeps a plain name, and has a name for an empty one", () => {
    expect(computerNameOf("Mac Mini")).toBe("Mac Mini");
    expect(computerNameOf("")).toBe("This computer");
  });
});
