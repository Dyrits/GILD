---
status: accepted
---

# Conversation terminals run in the host service, fenced for paired devices

Agreed with the owner on 2026-11-14 (CHG-0282, CHG-0283); not built. This amends [0012](0012-desktop-conversation-terminals.md): the owner's pseudo-terminals move from the desktop main process into the host service, so a terminal runs where the threads run and works from the desktop app, the web app, and every paired device, as [Same features in every app](../requirements.md#access) requires. The rest of 0012 stands: xterm in the composer, the owner's login shell, and the sent transcript carried as an ordinary owner message.

- **From the host's own window**: the full shell as the owner, as today.
- **From a paired device**: only while the host's **Allow terminals from paired devices** switch is on (off by default, host only), and inside the operating system's sandbox, the kind the harnesses run in (Seatbelt on macOS, as Iskios already writes for OpenCode; bubblewrap or Landlock on Linux). It may write only inside the thread's folder and read only there and in the system's folders. Where no such sandbox is available (Windows for now), terminals from paired devices stay off.
- **Why a sandbox**: reading commands to block `cd ../..` cannot hold, since a shell reaches any folder through an absolute path, a script, `bash -c`, or a symlink; Paseo checks no starting folder at all ([research](../research/paseo-daemon.md)). The allowed folder is the one place to narrow later when realms and quests are shared ([Future multiplayer](../requirements.md#access)).
- **Native module**: `node-pty` moves with the terminals; the host runs on the desktop app's binary as Node ([0018](0018-host-service-runs-on-its-own.md)), so it keeps the build made for Electron's Node.
- **Not adopted from Paseo**: a separate terminal process that outlives host restarts; terminals end when the host stops.
