# Tool and skill loading: resolved draft

## Current state

[Specifications](specifications.md) records the answers to Q1 through Q15, including the user's correction to Q3: names and descriptions at the start, full instructions when used, supporting files as needed. Q7 settled OpenMission-managed global and workspace MCP configuration in version 1. Q13 requires a user choice for conflicting MCP names.

## Resolution

- Hosted resource access is settled by CHG-0018 and now referenced in the specifications. Version 1 remains single-user. Resource import and synchronization across installations remain undesigned and outside this capability's current scope.
- The user confirmed the completed scope and validation plan on 2026-11-05 (CHG-0022). The specifications are authoritative; this draft has no remaining capability decisions.

## Accepted agent additions

- The automated acceptance checks.
- Loading a skill or tool does not itself grant action approval.
- This capability adds no new thread tool contract in version 1.

Next: design the first slice's modules, interfaces, data ownership, and test seams before production implementation. Acceptance of this specification does not authorize production implementation or a commit and push.
