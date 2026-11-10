---
status: proposed
---

# Model prices come from a public table, cached, with a shipped fallback

To show an estimated cost for every harness, the local service reads the model price table at models.dev (`api.json`) at startup and daily, keeps the models its harnesses offer in its own SQLite file, and falls back to a snapshot of the table shipped with Gild when the read fails or the owner switches it off in the Charter (budget-control, CHG-0126). This is the first outbound read of data that is not a harness's own version check, so the architecture's Integrations section would gain it once accepted.

The request is a plain GET that carries nothing about missions, workspaces, accounts, or the owner (requirement "Price table read carries no owner data"). A price is stamped on each turn when it ends, so a later table never changes a recorded figure, and a model the table does not know is shown with tokens and no price.

Considered: shipping prices only (they go stale at each model release, and the owner would wait for a Gild release); a LiteLLM table (similar coverage, a heavier file, less used by the harnesses Gild drives); the harnesses' own reported costs only (Claude Code and OpenCode report one, Codex reports none, and the figures differ in source). Hard to reverse because recorded turns carry the table's date and source, and the Charter switch and the snapshot become part of the owner's expectations.

Awaiting the owner's acceptance. When accepted, add the read to `architecture.md` (Integrations and Decisions) and a line to `AGENTS.md` where decision records are named.
