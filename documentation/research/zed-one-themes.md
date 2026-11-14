# Zed One theme colors

Read on 2026-11-14 for the owner's request to add a One theme with light and dark looks.

## Sources

- Zed Industries, [`assets/themes/one/one.json`](https://github.com/zed-industries/zed/blob/a3f6ef252b6de19d22a1223952fc335253163642/assets/themes/one/one.json), pinned to commit `a3f6ef252b6de19d22a1223952fc335253163642`. It declares the family "One", its author "Zed Industries", and the variants "One Dark" and "One Light".
- The theme's own [`assets/themes/one/LICENSE`](https://github.com/zed-industries/zed/blob/a3f6ef252b6de19d22a1223952fc335253163642/assets/themes/one/LICENSE), MIT, Copyright (c) 2014 GitHub Inc. The complete notice is kept at `apps/desktop/assets/one.LICENSE` and included by `apps/desktop/electron-builder.yml`.

No Delta source was read or copied. No authoritative public source for a separate Delta One palette was found; the implementation uses Zed's published version.

## Mapping into Iskios

The [implementation](../../apps/app/src/foundation/onePalettes.ts) uses the existing `Palette` tokens rather than adding component-specific colors.
Opaque source colors drop their trailing `ff`.

| Iskios tokens | Zed source key | One Dark | One Light |
| --- | --- | --- | --- |
| `page`, `canvas` | `editor.background` | `#282c33` | `#fafafa` |
| `surface`, `frame`, `sidebar`, `bubble` | `surface.background`, `panel.background` | `#2f343e` | `#ebebec` |
| `ground` | `background` | `#3b414d` | `#dcdcdd` |
| `text`, `highlight` | `text` | `#dce0e5` | `#242529` |
| `textMuted`, `onGround` | `text.muted` | `#a9afbc` | `#58585a` |
| `textSecondary` | `editor.foreground` (dark), `text.muted` (light) | `#acb2be` | `#58585a` |
| `placeholder`, `textDim` | `text.placeholder` | `#878a98` | `#7e8086` |
| `border` | `border.variant` | `#363c46` | `#dfdfe0` |
| `borderStrong`, `edge` | `border` | `#464b57` | `#c9c9ca` |
| `control` | `element.background` | `#2e343e` | `#ebebec` |
| `controlHover` | `element.hover` | `#363c46` | `#dfdfe0` |
| `controlActive` | `element.active` | `#454a56` | `#cacaca` |
| `accent`, `accentText` | `text.accent` (dark), `terminal.ansi.blue` (light) | `#74ade8` | `#2f5af3` |
| `danger` | `error` | `#d07277` | `#d36151` |
| `success` | `success` | `#a1c181` | `#669f59` |
| `warning` | `warning` | `#dec184` | `#a48819` |
| `violet` | `terminal.ansi.bright_magenta` (dark), `terminal.ansi.magenta` (light) | `#d398eb` | `#950095` |
| `terminal` | `terminal.background` | `#282c34` | `#fafafa` |

### Adaptations

- Small links and buttons need more contrast than One Light's `text.accent` (`#5c78e2`), which has a 3.84:1 ratio against `#fafafa`. Zed's terminal blue (`#2f5af3`) gives 5.19:1, so it is the light accent. The original UI accent remains in the tinted user bubble, composited from the primary player's selection.
- Dark soft backgrounds are source `info.background`, `error.background`, `success.background`, and `warning.background` alpha-composited over `editor.background`, so the same token stays opaque wherever it is reused. The user bubbles use primary-player `selection` composited over the editor. Dark `violetSoft` uses the keyword hue at the same `1a` alpha; light uses `hint.background`.
- Readable state ink uses source bright terminal red (`#ea858b`) in the dark look, dim terminal red (`#9c2b26`) and dim terminal green (`#2b6927`) in the light look. Light warning ink (`#806a14`) is the warning hue darkened by 20%; Zed has no sufficiently dark warning text token.
- The existing app terminal still maps the shared palette to xterm, as it does for other themes; this does not introduce a separate full Zed ANSI/syntax highlighter.
- These adaptations are covered by the existing palette tests, extended to require 4.5:1 for One's accent button, small accent/muted text, messages on tints, and state labels. Main text retains the existing 7:1 threshold.
