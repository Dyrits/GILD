import { Appearance, Platform } from "react-native";
import { type ColorScheme, type ColorSchemePreference, preferenceOf, schemeOf } from "./colorSchemeRules";

const storageKey = "iskios.colorScheme";

/** The preference is kept in the browser's storage, so only the web build can keep one until native builds exist. */
export const canChooseColorScheme = Platform.OS === "web" && typeof localStorage !== "undefined";

/** The system's look; a system that states none keeps the app's original dark look. */
const systemSchemeOf = (): ColorScheme => (Appearance.getColorScheme() === "light" ? "light" : "dark");

/** The owner's choice, read once at load. */
export const colorPreference: ColorSchemePreference = canChooseColorScheme
  ? preferenceOf(localStorage.getItem(storageKey))
  : "system";

/**
 * The look the whole app is drawn in. Styles are cut once when their modules load, so the look is fixed for a run and a
 * change takes effect by reloading.
 */
export const colorScheme: ColorScheme = schemeOf(colorPreference, systemSchemeOf());

const placeKey = "iskios.place";
const resumeKey = "iskios.resume";

/** Notes the page the owner is on, so the reload a change of look causes can return to it. */
export function rememberPlace(place: string): void {
  if (canChooseColorScheme) sessionStorage.setItem(placeKey, place);
}

/**
 * The page to return to after a reload for a change of look; null on any other start. Read once at load, because a
 * component's initial state may be computed more than once and must give the same page each time.
 */
export const resumedPlace: string | null = (() => {
  if (!canChooseColorScheme || sessionStorage.getItem(resumeKey) === null) return null;
  sessionStorage.removeItem(resumeKey);
  return sessionStorage.getItem(placeKey);
})();

/** Reloads the window, which is when every style is cut again, and marks the reload as one to return from. */
function reloadForColorScheme(): void {
  sessionStorage.setItem(resumeKey, "1");
  window.location.reload();
}

/** Keeps the owner's choice and reloads the window to draw it. */
export function chooseColorPreference(preference: ColorSchemePreference): void {
  if (!canChooseColorScheme) return;
  localStorage.setItem(storageKey, preference);
  reloadForColorScheme();
}

/**
 * Tells the browser the look in use, so its scrollbars and form controls match, and paints the page behind the app so
 * an overscroll shows the app's ground rather than white. Returns a stop function. While the owner follows the system,
 * a change of the system's look reloads the window.
 */
export function applyColorScheme(ground: string): () => void {
  if (!canChooseColorScheme) return () => {};
  document.documentElement.style.colorScheme = colorScheme;
  document.documentElement.style.backgroundColor = ground;
  const subscription = Appearance.addChangeListener(() => {
    if (colorPreference === "system" && schemeOf(colorPreference, systemSchemeOf()) !== colorScheme) {
      reloadForColorScheme();
    }
  });
  return () => subscription.remove();
}
