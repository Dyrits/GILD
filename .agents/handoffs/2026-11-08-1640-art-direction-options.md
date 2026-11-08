# Handoff: art direction options D to J

Supersedes: none (forked from `2026-11-08-1514-sketchbook-look.md`)
Workspace: CANOPY repository, branch `main`

To resume: read this whole file first. Treat every claim in State not marked verified as unverified, and check it against the Sources. Read the superseded handoff only when something here cannot be resolved from this file and its Sources. Confirm what was in flight and what you will do next with the user before starting. Never edit this file: a later state goes into a new handoff.

## Goal

Keep seven alternative art directions for Canopy on file, beside the taken Sketchbook look, so the owner can later pick one either as a selectable theme for the app or as the basis of a future visual rework. Done for now: the boards exist and are committed; nothing is to be built until the owner chooses.

## State

- Seven HTML boards in `documentation/art-direction/`, each a static mockup of the whole window plus a kit of building blocks, with the same content as `2026-11-08-sketchbook-board.html` (verified: files listed and rendered with Playwright, `playwright screenshot --full-page --viewport-size=1400,920 file://…`):
  - D `2026-11-08-flight-deck-board.html`: dark cockpit, corner brackets, cyan and amber.
  - E `2026-11-08-flight-manual-board.html`: drafting paper, navy ink, one chamfered corner; between Sketchbook and D.
  - F `2026-11-08-forest-canopy-board.html`: tree canopy, leaf-shaped cards, Done in straw.
  - G `2026-11-08-brigade-board.html`: renamed Brigade; kitchen pass, thermal tickets on a rail.
  - H `2026-11-08-guild-board.html`: renamed Guild; heroic fantasy quest board, with a lexicon mapping glossary terms to quest terms.
  - I `2026-11-08-tower-board.html`: renamed Tower; air traffic strip board, radar scope, B612 type.
  - J `2026-11-08-copydesk-board.html`: renamed Copydesk; newspaper front page, editor's red pencil.
- Recorded as CHG-0071 in `documentation/changelog.md` (verified: appended this session).
- The last small CSS fixes (Guild coin wrapping, Copydesk ring size) were not re-rendered (assumed fine).
- `2026-11-08-art-directions.html` does not link to D to J (verified: not edited).

## Decisions

- The Sketchbook look (CHG-0068) stays the app's look; D to J are options only.
- In every board, the glossary's terms stay on what the user acts on (Approve, Land, Hand over); the theme lives in decoration. Guild is the exception: it renames the interface and shows the glossary term under each banner and in its lexicon.
- Feedback so far: Forest Canopy "not my style"; the owner liked Brigade, which set the "real profession that runs many jobs at once" approach used for I and J.

## Next

1. Ask the owner whether to link D to J from `documentation/art-direction/2026-11-08-art-directions.html`.
2. When the owner wants to act on one: decide theme (selectable, alongside Sketchbook) or rework (replaces Sketchbook). A theme needs design tokens that can switch; check `apps/app/src/styles.ts` and `documentation/architecture.md` first, and record the choice in an ADR if a rename (Brigade, Guild, Tower, Copydesk) is taken.
3. Add the chosen direction to `documentation/backlog.md` if it is deferred.

## Open questions

- Theme or rework, and which direction: the owner.
- Whether a rename of the app is on the table (four boards assume one): the owner.

## Sources

- `documentation/art-direction/` (all boards, including `2026-11-08-sketchbook-board.html` and `2026-11-08-art-directions.html`)
- `documentation/changelog.md` CHG-0068, CHG-0071
- `.agents/handoffs/2026-11-08-1514-sketchbook-look.md`
