import { test, expect } from "@playwright/test";
for (const world of ["modern", "coastal"]) {
  test(`${world}: deceased ages stay fixed and legacy dates remain unknown`, async ({
    page,
  }) => {
    await page.goto("./");
    await page.evaluate(async (world) => {
      const { newGame } = await import("/life-simulator/src/engine.ts");
      const s = newGame(42, {}, world);
      s.month = 120;
      s.autoChoices = true;
      s.people[0].alive = false;
      s.people[0].deathMonth = 108;
      s.people[1].alive = false;
      localStorage.setItem("life-sim-modern-v1", JSON.stringify(s));
    }, world);
    await page.reload();
    const next = page.getByRole("button", { name: "＋1か月", exact: true });
    await expect(next).toBeEnabled();
    await page.getByRole("button", { name: "人物", exact: true }).click();
    const mother = page
      .locator("article.person")
      .filter({ has: page.getByText("母", { exact: true }) });
    const father = page
      .locator("article.person")
      .filter({ has: page.getByText("父", { exact: true }) });
    await expect(mother).toContainText("37歳");
    await expect(father).toContainText("死亡時年齢不明");
    for (let i = 1; i <= 12; i++) {
      await next.click();
      await expect(page.locator(".age")).toHaveText(
        `${Math.floor((120 + i) / 12)}歳${(120 + i) % 12}か月`,
      );
    }
    await expect(mother).toContainText("37歳");
    await expect(father).toContainText("死亡時年齢不明");
    await page.reload();
    await expect(next).toBeEnabled();
    await page.getByRole("button", { name: "人物", exact: true }).click();
    await expect(mother).toContainText("37歳");
    await expect(father).toContainText("死亡時年齢不明");
  });
}
