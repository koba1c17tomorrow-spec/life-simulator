import { test, expect } from "@playwright/test";
test("fantasy starts as a distinct world and progresses without adventure", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("./");
  await page.getByRole("button", { name: "新しい人生", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ワールド", exact: true })
    .selectOption("fantasy");
  await page
    .getByRole("combobox", { name: "種族", exact: true })
    .selectOption("elf");
  await page.getByRole("button", { name: "新しい人生を始める" }).click();
  await expect(
    page.getByRole("heading", { name: "街と工房の暮らし" }),
  ).toBeVisible();
  await expect(page.getByText(/種族：長命の民/)).toBeVisible();
  await page.getByRole("button", { name: "＋1か月", exact: true }).click();
  await expect(page.locator(".age")).toHaveText("0歳1か月");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("life-sim-modern-v1")!),
  );
  expect(saved.worldId).toBe("fantasy");
  expect(saved.fantasy.species).toBe("elf");
  expect(saved.scenarios).toBeUndefined();
  await page.reload();
  await expect(page.getByText(/種族：長命の民/)).toBeVisible();
});
for (const world of ["modern", "fantasy"])
  test(`${world}: manual scenes pause months and survive reload`, async ({
    page,
  }) => {
    await page.goto("./");
    await page.evaluate(async (world) => {
      const { newGame } = await import("/life-simulator/src/engine.ts");
      const s = newGame(42, {}, world, "human");
      s.month = 300;
      s.stats.money = 1000;
      localStorage.setItem("life-sim-modern-v1", JSON.stringify(s));
    }, world);
    await page.reload();
    await page.getByText("シナリオ（任意の活動）", { exact: true }).click();
    await page
      .getByRole("button", {
        name:
          world === "fantasy"
            ? "工房の小さな依頼を始める"
            : "仕事と家の用事を始める",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "＋1か月", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name:
          world === "fantasy" ? "道具と手順を確かめる" : "家族と予定を相談する",
        exact: true,
      })
      .click();
    await page.reload();
    await page.getByText("シナリオ（任意の活動）", { exact: true }).click();
    await expect(
      page.getByRole("button", { name: "シナリオを自動で進める", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "シナリオを自動で進める", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "＋1か月", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("life-sim-modern-v1")!),
    );
    expect(state.scenarios.active.step).toBe(2);
    expect(state.worldId).toBe(world);
  });
