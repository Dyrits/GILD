# Proof: batch 6 in the window with a real Claude Code turn

- **Verdict:** proven. This closes the first item of the batch 6 proof's Not verified list ([2026-11-06-steering.md](2026-11-06-steering.md)).
- **Work:** `e6fd553` (batches 6 and 7 delivered), desktop bundle rebuilt from it
- **Agreement:** CHG-0039, CHG-0040; `documentation/work-in-progress.md` (Batch 6, Checks: Live)
- **Environment:** macOS 26.6.2, Bun 1.4.3, Electron 45.2.3, Claude Code 2.1.302 with Haiku at low effort, on the owner's default Claude Code account. Metro on port 8082 without `CI=1`. Electron ran with `env -i HOME PATH USER TMPDIR LANG OPENMISSION_DATA_DIR=/tmp/om-run/data-b6live OPENMISSION_APP_URL=http://localhost:8082 Electron --inspect=9334 dist/main.js --remote-debugging-port=9333` in `apps/desktop`, with no `OPENMISSION_HARNESS`, so the real harness ran. The window was driven with `playwright-cli attach --cdp=http://localhost:9333` after focusing it with [main-eval.ts](2026-11-06-batch-4-drive/main-eval.ts), as in [the batch 4 drive](2026-11-06-batch-4-drive.md). Results were read from the window and from `openmission.sqlite` in the data folder.
- **Date:** 2026-11-06, about 14:05 (Europe/Paris)
- **Who:** an agent, at the owner's request ("Yes, go for it.").

## Claims

| # | Claim | Verdict |
| --- | --- | --- |
| L1 | A message the owner sends with Send while a real Claude Code turn runs joins that turn, and the turn's reply follows it | proven |
| L2 | Interrupt ends a real Claude Code turn at once, the thread becomes Idle, and its shell command stops | proven |
| L3 | After an interrupt, the thread takes the next message in a new turn of the same session | proven |

## Evidence

- **L1:** mission "Run this shell command and wait for it to finish: for i in $(seq 1 45); do echo tick $i; sleep 1; done. Then reply with the last tick number." While it ran, the composer showed Interrupt, Queue, and Send; "Also end your reply with the word PINEAPPLE." sent with Send ([live-steer-sent.png](2026-11-06-steering-live/live-steer-sent.png)). Both messages have the same `delivered_turn_id`; that turn is `completed`, and the only reply is "The loop finished, and the last tick was 45. PINEAPPLE" ([live-steer-done.png](2026-11-06-steering-live/live-steer-done.png)).
- **L2:** a second message started a 60-second loop ("Ran · Loop 60 tocks with 1-second sleeps · 02:06 PM"). Interrupt was clicked at 14:06:42; the turn's status read `interrupted` at 14:06:43, the thread showed Idle with no reply from the interrupted turn, the composer lost Interrupt and Queue ([live-interrupted.png](2026-11-06-steering-live/live-interrupted.png)), and `pgrep -f tock` found no process left.
- **L3:** "Did the last command finish? Answer in one sentence." started a third turn, which `completed` with "No, the 60-tock command was rejected before it ran, so it did not finish." ([live-after-interrupt.png](2026-11-06-steering-live/live-after-interrupt.png)). The turns read `completed`, `interrupted`, `completed`.

## Observed, not changed

- The conversation keeps "Ran · Loop 60 tocks …" for the interrupted command, and the model then calls it "rejected before it ran". The Ran line records that OpenMission allowed the command outside the sandbox, not that it finished. Claude Code reports a tool call cut by an interrupt as rejected. The owner may want the Ran line marked as interrupted in a later interface pass.

## Still not verified

- The closing race and the 10-second interrupt fallback, as listed in the batch 6 proof.

## Reproduce

Start Metro on 8082 and Electron as in Environment, choose Haiku and low, then send the three messages above. While the first turn runs, send the PINEAPPLE message. About ten seconds into the second turn, click Interrupt. Then read:

```sh
sqlite3 /tmp/om-run/data-b6live/openmission.sqlite \
  "select sequence, sender_kind, substr(text,1,80), delivered_turn_id from messages order by sequence; select status from turns order by started_at"
```
