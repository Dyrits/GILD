# Message attachments

Status: agreed on 2026-11-10 (CHG-0102); the first batch is images from the owner. Everything the owner did not decide is **provisional** until the owner reviews it.

## Problem and outcome

A message is text only, so the owner cannot show a thread a screenshot, an error dialog, or a design. The owner attaches images to a message by pasting one from the clipboard, dropping files on the message box, or choosing files, and the thread's harness reads them with the text.

## Agreed behavior

- **Attaching**: pasting an image (Ctrl or Command+V with an image on the clipboard; pasting text is unchanged), dropping files on the message box, and a file button all go through one step that adds the file. Each attached image shows as a thumbnail above the message box with a × to remove it before sending.
- **Where**: every message the owner sends: a started quest, a message in any quest or side-quest (Control included), and the first message of a side-quest the owner opens. A message may hold images alone, with no text.
- **What is accepted**: PNG, JPEG, GIF, and WebP, told by the file's first bytes and not by its name; anything else (HEIC included) is refused with the reason. At most 8 images per message and 5 MB each.
- **Reduced before it leaves the window**: a PNG, JPEG, or WebP longer than 1568 pixels on either side is scaled down to that size in the app, as Cindy and the vision documentation advise. A GIF is never changed, so a GIF over 5 MB is refused.
- **Upload first** (as OpenBot does): adding a file sends it to the service, which writes it to a draft folder and answers a card (identifier, name, type, size). The message then carries the identifiers. Removing a thumbnail erases the draft; drafts nobody sent are erased when the service starts.
- **Stored**: a sent image is kept in the service's data folder, outside every thread's working folder, with its hash. Its card stays on the message; the conversation shows a thumbnail. The bytes are fetched by identifier, never inside a conversation answer, so a refresh does not resend them.
- **What the harness receives** (probed on 2026-11-10):
  - Claude Code: the message's content is a list, the text then one base64 image block per image.
  - Codex: one `localImage` item per image, with the stored path.
  - OpenCode: one ACP `image` block per image, base64, when the agent says it takes images.
  - A steered message carries its images the same way where the harness takes steered messages.
- **Refused when the harness cannot read images**: the service refuses the message with the reason, and the message box says so and does not send. Claude Code always reads images; Codex reads them when the chosen model lists image among its input kinds; OpenCode reads them when its agent advertises it. A Companion whose support is unknown is allowed.
- **A handover** to a runner that cannot read images is refused while a message holding images still waits for the thread. A handover's replay of the conversation names an image as text ("image: name") and does not resend it.
- **Deleting** a thread or a quest erases its attached images from disk and their cards.
- **No bytes in text records**: an image is never stored in a message's text, the database, or a log line.

## Not built

- Messages between threads and results (a thread holds only a file path): the next batch.
- Files other than images (PDF, audio, video, text files).
- Taking an image the owner sent to another quest when a message moves there (Continue in, a new quest, an aside): the move carries the text only.
- Rituals.
- Pasting on a phone (native paste needs a module for it).
- A larger view of a thumbnail; sending several images' paths in the text so a thread can copy a file.
- Summarizing or describing an image for a harness that cannot read one.

## Acceptance

- Added files: signature check, limits, refusal reasons, draft discarded and swept (`attachments.test.ts`).
- A message with images reaches each adapter in its own form, on stand-ins (`harnesses.test.ts`).
- Refusal for a harness or model that cannot read images, and for a handover with images waiting.
- Deleting a thread erases its files.
- In the running app on the fake harness: paste, drop, and the file button, thumbnails and their removal, the sent message's thumbnails, the refusal ([proof](../../verification/2026-11-10-message-attachments.md)).
- Live, one image to each harness: Claude Code and Codex probed on 2026-11-10 with a one-colour image, both answered the colour; OpenCode not run live.

## Requirements

- [Respect upstream licenses](../../requirements.md): OpenBot's code is not copied (PolyForm Noncommercial); its ideas are written independently.
