# Desktop conversation terminals

The desktop main process owns the owner's ephemeral interactive shells through node-pty, while xterm renders them in the Expo web conversation.
The platform's process pipes do not provide terminal job control, interactive prompts, or screen programs, and React Native has no terminal emulator; these two dependencies cover those jobs.
The existing Electron preload exposes only open, input, resize, close, and output subscriptions to its main frame, with no terminal endpoint on the service or relay.
The shell uses the owner's default login shell; its starting folder follows the [conversation terminal specification](../capabilities/conversation-terminal/specifications.md#behavior), including the Free Realm fallback agreed in CHG-0131.
Owner-entered commands are direct desktop interaction rather than harness actions.

The local service remains the owner of persisted conversation data.
Sending serializes the visible transcript into the normal owner message, so its existing storage, steering, handover, and harness-delivery paths carry the context without a second delivery mechanism.
The UI recognizes that serialized block for presentation; it does not execute its contents.
Shell processes and unsent replay buffers stay in memory and end with the desktop window.
A future paired-device or multiplayer terminal requires a separate authorization and transport design.

Amendment (CHG-0283): the shells move from the desktop main process into the host service, and paired devices may open them inside a sandbox; see [0020](0020-terminals-run-in-the-host.md). "End with the desktop window" becomes "end with the host".
