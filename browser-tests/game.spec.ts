import { test as base, expect } from "@playwright/test";
const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await use(page);
    expect(errors).toEqual([]);
  },
});
const key = "life-sim-modern-v1";
async function fixture(page: any, patch: string) {
  await page.goto("./");
  await page.evaluate(
    async ({ key, patch }: { key: string; patch: string }) => {
      const engine = await import("/life-simulator/src/engine.ts");
      const s = engine.newGame(42);
      Object.assign(s, JSON.parse(patch));
      localStorage.setItem(key, JSON.stringify(s));
    },
    { key, patch },
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "＋1か月", exact: true }),
  ).toBeEnabled();
}
test("render, monthly progression, autosave and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "人生の記録", exact: true }),
  ).toBeVisible();
  const next = page.getByRole("button", { name: "＋1か月", exact: true });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.locator(".age")).toHaveText("0歳1か月");
  await page.reload();
  await expect(page.locator(".age")).toHaveText("0歳1か月");
  for (const label of [
    "概要",
    "人物",
    "進路・仕事",
    "家計・支出",
    "年表・振り返り",
    "セーブ",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("spending, finance and slot restore use actual UI", async ({ page }) => {
  await fixture(
    page,
    JSON.stringify({
      month: 300,
      stats: {
        health: 85,
        happiness: 60,
        knowledge: 40,
        sociability: 45,
        money: 200000,
      },
    }),
  );
  await page.getByRole("button", { name: "家計・支出", exact: true }).click();
  await page
    .getByRole("button", { name: "本や教材を購入", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "本や教材を購入", exact: true }),
  ).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).stats.money,
        key,
      ),
    )
    .toBe(197000);
  await page.getByRole("spinbutton", { name: "金額（円）" }).fill("10000");
  await page.getByRole("button", { name: "貯蓄", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).savings,
        key,
      ),
    )
    .toBe(10000);
  await page.getByRole("button", { name: "セーブ", exact: true }).click();
  await page
    .getByRole("button", { name: "スロット 1 に保存", exact: true })
    .click();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "＋1か月", exact: true }).click();
  if (await page.getByRole("dialog").isVisible())
    await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "スロット 1 を読込", exact: true })
    .click();
  await expect(page.locator(".age")).toHaveText("25歳0か月");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  expect((await download).suggestedFilename()).toBe("life-modern-300.json");
});
test("major decision pauses, traps keyboard focus and supports minimization", async ({
  page,
}) => {
  await fixture(page, JSON.stringify({ month: 143 }));
  await page.getByRole("button", { name: "＋1か月", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "＋1か月", exact: true }),
  ).toBeDisabled();
  const buttons = dialog.getByRole("button");
  await buttons.first().focus();
  await page.keyboard.press("Shift+Tab");
  await expect(buttons.last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: /未回答の選択肢/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /文化・芸術の部活/ }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).club, key),
    )
    .toBe("arts");
});
test("world creation, invalid import protection and ending", async ({
  page,
}) => {
  await page.goto("./");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "新しい人生", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("ワールド").selectOption("coastal");
  await dialog.getByLabel("乱数シード（空欄でランダム）").fill("123");
  await dialog
    .getByRole("button", { name: "新しい人生を始める", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "＋1か月", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).worldId,
        key,
      ),
    )
    .toBe("coastal");
  await page.getByRole("button", { name: "セーブ", exact: true }).click();
  await page.getByLabel("JSONから読み込む").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).worldId,
      key,
    ),
  ).toBe("coastal");
  await fixture(page, JSON.stringify({ month: 1199 }));
  await page.getByRole("button", { name: "＋1か月", exact: true }).click();
  await expect(page.getByRole("heading", { name: "人生の結末" })).toBeVisible();
  await page
    .getByRole("button", { name: "年表・振り返り", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "人生の振り返り" }),
  ).toBeVisible();
  await expect(page.getByText("人生を歩む", { exact: false })).toBeVisible();
});
test("corrupt automatic save is preserved until explicit recovery", async ({
  page,
}) => {
  await page.goto("./");
  await page.evaluate(
    (key) => localStorage.setItem(key, '{"version":99}'),
    key,
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "元データは上書きせず保持",
  );
  await expect(
    page.getByRole("button", { name: "＋1か月", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    '{"version":99}',
  );
});
