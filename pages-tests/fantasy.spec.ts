import { test, expect } from "@playwright/test";
test("fantasy world rules, assets and ordinary life work from the installed offline cache", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.context().setOffline(true);
  try {
    const data = await page.evaluate(async () => {
      const root = "/life-simulator/worlds/fantasy/";
      return Promise.all(
        ["manifest.json", "events.json", "rules.json"].map(async (f) => {
          const r = await fetch(root + f);
          if (!r.ok) throw Error("offline asset missing");
          return r.json();
        }),
      );
    });
    expect(data[0].id).toBe("fantasy");
    expect(data[1].length).toBeGreaterThan(0);
    expect(data[2].economy.currency).toBe("銀貨");
    await page.getByRole("button", { name: "新しい人生", exact: true }).click();
    await page
      .getByRole("combobox", { name: "ワールド", exact: true })
      .selectOption("fantasy");
    await page
      .getByRole("combobox", { name: "種族", exact: true })
      .selectOption("elf");
    await page
      .getByRole("button", { name: "新しい人生を始める", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "街と工房の暮らし" }),
    ).toBeVisible();
    const next = page.getByRole("button", { name: "＋1か月", exact: true });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.locator(".age")).toHaveText("0歳1か月");
    const s = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("life-sim-modern-v1")!),
    );
    expect(s.worldId).toBe("fantasy");
    expect(s.fantasy.species).toBe("elf");
    expect(s.month).toBe(1);
    expect(s.scenarios).toBeUndefined();
  } finally {
    await page.context().setOffline(false);
  }
});
