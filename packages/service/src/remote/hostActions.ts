import { encodePairingCode } from "@iskios/channel";
import { Effect } from "effect";
import { invalid, ServiceFailure } from "../core/index.ts";
import { RemoteConfig } from "./config.ts";
import { ensureHostRecord, makePairingSecret, relayOriginOf } from "./hostAccess.ts";
import type { RemoteState } from "./state.ts";

/** Makes a pairing code that works once, for ten minutes, naming this host's room on the relay. */
export const createPairingCode = Effect.gen(function* () {
  const record = yield* ensureHostRecord;
  const { expiresAt, secret } = yield* makePairingSecret(Date.now());
  const code = encodePairingCode({
    hostPublicKey: record.publicKey,
    relayOrigin: yield* relayOriginOf(record),
    room: record.room,
    secret,
  });
  return { code, expiresAt };
});

/** What the running host does once "Allow paired devices" has been switched: off ends every connection at once. */
export const applyRemoteAccess = (isEnabled: boolean, state: RemoteState["Service"]) =>
  Effect.gen(function* () {
    if (!isEnabled) {
      state.closeAll();
      // Charter shows Off at once; the runtime closes its relay connection a moment later.
      yield* state.setStatus("Off");
    }
    state.poke();
  });

/**
 * What the running host does once the relay has changed: every device's connection ends (they paired through the other
 * relay), and the runtime reconnects to the new one if pairing is on.
 */
export const applyRelayChange = (isEnabled: boolean, state: RemoteState["Service"]) =>
  Effect.gen(function* () {
    state.closeAll();
    yield* state.setStatus(isEnabled ? "Connecting" : "Off");
    state.poke();
  });

/**
 * Deploys the relay to the Cloudflare account `token` reaches, and gives the address it answers at. Nothing is kept
 * of the token, and nothing in Iskios changes until the caller uses the address.
 */
export const deployOwnRelay = (token: string) =>
  Effect.gen(function* () {
    const config = yield* RemoteConfig;
    const trimmed = token.trim();
    if (trimmed === "") return yield* invalid("Paste the Cloudflare API token first.");
    const result = yield* Effect.promise(() => config.deployOwnRelay(trimmed));
    if (!result.ok) return yield* new ServiceFailure({ kind: "ExecutionFailure", message: result.message });
    return result;
  });
