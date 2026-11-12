import type { CloudflareAnswer, CloudflareApi } from "../../src/remote/ownRelay.ts";

/** What the fake Cloudflare account holds, and what was asked of it. */
export interface FakeAccount {
  accounts: { id: string; name: string }[];
  /** The calls received, in order, as `METHOD path`. */
  readonly calls: string[];
  /** Makes the next call to a path fail with this status and error message, once. */
  failNext: Map<string, { message: string; status: number }>;
  /** The tags of Workers that exist; a Worker made by someone else has none. */
  scripts: Map<
    string,
    { bundle: string; enabled: boolean; hasMigration: boolean; tags: string[]; migrationTag: string | null }
  >;
  /** Every body and form field that was sent, as text, to look for what must not be in them. */
  readonly sent: string[];
  /** The account's workers.dev subdomain, or null when it has none. */
  subdomain: string | null;
  /** Subdomain names Cloudflare refuses as taken. */
  takenSubdomains: Set<string>;
  validToken: string;
}

export const newFakeAccount = (token = "cf-token-for-tests"): FakeAccount => ({
  accounts: [{ id: "acc1", name: "Owner Account" }],
  calls: [],
  failNext: new Map(),
  scripts: new Map(),
  sent: [],
  subdomain: "owner",
  takenSubdomains: new Set(),
  validToken: token,
});

const ok = (result: unknown): CloudflareAnswer => ({ json: { errors: [], result, success: true }, status: 200 });
const fail = (status: number, message: string, code = 10000): CloudflareAnswer => ({
  json: { errors: [{ code, message }], result: null, success: false },
  status,
});

/** A stand-in for Cloudflare's API over one account, with the behaviour seen on the real one on 2026-11-12. */
export const fakeCloudflareApi = (account: FakeAccount, token: string): CloudflareApi => ({
  call: async (request) => {
    account.calls.push(`${request.method} ${request.path}`);
    if (request.body !== undefined) account.sent.push(JSON.stringify(request.body));
    let uploaded: { bundle: string; metadata: Record<string, unknown> } | null = null;
    if (request.form !== undefined) {
      const metadata = JSON.parse(await (request.form.get("metadata") as Blob).text()) as Record<string, unknown>;
      const bundle = await (request.form.get("worker.js") as Blob).text();
      account.sent.push(JSON.stringify(metadata), bundle);
      uploaded = { bundle, metadata };
    }
    // What the real API answers to a token it does not know (seen 2026-11-12): 403 with code 9109, or 400 with code 6003
    // when the header is not even shaped like a token.
    if (token === "") return fail(400, "Invalid request headers", 6003);
    if (token !== account.validToken) return fail(403, "Invalid access token", 9109);
    const planned = account.failNext.get(request.path);
    if (planned !== undefined) {
      account.failNext.delete(request.path);
      return fail(planned.status, planned.message);
    }
    if (request.path === "/accounts") return ok(account.accounts);
    const [, , id, , ...rest] = request.path.split("/");
    if (!account.accounts.some((entry) => entry.id === id)) return fail(403, "Forbidden");
    const [section, name, leaf] = rest;
    if (section === "subdomain" && request.method === "GET") {
      return account.subdomain === null
        ? fail(404, "workers.api.error.no_subdomain_found", 10007)
        : ok({ subdomain: account.subdomain });
    }
    if (section === "subdomain" && request.method === "PUT") {
      const wanted = (request.body as { subdomain: string }).subdomain;
      if (account.takenSubdomains.has(wanted)) return fail(409, "That subdomain is taken", 10036);
      account.subdomain = wanted;
      return ok({ subdomain: wanted });
    }
    if (section !== "scripts" || name === undefined) return fail(404, "Not found");
    const script = account.scripts.get(name);
    if (leaf === "settings")
      return script === undefined ? fail(404, "Worker not found", 10007) : ok({ tags: script.tags });
    if (leaf === "subdomain") {
      if (script === undefined) return fail(404, "Worker not found", 10007);
      script.enabled = (request.body as { enabled: boolean }).enabled;
      return ok({ enabled: script.enabled, previews_enabled: false });
    }
    if (leaf === undefined && request.method === "PUT" && uploaded !== null) {
      const migrations = uploaded.metadata.migrations as { new_tag: string; new_sqlite_classes: string[] } | undefined;
      // The real API refuses a migration that names a tag the Worker already has.
      if (script !== undefined && migrations !== undefined)
        return fail(
          412,
          `Actor migration tag precondition failed, got tag '' when expected tag is '${script.migrationTag}'.`,
          10079,
        );
      account.scripts.set(name, {
        bundle: uploaded.bundle,
        enabled: script?.enabled ?? false,
        hasMigration: migrations !== undefined || (script?.hasMigration ?? false),
        migrationTag: migrations?.new_tag ?? script?.migrationTag ?? null,
        tags: (uploaded.metadata.tags as string[] | undefined) ?? [],
      });
      return ok({ migration_tag: migrations?.new_tag ?? script?.migrationTag ?? null });
    }
    return fail(404, "Not found");
  },
});
