import { closeWithReason, type Member, RoomCore, type RoomLimits, type RoomPeer } from "../../src/roomCore.ts";
import type { Role } from "../../src/route.ts";

/** A stand-in connection that records what the room sent and how it was closed. */
export class FakePeer implements RoomPeer {
  closed: { code: number; reason: string } | null = null;
  /** How many frames had been sent when the connection was closed; null while it is open. */
  sentWhenClosed: number | null = null;
  readonly sent: (string | Uint8Array)[] = [];

  close(code: number, reason: string): void {
    if (this.closed === null) this.sentWhenClosed = this.sent.length;
    this.closed ??= { code, reason };
  }

  send(data: string | Uint8Array): void {
    this.sent.push(data);
  }

  /** The binary frames received so far, copied so later changes cannot alter them. */
  frames(): Uint8Array[] {
    return this.sent
      .filter((data): data is Uint8Array => typeof data !== "string")
      .map((data) => Uint8Array.from(data));
  }
}

/** A room built on in-memory stand-ins, with a way to see what the claim storage holds. */
export const createFakeRoom = (limits: Partial<RoomLimits> = {}) => {
  const members = new Map<FakePeer, Member<FakePeer>>();
  const storage: { claim: Uint8Array | null; writes: number } = { claim: null, writes: 0 };
  const core = new RoomCore<FakePeer>(
    {
      enroll: (member) => members.set(member.peer, member),
      memberOf: (peer) => members.get(peer) ?? null,
      members: () => [...members.values()],
      readClaim: () => Promise.resolve(storage.claim),
      retire: (peer) => members.delete(peer),
      writeClaim: (hash) => {
        storage.claim = hash;
        storage.writes += 1;
        return Promise.resolve();
      },
    },
    limits,
  );

  /** Connects a stand-in the way a transport does: screen, then open if accepted. */
  const connect = async (role: Role, secret: string | null = null): Promise<FakePeer> => {
    const peer = new FakePeer();
    const claim = secret === null ? null : new TextEncoder().encode(secret.padEnd(16, "."));
    const rejection = await core.screen(role, claim);
    if (rejection === null) core.open(peer, role);
    else closeWithReason(peer, rejection.code, rejection.reason);
    return peer;
  };

  return { connect, core, storage };
};

/** A frame the way a host sends it: a type byte, a client id, then the payload. */
export const hostFrameOf = (type: number, id: Uint8Array, payload: number[] = []): Uint8Array =>
  Uint8Array.from([type, ...id, ...payload]);

/** The id a notice or forwarded frame carries: bytes 1 to 8. */
export const idOf = (frame: Uint8Array): Uint8Array => frame.slice(1, 9);
