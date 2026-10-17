import { test, expect } from "@playwright/test";
for (const world of ["modern", "coastal"])
  test(`${world}: society observations stay private until read and survive reload`, async ({
    page,
  }) => {
    await page.goto("./");
    await page.evaluate(async (world) => {
      const { newGame } = await import("/life-simulator/src/engine.ts");
      const { recordWorldEvent } = await import(
        "/life-simulator/src/worldHistory.ts"
      );
      const s = newGame(42, {}, world);
      s.month = 300;
      recordWorldEvent(s, {
        month: 295,
        kind: "society.supply-delay",
        personIds: [],
        visibility: "public",
        data: { text: "確認可能な物流の知らせ", effects: { economy: -2 } },
      });
      recordWorldEvent(s, {
        month: 296,
        kind: "society.council-review",
        personIds: [],
        visibility: "private",
        data: { text: "秘密の評議会情報" },
      });
      localStorage.setItem("life-sim-modern-v1", JSON.stringify(s));
    }, world);
    await page.reload();
    await page.getByText("社会の様子・知らせ", { exact: true }).click();
    const panel = page.locator(".social-panel");
    await expect(panel).toContainText("まだ確認していません");
    await expect(panel).not.toContainText("確認可能な物流の知らせ");
    await page
      .getByRole("button", { name: "知らせを確認（2時間）", exact: true })
      .click();
    await expect(panel).toContainText("確認可能な物流の知らせ");
    await expect(panel).toContainText("発生：295か月目 ／ 知った時：300か月目");
    await expect(page.locator("body")).not.toContainText("秘密の評議会情報");
    await expect(
      page.getByRole("button", { name: "知らせを確認（2時間）", exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.reload();
    await page.getByText("社会の様子・知らせ", { exact: true }).click();
    await expect(panel).toContainText("確認可能な物流の知らせ");
    await expect(panel).not.toContainText("秘密の評議会情報");
  });
