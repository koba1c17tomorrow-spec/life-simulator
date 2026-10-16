import { test, expect } from "@playwright/test";
import { updateSite } from "./update-site";
const SAVE = "life-sim-modern-v1";

test.beforeEach(({ browserName }) => {
  // Chromium exposes deterministic SW update inspection in Playwright.
  // WebKit's regular Pages/UI/offline coverage is in pages.spec.ts.
  test.skip(browserName !== "chromium", "SW update inspection uses Chromium");
});

async function ready(page: any) {
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
}
async function checkForUpdate(page: any) {
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.getRegistration())!.update();
  });
  await expect(
    page.getByRole("button", { name: "保存して更新", exact: true }),
  ).toBeVisible();
}

test("a new deployment waits, then saves the latest game before updating", async ({
  page,
}) => {
  const site = await updateSite();
  try {
    await page.goto(site.url);
    const next = page.getByRole("button", { name: "＋1か月", exact: true });
    await expect(next).toBeEnabled();
    await ready(page);
    await next.tap();
    await expect(page.locator(".age")).toHaveText("0歳1か月");
    site.publish();
    await checkForUpdate(page);
    expect(
      await page.evaluate(() => !!navigator.serviceWorker.controller),
    ).toBe(true);
    await expect(page.locator(".age")).toHaveText("0歳1か月");
    await next.tap();
    await expect(page.locator(".age")).toHaveText("0歳2か月");
    await Promise.all([
      page.waitForEvent("load"),
      page.getByRole("button", { name: "保存して更新", exact: true }).click(),
    ]);
    await expect(next).toBeEnabled();
    await expect(page.locator(".age")).toHaveText("0歳2か月");
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).month,
        SAVE,
      ),
    ).toBe(2);
  } finally {
    await site.close();
  }
});

test("updating cannot overwrite a corrupt protected save", async ({ page }) => {
  const site = await updateSite();
  try {
    await page.goto(site.url);
    await expect(
      page.getByRole("button", { name: "＋1か月", exact: true }),
    ).toBeEnabled();
    await ready(page);
    await page.evaluate(
      (key) => localStorage.setItem(key, '{"version":99}'),
      SAVE,
    );
    await page.reload();
    await expect(page.getByRole("alert")).toContainText(
      "元データは上書きせず保持",
    );
    site.publish();
    await checkForUpdate(page);
    await page
      .getByRole("button", { name: "保存して更新", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("元の保存データを保護");
    expect(await page.evaluate((key) => localStorage.getItem(key), SAVE)).toBe(
      '{"version":99}',
    );
    expect(
      await page.evaluate(
        async () =>
          !!(await navigator.serviceWorker.getRegistration())?.waiting,
      ),
    ).toBe(true);
  } finally {
    await site.close();
  }
});
