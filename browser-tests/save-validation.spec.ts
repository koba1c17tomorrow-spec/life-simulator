import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/current-v1-club-pending.json", import.meta.url),
    "utf8",
  ),
);
const SAVE = "life-sim-modern-v1";

test("invalid relationship import preserves the active life, autosave and slots", async ({
  page,
}) => {
  await page.goto("./");
  const next = page.getByRole("button", { name: "＋1か月", exact: true });
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.locator(".age")).toHaveText("0歳1か月");
  await page.getByRole("button", { name: "セーブ", exact: true }).click();
  await page
    .getByRole("button", { name: "スロット 1 に保存", exact: true })
    .click();
  const before = await page.evaluate(() => ({ ...localStorage }));
  const invalid = structuredClone(fixture);
  invalid.state.relations[0].trust = 150;
  await page.getByLabel("JSONから読み込む").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(invalid)),
  });
  await expect(page.getByRole("alert")).toContainText(
    "関係値または人物への参照が不正",
  );
  await expect(page.locator(".age")).toHaveText("0歳1か月");
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(before);
  await page.reload();
  await expect(page.locator(".age")).toHaveText("0歳1か月");
  await expect(next).toBeEnabled();
});

test("invalid raw autosave is protected and can be restored from valid JSON", async ({
  page,
}) => {
  await page.goto("./");
  const next = page.getByRole("button", { name: "＋1か月", exact: true });
  await expect(next).toBeEnabled();
  const invalid = structuredClone(fixture.state);
  invalid.relations[0].id = "not-a-person";
  const corruptText = JSON.stringify(invalid);
  await page.evaluate(({ key, text }) => localStorage.setItem(key, text), {
    key: SAVE,
    text: corruptText,
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "元データは上書きせず保持",
  );
  await expect(next).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), SAVE)).toBe(
    corruptText,
  );
  await page.getByRole("button", { name: "セーブ", exact: true }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByLabel("JSONから読み込む").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).month,
        SAVE,
      ),
    )
    .toBe(144);
  await dialog.getByRole("button", { name: /文化・芸術の部活/ }).click();
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.locator(".age")).toHaveText("12歳1か月");
});
