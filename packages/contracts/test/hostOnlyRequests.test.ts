import { describe, expect, it } from "vitest";
import { hostOnlyRequestTags, Results } from "../src/index.ts";

// Every request that manages pairing, the relay or other hosts is classified here, so a new request of that kind
// cannot reach a paired device unnoticed: adding one to the contract means deciding, in this test, which side it is on.
describe("the requests only a host may answer", () => {
  it("are exactly the ones that manage pairing, the relay or other hosts", () => {
    expect([...hostOnlyRequestTags].sort()).toEqual([
      "AddHost",
      "CreatePairingCode",
      "DisconnectDevice",
      "ListHosts",
      "ReadRemoteAccess",
      "RemoveHost",
      "SetRemoteAccess",
    ]);
  });

  it("name requests that exist", () => {
    for (const tag of hostOnlyRequestTags) expect(Object.keys(Results), tag).toContain(tag);
  });

  it("leave a paired device the host's name, which it may read and change", () => {
    expect(hostOnlyRequestTags).not.toContain("ReadHostName");
    expect(hostOnlyRequestTags).not.toContain("RenameHost");
  });
});
