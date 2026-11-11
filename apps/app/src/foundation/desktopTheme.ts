import type { DesktopBridge } from "./desktopBridge";
import type { Theme } from "./themeRules";

/**
 * Gives the Dock and the window the icon of the theme in use. The icon is decoration: when the desktop app cannot set
 * it, the theme stays as it is and nothing is shown. Without a desktop app (a browser), there is nothing to give it to.
 */
export async function syncDesktopTheme(
  bridge: Pick<DesktopBridge, "setTheme"> | undefined,
  theme: Theme,
): Promise<void> {
  try {
    await bridge?.setTheme(theme);
  } catch {
    // The Dock keeps the icon it had.
  }
}
