# Device pairing

Authorized by the owner on 2026-11-12 (CHG-0201): control one Iskios from another instance of Iskios, from any internet connection, with nothing for the user to set up and no cost to the owner or the users. A phone uses the same pairing later; the phone web app is not part of this first slice. Unsettled points are in the [draft](draft.md).

Terms: the computer being controlled is the **host**; any other Iskios connected to it is a **paired device** ([glossary](../../glossary.md#devices)).

## Behavior

- A paired device reaches its host from any internet connection, through the shared relay ([0016](../../architecture-decision-record/0016-shared-relay-on-the-owners-free-cloudflare-account.md)). The user needs no account with any service and deploys nothing.
- The relay cannot read what it carries: messages between a host and a paired device are end-to-end encrypted, and the keys travel only in the pairing code ([requirements](../../requirements.md#privacy-and-data)).
- A host accepts paired devices only while "Allow paired devices" is on in Charter; it is off by default. Turning it off ends every paired device's connection and stops new pairings, and keeps the pairings.
- The host shows a pairing code as text. A code works once and expires 10 minutes after it is shown. The Iskios app on another computer pairs by choosing **Add a host** in its host menu and pasting the code. A QR code of the same code comes with the phone.
- The host lists its paired devices in Charter. Each shows its name, its kind (desktop or phone), when it was last active, and a **Disconnect** button. Disconnecting a device ends its connection immediately and forgets its pairing; it can pair again with a new code. A paired device stays paired until it is disconnected.
- A paired device has the owner's full authority over the host: it steers threads, answers approvals, changes budgets and settings, and creates and moves quests exactly as the owner does on the host. Only the host itself shows pairing codes and disconnects devices.
- The host keeps a name, defaulting to the computer's name, and the owner can rename it from the host or from a paired device.
- The Iskios app on a computer has a host menu at the top left, like OpenBot's: it lists **This computer** and each paired host, marks the one in use, and switches the whole app to the chosen one, with the same screens and the same abilities as on the host. The data shown is the host's, not the computer's own, and choosing **This computer** returns to its own.
- Choosing a realm folder no longer opens the system dialog, on this computer or on a host. One picker runs on the host: a search field taking typed paths and ranking matches (exact, prefix, substring, then fuzzy; folders only), suggestions from folders the quests already used, step-in browsing through `ListWorkspaceEntries`, and a New folder flow (choose the parent, then name it). A search stays inside its root and follows a symlink only if it resolves inside that root; hidden folders, `node_modules`, build output and Git-ignored folders are not offered; a path typed exactly always resolves; at most two filesystem calls run at once, so a stuck drive cannot freeze the host. The root lets the owner reach any folder they can open, not only today's browsable roots (CHG-0202).
- A host that no longer knows this installation (it disconnected it) refuses it for good: the app stops trying, says "The host no longer knows this computer. Pair with it again.", and offers **Use this computer**; a host that is merely unreachable is tried again, ever more slowly (a second, then doubling to half a minute), because each try asks the relay, whose daily allowance everyone shares.
- While a host is shown, what only works on the computer the window runs on is off, never aimed at the wrong computer: `!` stays ordinary text (the terminal on a host is a later batch) and the system folder dialog refuses with a message (the folder picker on the host is the next batch); Charter's remote access section says that paired devices are managed on the host itself.
- The relay says why it closes a connection, in a text frame sent just before the close (no host, room full, host left, replaced, claim mismatch, a rule broken), and the host and the app act on it at once; the close itself can reach a Node client ten seconds late.
- While the host is unreachable, the app says so and reconnects by itself; what the owner does on a paired device reaches the host only while it is connected.

## Acceptance

- Two instances on one computer, each with its own data folder, one acting as host and one as paired device through a locally run relay: pairing with a code succeeds once and a second use of the same code fails; an expired code fails; the paired device shows the host's quests and a message sent from it reaches the host's thread; the host's changes appear on the paired device; Disconnect cuts the connection at once; turning off "Allow paired devices" cuts it too.
- On a paired device, typing a path finds a folder on the host and not on the computer in use; a folder is created on the host; a hidden folder, `node_modules`, and a symlink pointing outside the root are not offered; a typed path to one of them still resolves when it is inside the root.
- The relay's stored messages and logs contain no plaintext (checked by reading what the relay received during the run above).
- The same flow, run once against the deployed relay on the owner's account, from a second network, with the owner's go-ahead before deploying.
- The free-plan limits of the relay are read from Cloudflare's documentation and measured against a typical session before the first release.
