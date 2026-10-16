import { test as base, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("dialog", (dialog) => dialog.accept());
    await use(page);
    expect(errors).toEqual([]);
  },
});
const SAVE = "life-sim-modern-v1";
const nextMonth = (page: any) =>
  page.getByRole("button", { name: "＋1か月", exact: true });

// These tests use only the compiled site, never Vite's /src imports.
test("Pages metadata, world JSON and home-screen icons resolve inside the subpath", async ({
  page,
  request,
}) => {
  await page.goto("./");
  await expect(nextMonth(page)).toBeEnabled();
  const manifestURL = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  expect(manifestURL).toBe("/life-simulator/manifest.webmanifest");
  const response = await request.get(manifestURL!);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.start_url).toBe("/life-simulator/");
  expect(manifest.scope).toBe("/life-simulator/");
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, response.url());
    expect(url.pathname).toMatch(/^\/life-simulator\/icons\//);
    const image = await request.get(url.href);
    expect(image.ok()).toBe(true);
    const png = await image.body();
    const expected = Number(icon.sizes.split("x")[0]);
    expect(png.readUInt32BE(16)).toBe(expected);
    expect(png.readUInt32BE(20)).toBe(expected);
  }
  const appleURL = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  expect(appleURL).toBe("/life-simulator/icons/apple-touch-icon.png");
  expect((await request.get(appleURL!)).ok()).toBe(true);
  for (const id of ["modern", "coastal"]) {
    const world = await request.get(
      `/life-simulator/worlds/${id}/manifest.json`,
    );
    expect(world.ok()).toBe(true);
    const data = await world.json();
    const events = await request.get(
      `/life-simulator/worlds/${id}/${data.events}`,
    );
    expect(events.ok()).toBe(true);
    expect((await events.json()).length).toBeGreaterThan(50);
  }
});

test("touch play, save slots, JSON export/import, reload and world switch survive Pages hosting", async ({
  page,
}) => {
  await page.goto("./");
  await expect(nextMonth(page)).toBeEnabled();
  await nextMonth(page).tap();
  await expect(page.locator(".age")).toHaveText("0歳1か月");
  await page.getByRole("button", { name: "セーブ", exact: true }).click();
  await page
    .getByRole("button", { name: "スロット 1 に保存", exact: true })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const download = await downloadEvent;
  const backup = await readFile((await download.path())!);
  expect(JSON.parse(backup.toString()).state.month).toBe(1);
  await nextMonth(page).tap();
  await expect(page.locator(".age")).toHaveText("0歳2か月");
  await page
    .getByRole("button", { name: "スロット 1 を読込", exact: true })
    .click();
  await expect(page.locator(".age")).toHaveText("0歳1か月");
  await nextMonth(page).tap();
  await expect(page.locator(".age")).toHaveText("0歳2か月");
  await page
    .getByLabel("JSONから読み込む")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: backup,
    });
  await expect(page.locator(".age")).toHaveText("0歳1か月");
  await page.reload();
  await expect(page.locator(".age")).toHaveText("0歳1か月");
  for (const tab of [
    "概要",
    "人物",
    "進路・仕事",
    "家計・支出",
    "年表・振り返り",
    "セーブ",
  ]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "新しい人生", exact: true }).click();
  await page.getByLabel("ワールド").selectOption("coastal");
  await page
    .getByRole("button", { name: "新しい人生を始める", exact: true })
    .click();
  await expect(nextMonth(page)).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).worldId,
        SAVE,
      ),
    )
    .toBe("coastal");
  await nextMonth(page).tap();
  await expect(page.locator(".age")).toHaveText("0歳1か月");
});

test("installed cache supports offline reload, play and switching worlds without erasing saves", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await expect(nextMonth(page)).toBeEnabled();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await nextMonth(page).tap();
  await expect(page.locator(".age")).toHaveText("0歳1か月");
  try {
    await context.setOffline(true);
    await page.reload();
    await expect(nextMonth(page)).toBeEnabled();
    await expect(page.locator(".age")).toHaveText("0歳1か月");
    await nextMonth(page).tap();
    await expect(page.locator(".age")).toHaveText("0歳2か月");
    await page.getByRole("button", { name: "新しい人生", exact: true }).click();
    await page.getByLabel("ワールド").selectOption("coastal");
    await page
      .getByRole("button", { name: "新しい人生を始める", exact: true })
      .click();
    await expect(nextMonth(page)).toBeEnabled();
    await nextMonth(page).tap();
    await expect(page.locator(".age")).toHaveText("0歳1か月");
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
});
