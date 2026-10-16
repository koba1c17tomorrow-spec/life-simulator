import { test, expect } from "@playwright/test";
for (const world of ["modern", "coastal"]) {
  test(`${world}: focus intent survives save, pauses at a choice and executes once`, async ({
    page,
  }) => {
    await page.goto("./");
    await page.evaluate(async (world) => {
      const { newGame } = await import("/life-simulator/src/engine.ts");
      const s = newGame(42, {}, world);
      s.month = 143;
      localStorage.setItem("life-sim-modern-v1", JSON.stringify(s));
    }, world);
    await page.reload();
    const panel = page.getByRole("region", { name: "生活時間と重点行動" });
    await panel.getByLabel("次の月の重点行動").selectOption("study");
    await panel.getByRole("button", { name: "次の月の計画を設定" }).click();
    await expect(panel).toContainText("予定");
    await page.reload();
    await expect(panel).toContainText("予定");
    await page.getByRole("button", { name: "＋1か月", exact: true }).click();
    await expect(page.locator(".age")).toHaveText("12歳0か月");
    await expect(panel).toContainText("予定");
    await page.getByRole("button", { name: "文化・芸術の部活" }).click();
    await expect(panel).toContainText("実行済み");
    await expect(panel).toContainText("実行 8時間");
    await expect(
      page.getByRole("button", { name: "勉強", exact: true }),
    ).toBeDisabled();
    await page.reload();
    await expect(panel).toContainText("実行済み");
    const data = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("life-sim-modern-v1")!),
    );
    expect(data.timeBudget.activities).toHaveLength(1);
    expect(data.focusPlan.status).toBe("executed");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
