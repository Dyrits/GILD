# Proof: Harnesses and Accounts merged (CHG-0268)

- **Verdict:** the merged layout works on the fake harness in a window; appearance awaits the owner's look, and Update and Install are unseen.
- **Environment:** macOS, bun 1.4.3, Electron 45; web export served on `localhost:8099`, a throwaway Electron with `ISKIOS_HARNESS=fake` and its own data folder, driven over the DevTools protocol with the earlier [cdp.ts](2026-11-13-computer-name-and-companions/scripts/cdp.ts). Dark theme only.
- **Seen:** one card per harness (Claude Code, Codex, OpenCode) with logo, name, version pill, Ready pill; each account row with name, detail, Signed in pill, Rename, "⋯"; Add account opening a field, adding "Work" to Claude Code's card; the menu listing "Sign in again" for the computer's sign-in and "Sign in again, Remove" for "Work"; Remove deleting "Work"; Rename turning the name into a field with Save and Cancel. No console errors. A first run wrapped the "⋯" onto its own line in a 600 px column; fixed by keeping the row on one line, and rechecked.
- **Screens:** [menu](2026-11-14-providers-merged/screens/03-menu.png), [adding](2026-11-14-providers-merged/screens/04-adding.png), [added](2026-11-14-providers-merged/screens/05-added.png), [rename](2026-11-14-providers-merged/screens/06-rename.png).
- **Not checked:** see CHG-0268.
