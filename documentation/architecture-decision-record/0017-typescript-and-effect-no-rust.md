---
status: accepted
---

# Iskios's own code stays TypeScript with Effect; no Rust migration

The owner decided on 2026-11-14 (CHG-0282) that Iskios is not rewritten in Rust: the host service, the relay Worker, and the shared packages stay TypeScript with Effect ([0010](0010-effect-in-the-service-and-relay.md)), and the interface stays one Expo app for the desktop, web, and mobile apps ([0009](0009-one-expo-app-everywhere.md)). One language across the host, the relay, the shared records, and the screens keeps one toolchain and lets the records in `packages/contracts` be shared as they are. Separating the host from Electron, browser access, and a background host are done within this stack.

The runtime under the host is not settled by this record. The owner prefers Bun if it fits, and Node otherwise; the comparison stays in the [backlog](../backlog.md) (Desktop shell and service runtime). Electron stays the desktop shell until that comparison says otherwise ([0004](0004-electron-desktop-shell.md)).

## Considered Options

- **A Rust host (or a Rust core under the TypeScript screens)**: rejected by the owner. It would split the code across two languages and rewrite the Effect supervision of harness processes, budgets, and streams for no requirement it meets better.
