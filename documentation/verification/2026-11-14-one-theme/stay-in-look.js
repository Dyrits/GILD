// Run with an attached Playwright CLI session on a throwaway Iskios:
// playwright-cli -s=one-theme run-code --filename=documentation/verification/2026-11-14-one-theme/stay-in-look.js
async (page) => {
  await page.getByRole("button", { name: "Workshop", exact: true }).click();
  await page.getByRole("button", { name: "Look and feel", exact: true }).click();
  const previous = await page.evaluate(() => localStorage.getItem("iskios.theme"));
  const chosen = previous === "one" ? "Gild" : "One";
  await Promise.all([
    page.waitForEvent("domcontentloaded"),
    page.getByRole("radiogroup", { name: "Theme", exact: true }).getByRole("radio", { name: chosen, exact: true }).click(),
  ]);
  await page.getByRole("radiogroup", { name: "Theme", exact: true }).waitFor({ timeout: 5000 });
  const selected = page.getByRole("radiogroup", { name: "Theme", exact: true }).getByRole("radio", {
    name: chosen,
    exact: true,
  });
  const stored = await page.evaluate(() => localStorage.getItem("iskios.theme"));
  if (!(await selected.isVisible()) || stored !== chosen.toLowerCase()) {
    throw new Error("The theme reload did not keep the selected theme in Look and feel.");
  }
}
