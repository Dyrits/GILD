import { newRoomName } from "@iskios/channel";
import { closeCodes, connectClient, relayWorkerBundle, relayWorkerCompatibilityDate } from "@iskios/relay";

// A user who does not want to share the project's relay deploys the same Worker to their own Cloudflare account with
// one API token (device-pairing, own relay). The token is used for this one deployment: it is never stored, never
// logged, and sent only to Cloudflare's API.

/** Where Cloudflare's API lives; the token is sent nowhere else. */
export const cloudflareApiBase = "https://api.cloudflare.com/client/v4";

/** What marks a Worker as made by this feature, so a Worker of the same name that someone else made is left alone. */
export const ownRelayTag = "iskios-relay";

/** The Worker's name on the user's account, and so the first part of its address. */
export const defaultWorkerName = "iskios-relay";

/** One call to Cloudflare's API; `form` is a multipart upload, `body` a JSON one. */
export interface CloudflareCall {
  readonly body?: unknown;
  readonly form?: FormData;
  readonly method: "GET" | "POST" | "PUT";
  readonly path: string;
}

/** What Cloudflare answered: the HTTP status, and the body when it was JSON. */
export interface CloudflareAnswer {
  readonly json: unknown;
  readonly status: number;
}

/** Cloudflare's API as one account's token sees it; a stand-in answers in tests. */
export interface CloudflareApi {
  call(request: CloudflareCall): Promise<CloudflareAnswer>;
}

const callMillis = 30_000;

/** Cloudflare's API with `token` as the bearer; the only place the token leaves this process. */
export const cloudflareApiFor = (token: string, fetchImpl: typeof fetch = fetch): CloudflareApi => ({
  call: async (request) => {
    const hasJson = request.body !== undefined;
    const body = request.form ?? (hasJson ? JSON.stringify(request.body) : null);
    const response = await fetchImpl(`${cloudflareApiBase}${request.path}`, {
      ...(body === null ? {} : { body }),
      headers: { Authorization: `Bearer ${token}`, ...(hasJson ? { "Content-Type": "application/json" } : {}) },
      method: request.method,
      // The token must never follow a redirect somewhere else.
      redirect: "error",
      signal: AbortSignal.timeout(callMillis),
    });
    const text = await response.text();
    try {
      return { json: JSON.parse(text) as unknown, status: response.status };
    } catch {
      return { json: null, status: response.status };
    }
  },
});

export type DeployFailureKind =
  | "cloudflare-error"
  | "many-accounts"
  | "name-taken"
  | "no-account"
  | "no-permission"
  | "not-ready"
  | "token-rejected"
  | "unreachable";

/** How a deployment ended: the relay's address, or why it could not be made and what the user can do. */
export type DeployResult =
  | {
      readonly accountName: string;
      /** Whether the account had no workers.dev subdomain, so one was made. */
      readonly createdSubdomain: boolean;
      readonly ok: true;
      readonly origin: string;
      /** Whether this replaced a relay this feature deployed before. */
      readonly wasUpdated: boolean;
      readonly workerName: string;
    }
  | { readonly failure: DeployFailureKind; readonly message: string; readonly ok: false };

export interface DeployOptions {
  /** Asks whether the relay at an address answers; the default opens a connection and reads the relay's reply. */
  readonly answers?: (origin: string) => Promise<boolean>;
  readonly api: CloudflareApi;
  /** How many times to ask whether the new address answers: a fresh workers.dev address takes a moment. */
  readonly attempts?: number;
  readonly pauseMillis?: number;
  /** The token, only so that no message ever repeats it. */
  readonly token: string;
  readonly workerName?: string;
}

const tokenWords = "Create it from the “Edit Cloudflare Workers” template and paste all of it.";
const messages = {
  "no-account": "That token does not give access to any Cloudflare account.",
  "no-permission": `That token is not allowed to deploy Workers. ${tokenWords}`,
  "not-ready":
    "The relay was deployed to your account but does not answer yet. Wait a minute and try again; Iskios still uses its previous relay.",
  "token-rejected": `Cloudflare did not accept that token. ${tokenWords}`,
  unreachable: "Could not reach Cloudflare. Check your internet connection.",
} as const;

/** Stops the deployment with a result; thrown inside the steps and caught once. */
class Stop {
  constructor(readonly result: DeployResult & { ok: false }) {}
}

const stop = (failure: DeployFailureKind, message: string) => new Stop({ failure, message, ok: false });

const errorTextOf = (json: unknown): string => {
  const errors = typeof json === "object" && json !== null && "errors" in json ? json.errors : null;
  const first = Array.isArray(errors) ? (errors[0] as unknown) : null;
  const message = typeof first === "object" && first !== null && "message" in first ? first.message : null;
  return typeof message === "string" ? message : "no reason given";
};

const errorCodeOf = (json: unknown): number | null => {
  const errors = typeof json === "object" && json !== null && "errors" in json ? json.errors : null;
  const first = Array.isArray(errors) ? (errors[0] as unknown) : null;
  const code = typeof first === "object" && first !== null && "code" in first ? first.code : null;
  return typeof code === "number" ? code : null;
};

const resultOf = (json: unknown): unknown =>
  typeof json === "object" && json !== null && "result" in json ? json.result : null;

const hexOf = (length: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(length)), (byte) => byte.toString(16).padStart(2, "0")).join("");

const sleep = (millis: number) => new Promise<void>((resolve) => setTimeout(resolve, millis));

/** Whether a relay answers at `origin`: a device with no host in a fresh room is turned away with "host offline". */
export const relayAnswers = async (origin: string): Promise<boolean> => {
  const connected = await connectClient({ relayOrigin: origin, room: newRoomName() });
  if (!connected.ok) return false;
  const { carrier, closeCode } = connected.value;
  const code = await new Promise<number | null>((resolve) => {
    const timer = setTimeout(() => resolve(closeCode()), 5_000);
    carrier.onClose(() => {
      clearTimeout(timer);
      resolve(closeCode());
    });
  });
  carrier.close();
  return code === closeCodes.hostOffline;
};

/**
 * Deploys the relay Worker to the account the token reaches, and returns its workers.dev address once it answers.
 * Nothing in Iskios changes here: the caller switches to the new address only after a success.
 */
export const deployRelayToCloudflare = async (options: DeployOptions): Promise<DeployResult> => {
  const { api, token } = options;
  const workerName = options.workerName ?? defaultWorkerName;
  const scrub = (text: string) => (token === "" ? text : text.split(token).join("[token]"));

  const call = async (step: string, request: CloudflareCall, accepted: readonly number[] = []) => {
    const answer = await api.call(request);
    if (answer.status >= 200 && answer.status < 300) return answer;
    if (accepted.includes(answer.status)) return answer;
    const code = errorCodeOf(answer.json);
    // Cloudflare answers a token it does not know with 403 and code 9109, and one that is not shaped like a token
    // with 400 and code 6003 or 6111 (seen on 2026-11-12), so the code says it, not the status.
    if (answer.status === 401 || code === 9109 || code === 6003 || code === 6111)
      throw stop("token-rejected", messages["token-rejected"]);
    if (answer.status === 403) throw stop("no-permission", messages["no-permission"]);
    throw stop(
      "cloudflare-error",
      scrub(`Cloudflare refused “${step}” (${answer.status}): ${errorTextOf(answer.json)}.`),
    );
  };

  try {
    const listed = await call("list your accounts", { method: "GET", path: "/accounts" });
    const accounts = (Array.isArray(resultOf(listed.json)) ? (resultOf(listed.json) as unknown[]) : []).flatMap(
      (entry) => {
        const { id, name } = (entry ?? {}) as { id?: unknown; name?: unknown };
        return typeof id === "string" ? [{ id, name: typeof name === "string" ? name : id }] : [];
      },
    );
    if (accounts.length === 0) throw stop("no-account", messages["no-account"]);
    const [account, ...others] = accounts;
    if (account === undefined) throw stop("no-account", messages["no-account"]);
    if (others.length > 0)
      throw stop(
        "many-accounts",
        `That token reaches ${accounts.length} Cloudflare accounts (${accounts.map((entry) => entry.name).join(", ")}). When you create it, choose one account under Account Resources.`,
      );
    const base = `/accounts/${account.id}/workers`;

    const subdomainAnswer = await call(
      "read your workers.dev subdomain",
      { method: "GET", path: `${base}/subdomain` },
      [404],
    );
    const existing = (resultOf(subdomainAnswer.json) as { subdomain?: unknown } | null)?.subdomain;
    let subdomain = typeof existing === "string" && subdomainAnswer.status === 200 ? existing : null;
    let createdSubdomain = false;
    for (let attempt = 0; subdomain === null && attempt < 3; attempt += 1) {
      const wanted = `iskios-${hexOf(4)}`;
      const made = await api.call({ body: { subdomain: wanted }, method: "PUT", path: `${base}/subdomain` });
      if (made.status === 401) throw stop("token-rejected", messages["token-rejected"]);
      if (made.status === 403) throw stop("no-permission", messages["no-permission"]);
      if (made.status >= 200 && made.status < 300) {
        subdomain = wanted;
        createdSubdomain = true;
      } else if (attempt === 2) {
        throw stop(
          "cloudflare-error",
          scrub(`Cloudflare refused “create your workers.dev subdomain” (${made.status}): ${errorTextOf(made.json)}.`),
        );
      }
    }
    if (subdomain === null)
      throw stop("cloudflare-error", "Cloudflare did not give your account a workers.dev subdomain.");

    const known = await call(
      "look for an existing relay",
      { method: "GET", path: `${base}/scripts/${workerName}/settings` },
      [404],
    );
    const exists = known.status === 200;
    if (exists) {
      const tags = (resultOf(known.json) as { tags?: unknown } | null)?.tags;
      if (!Array.isArray(tags) || !tags.includes(ownRelayTag))
        throw stop(
          "name-taken",
          `Your account already has a Worker named “${workerName}” that Iskios did not create, so it was left as it is. Rename or delete it in Cloudflare, then try again.`,
        );
    }

    // The Durable Object is created by the first upload's migration; Cloudflare refuses the same migration again.
    const metadata = {
      bindings: [{ class_name: "Room", name: "ROOM", type: "durable_object_namespace" }],
      compatibility_date: relayWorkerCompatibilityDate,
      main_module: "worker.js",
      ...(exists ? {} : { migrations: { new_sqlite_classes: ["Room"], new_tag: "v1" } }),
      tags: [ownRelayTag],
    };
    const form = new FormData();
    form.set("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.set("worker.js", new Blob([relayWorkerBundle], { type: "application/javascript+module" }), "worker.js");
    await call("upload the relay", { form, method: "PUT", path: `${base}/scripts/${workerName}` });
    await call("turn on its workers.dev address", {
      body: { enabled: true, previews_enabled: false },
      method: "POST",
      path: `${base}/scripts/${workerName}/subdomain`,
    });

    const origin = `https://${workerName}.${subdomain}.workers.dev`;
    const answers = options.answers ?? relayAnswers;
    const attempts = options.attempts ?? 15;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (await answers(origin).catch(() => false))
        return { accountName: account.name, createdSubdomain, ok: true, origin, wasUpdated: exists, workerName };
      if (attempt < attempts) await sleep(options.pauseMillis ?? 2_000);
    }
    throw stop("not-ready", messages["not-ready"]);
  } catch (reason) {
    if (reason instanceof Stop) return reason.result;
    return { failure: "unreachable", message: messages.unreachable, ok: false };
  }
};
