import { randomUUID } from "node:crypto";
import {
  constantTimeEqual,
  decodeBase64Url,
  encodeBase64Url,
  generateKeyPair,
  hashToken,
  newDeviceToken,
  newPairingSecret,
  newRoomName,
} from "@iskios/channel";
import {
  type DeviceId,
  type DeviceKind,
  maxNameLength,
  type PairedDevice,
  type RemoteAccessView,
} from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "../core/index.ts";
import { RemoteConfig } from "./config.ts";

// This installation as a host: its identity, its pairing codes and its paired devices (device-pairing). Everything
// here is storage; the connections are in the host runtime.

/** A pairing code lives ten minutes. */
export const pairingCodeMillis = 10 * 60 * 1000;

/** Stored secrets and hashes are base64url text; the bytes come back as they went in. */
const bytesOf = (text: string) => decodeBase64Url(text) ?? new Uint8Array(0);
const hashText = (bytes: Uint8Array) => encodeBase64Url(hashToken(bytes));

/** This installation as a host: its keys, its room on the relay, and its settings. */
export interface HostRecord {
  readonly claimSecret: Uint8Array;
  readonly hostName: string | null;
  readonly isEnabled: boolean;
  readonly publicKey: Uint8Array;
  readonly relayOrigin: string | null;
  readonly room: string;
  readonly secretKey: Uint8Array;
}

interface HostRow {
  claimSecret: string;
  hostName: string | null;
  isEnabled: number;
  publicKey: string;
  relayOrigin: string | null;
  room: string;
  secretKey: string;
}

const hostOf = (row: HostRow): HostRecord => ({
  claimSecret: bytesOf(row.claimSecret),
  hostName: row.hostName,
  isEnabled: row.isEnabled === 1,
  publicKey: bytesOf(row.publicKey),
  relayOrigin: row.relayOrigin,
  room: row.room,
  secretKey: bytesOf(row.secretKey),
});

/** The host record, or null before the owner first turns pairing on or asks for a code. */
export const readHostRecord = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<HostRow>`SELECT claim_secret AS claimSecret, host_name AS hostName, is_enabled AS isEnabled,
    public_key AS publicKey, relay_origin AS relayOrigin, room, secret_key AS secretKey FROM host_identity WHERE id = 1`;
  return row === undefined ? null : hostOf(row);
});

/** The host record, made with fresh keys, a fresh room and a fresh claim secret the first time. */
export const ensureHostRecord = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const existing = yield* readHostRecord;
  if (existing !== null) return existing;
  const keys = generateKeyPair();
  yield* sql`INSERT INTO host_identity (id, claim_secret, host_name, is_enabled, public_key, relay_origin, room, secret_key)
    VALUES (1, ${encodeBase64Url(newDeviceToken())}, NULL, 0, ${encodeBase64Url(keys.publicKey)}, NULL, ${newRoomName()}, ${encodeBase64Url(keys.secretKey)})`;
  const inserted = yield* readHostRecord;
  if (inserted === null) return yield* invalid("The host record could not be made.");
  return inserted;
});

/** The name the host shows: the owner's choice, else the computer's. */
export const hostNameOf = (record: HostRecord | null) =>
  Effect.gen(function* () {
    const config = yield* RemoteConfig;
    return record?.hostName ?? config.computerName;
  });

/** Names the host; a blank name returns it to the computer's. */
export const renameHost = (name: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const trimmed = name.trim();
    if (trimmed.length > maxNameLength) return yield* invalid(`A host's name is at most ${maxNameLength} characters.`);
    yield* ensureHostRecord;
    yield* sql`UPDATE host_identity SET host_name = ${trimmed === "" ? null : trimmed} WHERE id = 1`;
    return yield* hostNameOf(yield* readHostRecord);
  });

/** Turns "Allow paired devices" on or off, making the host record the first time it is turned on. */
export const setRemoteAccess = (isEnabled: boolean) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    if (isEnabled) yield* ensureHostRecord;
    // A code the owner made before switching off must not come back to life when pairing is switched on again.
    else yield* sql`DELETE FROM pairing_codes WHERE used_at IS NULL`;
    yield* sql`UPDATE host_identity SET is_enabled = ${isEnabled ? 1 : 0} WHERE id = 1`;
  });

/** Where a new pairing code points: the host's own relay setting, else the default. */
export const relayOriginOf = (record: HostRecord | null) =>
  Effect.gen(function* () {
    const config = yield* RemoteConfig;
    return record?.relayOrigin ?? config.relayOrigin;
  });

/** Uses the relay at `origin`, or the shared relay when it is null; the host record is made first if it never was. */
export const setRelayOrigin = (origin: string | null) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* ensureHostRecord;
    yield* sql`UPDATE host_identity SET relay_origin = ${origin} WHERE id = 1`;
  });

/** Makes a pairing code's secret, remembering only its hash, and returns the secret with its expiry. */
export const makePairingSecret = (now: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const secret = newPairingSecret();
    const expiresAt = now + pairingCodeMillis;
    yield* sql`DELETE FROM pairing_codes WHERE expires_at < ${now} OR used_at IS NOT NULL`;
    yield* sql`INSERT INTO pairing_codes (id, expires_at, secret_hash, used_at)
      VALUES (${randomUUID()}, ${expiresAt}, ${hashText(secret)}, NULL)`;
    return { expiresAt, secret };
  });

/** What a device that paired is given: its identity here and the token it proves itself with. */
interface NewDevice {
  readonly deviceId: string;
  readonly token: Uint8Array;
}

/** Accepts a pairing secret once and enrols the device that presented it; the hash of its token is all kept. */
export const redeemPairingSecret = (secret: Uint8Array, device: { kind: DeviceKind; name: string }, now: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const record = yield* readHostRecord;
    if (record === null || !record.isEnabled) return { refusal: "disabled" } as const;
    const [code] = yield* sql<{ expiresAt: number; id: string; usedAt: number | null }>`
      SELECT id, expires_at AS expiresAt, used_at AS usedAt FROM pairing_codes WHERE secret_hash = ${hashText(secret)}`;
    if (code === undefined) return { refusal: "code-invalid" } as const;
    if (code.usedAt !== null) return { refusal: "code-used" } as const;
    if (code.expiresAt < now) return { refusal: "code-expired" } as const;
    // The update itself decides who used it first when two devices present the same secret together.
    const taken = yield* sql<{ id: string }>`UPDATE pairing_codes SET used_at = ${now}
      WHERE id = ${code.id} AND used_at IS NULL RETURNING id`;
    if (taken.length === 0) return { refusal: "code-used" } as const;
    const deviceId = randomUUID();
    const token = newDeviceToken();
    yield* sql`INSERT INTO paired_devices (id, kind, last_active_at, name, paired_at, token_hash)
      VALUES (${deviceId}, ${device.kind}, ${now}, ${device.name}, ${now}, ${hashText(token)})`;
    return { device: { deviceId, token } satisfies NewDevice } as const;
  });

/** A device that proves itself by its token: its name, or null when it is unknown, disconnected, or wrong. */
export const resumeDevice = (deviceId: string, token: Uint8Array, now: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ name: string; tokenHash: string }>`
      SELECT name, token_hash AS tokenHash FROM paired_devices WHERE id = ${deviceId}`;
    if (row === undefined || !constantTimeEqual(bytesOf(row.tokenHash), hashToken(token))) return null;
    yield* sql`UPDATE paired_devices SET last_active_at = ${now} WHERE id = ${deviceId}`;
    return row.name;
  });

/** Whether a device is still paired, as the host registers its connection, so a Disconnect in between is not missed. */
export const isDevicePaired = (deviceId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`SELECT id FROM paired_devices WHERE id = ${deviceId}`;
    return rows.length > 0;
  });

/** Records that a device was active, for Charter's "last active". */
export const touchDevice = (deviceId: string, now: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE paired_devices SET last_active_at = ${now} WHERE id = ${deviceId}`;
  });

/** The paired devices, with which of them are connected now. */
export const listDevices = (connected: ReadonlySet<string>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{
      id: string;
      kind: DeviceKind;
      lastActiveAt: number | null;
      name: string;
      pairedAt: number;
    }>`SELECT id, kind, last_active_at AS lastActiveAt, name, paired_at AS pairedAt FROM paired_devices
      ORDER BY paired_at`;
    return rows.map((row): PairedDevice => ({ ...row, id: row.id as DeviceId, isConnected: connected.has(row.id) }));
  });

/** Forgets a device's pairing; its connection, if any, is closed by the runtime. */
export const forgetDevice = (deviceId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const gone = yield* sql<{ id: string }>`DELETE FROM paired_devices WHERE id = ${deviceId} RETURNING id`;
    if (gone.length === 0) return yield* invalid("That device is not paired with this host.");
  });

/** Charter's remote access section as it stands. */
export const remoteAccessView = (status: RemoteAccessView["status"], connected: ReadonlySet<string>) =>
  Effect.gen(function* () {
    const record = yield* readHostRecord;
    return {
      devices: yield* listDevices(connected),
      hostName: yield* hostNameOf(record),
      isEnabled: record?.isEnabled ?? false,
      isOwnRelay: record?.relayOrigin != null,
      relayOrigin: yield* relayOriginOf(record),
      status,
    } satisfies RemoteAccessView;
  });
