// Run after stay-in-look.js in an attached Playwright CLI session on a throwaway Iskios.
async (page) => {
  const theme = () => page.getByRole("radiogroup", { name: "Theme", exact: true });
  const appearance = () => page.getByRole("radiogroup", { name: "Appearance", exact: true });
  await page.getByRole("button", { name: "Workshop", exact: true }).click();
  await page.getByRole("button", { name: "Look and feel", exact: true }).click();
  if ((await page.evaluate(() => localStorage.getItem("iskios.theme"))) !== "one") {
    await Promise.all([
      page.waitForEvent("domcontentloaded"),
      theme().getByRole("radio", { name: "One", exact: true }).click(),
    ]);
    await theme().waitFor();
  }
  for (const [label, scheme, accent, ground] of [
    ["Dark", "dark", "rgb(116, 173, 232)", "rgb(59, 65, 77)"],
    ["Light", "light", "rgb(47, 90, 243)", "rgb(220, 220, 221)"],
  ]) {
    await Promise.all([
      page.waitForEvent("domcontentloaded"),
      appearance().getByRole("radio", { name: label, exact: true }).click(),
    ]);
    await theme().waitFor({ timeout: 5000 });
    const actual = await page.evaluate(() => ({
      ground: document.documentElement.style.backgroundColor,
      scheme: document.documentElement.style.colorScheme,
      theme: localStorage.getItem("iskios.theme"),
    }));
    const selected = await theme().getByRole("radio", { name: "One", exact: true }).evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    if (actual.theme !== "one" || actual.scheme !== scheme || actual.ground !== ground || selected !== accent) {
      throw new Error(`One ${scheme} did not survive the appearance reload: ${JSON.stringify(actual)}`);
    }
    await page.screenshot({ path: `documentation/verification/2026-11-14-one-theme/${scheme}-look.png` });
    await page.getByRole("button", { name: "Guild Hall", exact: true }).click();
    await page.screenshot({ path: `documentation/verification/2026-11-14-one-theme/${scheme}-hall.png` });
    await page.getByRole("button", { name: "Workshop", exact: true }).click();
    await page.getByRole("button", { name: "Look and feel", exact: true }).click();
  }
  await page.emulateMedia({ colorScheme: "light" });
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    appearance().getByRole("radio", { name: "System", exact: true }).click(),
  ]);
  await theme().waitFor();
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    page.emulateMedia({ colorScheme: "dark" }),
  ]);
  await theme().waitFor();
  const system = await page.evaluate(() => ({
    preference: localStorage.getItem("iskios.colorScheme"),
    scheme: document.documentElement.style.colorScheme,
    theme: localStorage.getItem("iskios.theme"),
  }));
  if (system.preference !== "system" || system.scheme !== "dark" || system.theme !== "one") {
    throw new Error(`One did not follow the system's change to dark: ${JSON.stringify(system)}`);
  }
}
