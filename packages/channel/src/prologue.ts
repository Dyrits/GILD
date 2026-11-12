/**
 * The bytes both ends of a pairing bind into the Noise handshake: the room's name, so a handshake made for one room
 * cannot be replayed into another. The host and the paired device must agree on them.
 */
export function roomPrologue(room: string): Uint8Array {
  return new TextEncoder().encode(`iskios/1 ${room}`);
}
