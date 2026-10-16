import { test, expect } from "@playwright/test";
test("four layers show numeric abilities and gradual qualitative discovery", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const { newGame } = await import("/life-simulator/src/engine.ts");
    const s = newGame(42); s.month = 100; s.traits = ["quickLearner"];
    localStorage.setItem("life-sim-modern-v1", JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("button", { name: "概要", exact: true }).click();
  const panel = page.getByRole("region", { name: "人物能力の4層" });
  await expect(panel).toContainText("知識 15.0");
  await expect(panel).toContainText("学習技法 0.0");
  await expect(panel).toContainText("活動を通じて判明");
  await page.getByRole("button", { name: "勉強", exact: true }).click();
  await expect(panel).toContainText("学習技法 1.2");
  await page.reload();
  await page.getByRole("button", { name: "概要", exact: true }).click();
  await expect(panel).toContainText("学習技法 1.2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
