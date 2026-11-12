import { randomUUID } from "node:crypto";
import { decodeBase64Url, encodeBase64Url } from "@iskios/channel";
import type { HostId, KnownHost } from "@iskios/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "../core/index.ts";

// This installation as a controller: the hosts it is paired with (device-pairing). Everything here is storage; the
// links to the hosts are in the controller.

/** A host this installation can connect to, with what it needs to find it and prove itself. */
export interface HostLink {
  readonly deviceId: string;
  readonly deviceToken: string;
  readonly hostName: string;
  readonly hostPublicKey: Uint8Array;
  readonly id: string;
  readonly relayOrigin: string;
  readonly room: string;
}

interface HostLinkRow {
  deviceId: string;
  deviceToken: string;
  hostName: string;
  hostPublicKey: string;
  id: string;
  relayOrigin: string;
  room: string;
}

/** The hosts, for the host menu. */
export const listKnownHosts = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string; lastSeenAt: number | null; name: string; pairedAt: number }>`
    SELECT id, last_seen_at AS lastSeenAt, host_name AS name, paired_at AS pairedAt FROM remote_hosts ORDER BY paired_at`;
  return rows.map((row): KnownHost => ({ ...row, id: row.id as HostId }));
});

/** What is needed to connect to one host, or null when this installation has no such host. */
export const readHostLink = (hostId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<HostLinkRow>`SELECT id, device_id AS deviceId, device_token AS deviceToken,
      host_name AS hostName, host_public_key AS hostPublicKey, relay_origin AS relayOrigin, room
      FROM remote_hosts WHERE id = ${hostId}`;
    return row === undefined
      ? null
      : ({ ...row, hostPublicKey: decodeBase64Url(row.hostPublicKey) ?? new Uint8Array(0) } satisfies HostLink);
  });

/** Keeps a host this installation just paired with. */
export const saveHost = (host: Omit<HostLink, "id">, now: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const id = randomUUID();
    const publicKey = encodeBase64Url(host.hostPublicKey);
    // Pairing again with a host this installation already has (after it was disconnected) replaces the old entry,
    // which could only be refused, instead of leaving two under one name.
    yield* sql`DELETE FROM remote_hosts WHERE room = ${host.room} AND host_public_key = ${publicKey}`;
    yield* sql`INSERT INTO remote_hosts (id, device_id, device_token, host_name, host_public_key, last_seen_at, paired_at,
      relay_origin, room) VALUES (${id}, ${host.deviceId}, ${host.deviceToken}, ${host.hostName},
      ${publicKey}, ${now}, ${now}, ${host.relayOrigin}, ${host.room})`;
    return { id: id as HostId, lastSeenAt: now, name: host.hostName, pairedAt: now } satisfies KnownHost;
  });

/** Notes that a host answered and what it is called now. */
export const touchHost = (hostId: string, hostName: string, now: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE remote_hosts SET host_name = ${hostName}, last_seen_at = ${now} WHERE id = ${hostId}`;
  });

/** Forgets a host here. */
export const forgetHost = (hostId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const gone = yield* sql<{ id: string }>`DELETE FROM remote_hosts WHERE id = ${hostId} RETURNING id`;
    if (gone.length === 0) return yield* invalid("This installation has no such host.");
  });
