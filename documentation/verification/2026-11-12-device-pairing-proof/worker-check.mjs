// Drives the real relay Worker (under local workerd) with the repository's own client and channel: a host and a client
// run the Noise handshake through the Durable Object, exchange text both ways (a 300 KiB message included), and a second
// host with another claim is refused. Bundle with esbuild, then run: node worker-check.bundle.mjs http://127.0.0.1:8792
// Drives the real Worker (under local workerd) with the repo's relay client and channel: a host and a client
// run the Noise handshake through the Durable Object, exchange text both ways, and a second host is refused.
import { generateKeyPair, newRoomName, openInitiator, openResponder } from "../../../packages/channel/src/index.ts";
import { connectClient, connectHost } from "../../../packages/relay/src/client.ts";

const base = process.argv[2];
const room = newRoomName();
const claim = crypto.getRandomValues(new Uint8Array(32));
const keys = generateKeyPair();
const prologue = new TextEncoder().encode(`iskios/1 ${room}`);
const log = (...a) => console.log(...a);

const hostResult = await connectHost({ claim, relayOrigin: base, room });
if (!hostResult.ok) throw new Error("host could not connect");
const host = hostResult.value;
const seen = { closeCode: null, joined: 0 };
const carriers = new Map();
host.onClientJoined((id) => {
  seen.joined++;
  const messages = [];
  const carrier = {
    close: () => host.closeClient(id),
    onClose: () => {},
    onMessage: (l) => messages.push(l),
    send: (d) => host.sendToClient(id, d),
  };
  carriers.set(id, { messages });
  openResponder(carrier, keys, prologue).then((r) => {
    if (!r.ok) return log("host handshake failed", r.kind);
    r.value.onText((t) => r.value.sendText(`echo:${t}`));
    log("host: channel open for client", id.slice(0, 4));
  });
});
host.onClientData((id, data) => {
  for (const listener of carriers.get(id)?.messages ?? []) listener(data);
});
host.onClose((code) => (seen.closeCode = code));

const clientResult = await connectClient({ relayOrigin: base, room });
if (!clientResult.ok) throw new Error("client could not connect");
const channelResult = await openInitiator(clientResult.value.carrier, keys.publicKey, prologue);
log("client handshake:", channelResult.ok ? "ok" : channelResult.kind);
const channel = channelResult.value;
const reply = new Promise((resolve) => channel.onText(resolve));
channel.sendText("hello through the Durable Object");
log("round trip:", await Promise.race([reply, new Promise((r) => setTimeout(() => r("TIMEOUT"), 5000))]));

// A 300 KiB message is fragmented by the channel and reassembled on the other side.
const big = "x".repeat(300 * 1024);
const bigReply = new Promise((resolve) => channel.onText((t) => t.length > 1000 && resolve(t.length)));
channel.sendText(big);
log(
  "300 KiB echo length:",
  await Promise.race([bigReply, new Promise((r) => setTimeout(() => r("TIMEOUT"), 8000))]),
  "(expected",
  `${big.length + 5})`,
);

// A second host with another claim must not take the room.
const intruder = await connectHost({ claim: crypto.getRandomValues(new Uint8Array(32)), relayOrigin: base, room });
let intruderCode = null;
if (intruder.ok) intruder.value.onClose((c) => (intruderCode = c));
await new Promise((r) => setTimeout(r, 1500));
log("intruder closed with:", intruderCode, "(expected 1008)");
// A client in a room with no host is turned away.
const lonely = await connectClient({ relayOrigin: base, room: newRoomName() });
await new Promise((r) => setTimeout(r, 1500));
log("client in empty room close code:", lonely.ok ? lonely.value.closeCode() : "unreachable", "(expected 1013)");
process.exit(0);
