import { relayWorkerBundle } from "@iskios/relay";
import { describe, expect, it } from "vitest";
import { cloudflareApiFor, deployRelayToCloudflare, ownRelayTag } from "../../src/remote/ownRelay.ts";
import { fakeCloudflareApi, newFakeAccount } from "./fakeCloudflare.ts";

// Deploying the relay Worker to a user's own Cloudflare account with one API token (device-pairing, own relay).

const token = "cf-token-for-tests";
const noWait = { answers: () => Promise.resolve(true), attempts: 3, pauseMillis: 0 };

const deploy = (
  account: ReturnType<typeof newFakeAccount>,
  options: Partial<Parameters<typeof deployRelayToCloudflare>[0]> = {},
) => deployRelayToCloudflare({ api: fakeCloudflareApi(account, token), token, ...noWait, ...options });

describe("deploying the relay to the user's own Cloudflare account", () => {
  it("uploads the bundled Worker as a SQLite-backed Durable Object, turns on its workers.dev address, and names it", async () => {
    const account = newFakeAccount(token);
    const result = await deploy(account);
    expect(result).toMatchObject({ ok: true, origin: "https://iskios-relay.owner.workers.dev" });
    const script = account.scripts.get("iskios-relay");
    expect(script?.bundle).toBe(relayWorkerBundle);
    expect(script?.hasMigration).toBe(true);
    expect(script?.tags).toEqual([ownRelayTag]);
    expect(script?.enabled).toBe(true);
  });

  it("sends the Durable Object binding and the migration Cloudflare needs", async () => {
    const account = newFakeAccount(token);
    await deploy(account);
    const metadata = account.sent.map((text) => text).find((text) => text.includes("main_module")) ?? "{}";
    expect(JSON.parse(metadata)).toMatchObject({
      bindings: [{ class_name: "Room", name: "ROOM", type: "durable_object_namespace" }],
      main_module: "worker.js",
      migrations: { new_sqlite_classes: ["Room"], new_tag: "v1" },
    });
  });

  it("makes the account's workers.dev subdomain when it has none, and says so", async () => {
    const account = newFakeAccount(token);
    account.subdomain = null;
    const result = await deploy(account);
    expect(account.subdomain).toMatch(/^iskios-[0-9a-f]{8}$/);
    expect(result).toMatchObject({
      createdSubdomain: true,
      ok: true,
      origin: `https://iskios-relay.${account.subdomain}.workers.dev`,
    });
  });

  it("tries another subdomain name when Cloudflare says one is taken", async () => {
    const account = newFakeAccount(token);
    account.subdomain = null;
    let first: string | null = null;
    const api = fakeCloudflareApi(account, token);
    const result = await deployRelayToCloudflare({
      api: {
        call: async (request) => {
          if (request.method === "PUT" && request.path.endsWith("/workers/subdomain") && first === null) {
            first = (request.body as { subdomain: string }).subdomain;
            account.takenSubdomains.add(first);
          }
          return api.call(request);
        },
      },
      token,
      ...noWait,
    });
    expect(result.ok).toBe(true);
    expect(account.subdomain).not.toBe(first);
  });

  it("updates a relay it made before, without the migration Cloudflare would refuse the second time", async () => {
    const account = newFakeAccount(token);
    await deploy(account);
    const again = await deploy(account);
    expect(again).toMatchObject({ ok: true, wasUpdated: true });
    expect(account.scripts.get("iskios-relay")?.migrationTag).toBe("v1");
  });

  it("refuses to overwrite a Worker of the same name that Iskios did not make, and uploads nothing", async () => {
    const account = newFakeAccount(token);
    account.scripts.set("iskios-relay", {
      bundle: "someone else's",
      enabled: true,
      hasMigration: true,
      migrationTag: "v1",
      tags: [],
    });
    const result = await deploy(account);
    expect(result).toMatchObject({ failure: "name-taken", ok: false });
    expect(account.scripts.get("iskios-relay")?.bundle).toBe("someone else's");
    expect(account.calls.some((call) => call.startsWith("PUT /accounts/acc1/workers/scripts"))).toBe(false);
  });

  it("deploys under the name it is given", async () => {
    const account = newFakeAccount(token);
    const result = await deploy(account, { workerName: "my-iskios-relay" });
    expect(result).toMatchObject({ ok: true, origin: "https://my-iskios-relay.owner.workers.dev" });
    expect([...account.scripts.keys()]).toEqual(["my-iskios-relay"]);
  });

  it("says when Cloudflare does not accept the token, and does nothing else", async () => {
    const account = newFakeAccount("another-token");
    const result = await deploy(account);
    expect(result).toMatchObject({ failure: "token-rejected", ok: false });
    expect(account.calls).toEqual(["GET /accounts"]);
  });

  it("says so when the token is not even shaped like one", async () => {
    const account = newFakeAccount(token);
    const result = await deployRelayToCloudflare({ api: fakeCloudflareApi(account, ""), token: "", ...noWait });
    expect(result).toMatchObject({ failure: "token-rejected", ok: false });
  });

  it("says when the token is not allowed to deploy Workers", async () => {
    const account = newFakeAccount(token);
    account.failNext.set("/accounts/acc1/workers/scripts/iskios-relay", {
      message: "Authentication error",
      status: 403,
    });
    const result = await deploy(account);
    expect(result).toMatchObject({ failure: "no-permission", ok: false });
    const listing = newFakeAccount(token);
    listing.failNext.set("/accounts", { message: "Authentication error", status: 403 });
    expect(await deploy(listing)).toMatchObject({ failure: "no-permission", ok: false });
  });

  it("says when the token reaches no account, or several, and asks for one", async () => {
    const none = newFakeAccount(token);
    none.accounts = [];
    expect(await deploy(none)).toMatchObject({ failure: "no-account", ok: false });
    const several = newFakeAccount(token);
    several.accounts = [
      { id: "a", name: "Work" },
      { id: "b", name: "Home" },
    ];
    const result = await deploy(several);
    expect(result).toMatchObject({ failure: "many-accounts", ok: false });
    if (!result.ok) expect(result.message).toMatch(/Work.*Home/);
    expect(several.calls).toEqual(["GET /accounts"]);
  });

  it("reports the step and Cloudflare's words when a step is refused, without ever echoing the token", async () => {
    const account = newFakeAccount(token);
    account.failNext.set("/accounts/acc1/workers/scripts/iskios-relay", {
      message: `Bad request for ${token}`,
      status: 400,
    });
    const result = await deploy(account);
    expect(result).toMatchObject({ failure: "cloudflare-error", ok: false });
    if (!result.ok) {
      expect(result.message).toContain("Bad request");
      expect(result.message).not.toContain(token);
    }
  });

  it("says when Cloudflare cannot be reached", async () => {
    const result = await deployRelayToCloudflare({
      api: {
        call: () => Promise.reject(new TypeError("fetch failed")),
      },
      token,
      ...noWait,
    });
    expect(result).toMatchObject({ failure: "unreachable", ok: false });
  });

  it("waits for the new address to answer, and gives up with the Worker left in place", async () => {
    const account = newFakeAccount(token);
    let asked = 0;
    const slow = await deploy(account, { answers: () => Promise.resolve(++asked >= 3) });
    expect(slow.ok).toBe(true);
    expect(asked).toBe(3);
    const never = await deploy(newFakeAccount(token), { answers: () => Promise.resolve(false) });
    expect(never).toMatchObject({ failure: "not-ready", ok: false });
  });

  it("never puts the token in a request body or in the Worker it uploads", async () => {
    const account = newFakeAccount(token);
    await deploy(account);
    expect(account.sent.every((text) => !text.includes(token))).toBe(true);
  });
});

describe("the Cloudflare API client", () => {
  it("sends the token only as a bearer header, only to api.cloudflare.com", async () => {
    const seen: { headers: Record<string, string>; redirect: RequestInit["redirect"]; url: string }[] = [];
    const api = cloudflareApiFor(token, (url, init) => {
      seen.push({
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        redirect: init?.redirect,
        url: String(url),
      });
      return Promise.resolve(new Response(JSON.stringify({ errors: [], result: [], success: true }), { status: 200 }));
    });
    const answer = await api.call({ method: "GET", path: "/accounts" });
    expect(answer.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe("https://api.cloudflare.com/client/v4/accounts");
    expect(seen[0]?.headers.authorization).toBe(`Bearer ${token}`);
    expect(seen[0]?.url).not.toContain(token);
    // The token must never follow a redirect somewhere else.
    expect(seen[0]?.redirect).toBe("error");
  });

  it("answers with the status and no JSON when the body is not JSON", async () => {
    const api = cloudflareApiFor(token, () =>
      Promise.resolve(new Response("<html>Bad gateway</html>", { status: 502 })),
    );
    expect(await api.call({ method: "GET", path: "/accounts" })).toEqual({ json: null, status: 502 });
  });
});
