# OpenMission

## Documents

- `documentation/outline.md`: what the system is for, its actors and capabilities. Read before any product or design work.
- `documentation/requirements.md`: system-wide obligations. Read before any design or technical choice.
- `documentation/glossary.md`: the domain language. Read before naming anything; use its terms.
- `documentation/architecture.md`: the system's parts, flows, and how each requirement is met. Read before any technical or structural change.
- `documentation/architecture-decision-record/`: why hard-to-reverse choices were made. Read before reversing one; add a record for each new one.
- `documentation/capabilities/<capability>/specifications.md`: each capability's agreed behavior and acceptance. Read before changing that capability.
- `documentation/first-slice-design.md` and `documentation/capabilities/<capability>/blueprint.md`: proposed modules, interfaces, and staged acceptance. Read before implementing or reviewing the first slice; settle the listed review decisions before production code.
- `documentation/backlog.md`: candidate work and deferrals. Read when choosing what to do next.
- `documentation/work-in-progress.md`: the current batch, its checks, and open questions. Read first when resuming; work proceeds in batches with the iterate skill.
- `documentation/changelog.md`: authorized agreements and verified deliveries. Append a record for each.

## Tooling

- `.agents/ai-tooling.md`: installed AI tools (CodeGraph, Context7, ast-grep, Playwright CLI), their checks, gaps, and session recovery. Read before reinstalling or measuring tooling, or when a session must be recovered.
- Commits run `.githooks/pre-commit` (Biome on staged files, then `bun run typecheck`); fix with `bun run format` and stage again.
- A Git guard (`.agents/hooks/guard-git.py`, level 2) asks before, or blocks, pushes to `main` and commands that lose local work; `.githooks/pre-push` refuses pushes to `main`. A person approves a push to `main` with `git push --no-verify`; an agent asks the user instead.

## Handoffs

To resume the first slice's batch work, read the [current handoff](.agents/handoffs/2026-11-05-2136-claude-code-chat-batch.md). Handoffs are shared and committed.
