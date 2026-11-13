import { Schema } from "effect";

// Device pairing: a host is the computer whose Iskios a paired device controls (device-pairing).

/** Identifies a paired device on its host. */
export const DeviceId = Schema.String.pipe(Schema.brand("DeviceId"));
export type DeviceId = typeof DeviceId.Type;

/** Identifies a host this installation has paired with, on this installation. */
export const HostId = Schema.String.pipe(Schema.brand("HostId"));
export type HostId = typeof HostId.Type;

/** The longest name of a host or of a paired device, in characters. */
export const maxNameLength = 60;

/**
 * The close codes of the link the local service opens to a paired host for the app: it could not open (try again
 * later), the host ended it, and the host refused this installation (trying again cannot help).
 */
export const hostLinkCodes = { couldNotOpen: 4000, ended: 4001, refused: 4002 } as const;

/** The path of the loopback server that joins the app to a paired host. */
export const hostBridgePath = (hostId: string) => `/host/${hostId}`;

/** What a paired device is: another computer's Iskios, or a phone. */
export const DeviceKind = Schema.Literals(["desktop", "phone"]);
export type DeviceKind = typeof DeviceKind.Type;

/** A device paired with this host, as Charter lists it. */
export const PairedDevice = Schema.Struct({
  id: DeviceId,
  isConnected: Schema.Boolean,
  kind: DeviceKind,
  lastActiveAt: Schema.NullOr(Schema.Number),
  name: Schema.String,
  pairedAt: Schema.Number,
});
export type PairedDevice = typeof PairedDevice.Type;

/** How this host's connection to the relay stands; Off while "Allow paired devices" is off. */
export const RelayStatus = Schema.Literals(["Off", "Connecting", "Connected", "Unreachable"]);
export type RelayStatus = typeof RelayStatus.Type;

/**
 * Charter's remote access section: the switch, the host's name, the relay (the shared one, or the owner's own on their
 * Cloudflare account), and the paired devices.
 */
export const RemoteAccessView = Schema.Struct({
  devices: Schema.Array(PairedDevice),
  hostName: Schema.String,
  isEnabled: Schema.Boolean,
  isOwnRelay: Schema.Boolean,
  relayOrigin: Schema.String,
  status: RelayStatus,
});
export type RemoteAccessView = typeof RemoteAccessView.Type;

/** A pairing code to give to another Iskios; it works once and expires at `expiresAt` (epoch milliseconds). */
export const PairingCode = Schema.Struct({ code: Schema.String, expiresAt: Schema.Number });
export type PairingCode = typeof PairingCode.Type;

/** A host this installation is paired with, as the host menu lists it. */
export const KnownHost = Schema.Struct({
  id: HostId,
  lastSeenAt: Schema.NullOr(Schema.Number),
  name: Schema.String,
  pairedAt: Schema.Number,
});
export type KnownHost = typeof KnownHost.Type;

// Host-only requests: a paired device never gets them answered, whatever its authority otherwise (device-pairing).

/** Reads Charter's remote access section. */
export const ReadRemoteAccess = Schema.TaggedStruct("ReadRemoteAccess", {});
/** Turns "Allow paired devices" on or off; off ends every device's connection and keeps the pairings. */
export const SetRemoteAccess = Schema.TaggedStruct("SetRemoteAccess", { isEnabled: Schema.Boolean });
/** Makes a pairing code that works once, for ten minutes. */
export const CreatePairingCode = Schema.TaggedStruct("CreatePairingCode", {});
/** Ends a device's connection at once and forgets its pairing. */
export const DisconnectDevice = Schema.TaggedStruct("DisconnectDevice", { deviceId: DeviceId });
/**
 * Deploys the relay to the Cloudflare account `token` reaches and uses it in place of the shared relay. The token is
 * used for this deployment only and is never kept; devices paired through the old relay cannot reach the new one.
 */
export const UseOwnRelay = Schema.TaggedStruct("UseOwnRelay", { token: Schema.String });
/** Goes back to the shared relay; the owner's relay on Cloudflare is left in place. */
export const UseSharedRelay = Schema.TaggedStruct("UseSharedRelay", {});
/** Lists the hosts this installation is paired with. */
export const ListHosts = Schema.TaggedStruct("ListHosts", {});
/** Pairs this installation with the host that made `code`, naming this installation `deviceName` there. */
export const AddHost = Schema.TaggedStruct("AddHost", { code: Schema.String, deviceName: Schema.String });
/** Forgets a host here; the host still lists this installation until it disconnects it. */
export const RemoveHost = Schema.TaggedStruct("RemoveHost", { hostId: HostId });

// Answered on a host for the owner and for a paired device alike.

/** Reads this host's name. */
export const ReadHostName = Schema.TaggedStruct("ReadHostName", {});
/** Names this host; the name shows on every paired device. */
export const RenameHost = Schema.TaggedStruct("RenameHost", { name: Schema.String });

/** The request tags a paired device may not send to a host. */
export const hostOnlyRequestTags = [
  "AddBrowsableRoot",
  "AddHost",
  "CreatePairingCode",
  "DisconnectDevice",
  "ListHosts",
  "ReadRemoteAccess",
  "RemoveBrowsableRoot",
  "RemoveHost",
  "SetRemoteAccess",
  "UseOwnRelay",
  "UseSharedRelay",
] as const satisfies ReadonlyArray<import("./requests.ts").RequestTag>;
