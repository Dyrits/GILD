import { encodePairingCode } from "@iskios/channel";
import { Effect } from "effect";
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
