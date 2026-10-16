import { test, expect } from "@playwright/test";
for (const world of ["modern", "coastal"]) {
  test(`${world}: a remote NPC death stays in saved world facts, not the player journal`, async ({
    page,
  }) => {
    await page.goto("./");
    await page.evaluate(async (world) => {
      const { newGame } = await import("/life-simulator/src/engine.ts");
      const s = newGame(42, {}, world);
      s.month = 300;
      s.autoChoices = true;
      s.people.push({
        id: "remote",
        name: "遠い知人",
        kind: "friend",
        birthMonth: -1200,
        alive: true,
        movedAway: true,
      });
      s.relations.push({
        id: "remote",
        closeness: 5,
        trust: 5,
        lastContactMonth: 0,
      });
      localStorage.setItem("life-sim-modern-v1", JSON.stringify(s));
    }, world);
    await page.reload();
    const next = page.getByRole("button", { name: "＋1か月", exact: true });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(page.locator(".age")).toHaveText("25歳1か月");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const s = JSON.parse(localStorage.getItem("life-sim-modern-v1")!);
          return s.worldHistory.events.some(
            (e: { kind: string; personIds: string[]; pcKnowledge?: unknown }) =>
              e.kind === "npc.death" &&
              e.personIds.includes("remote") &&
              !e.pcKnowledge,
          );
        }),
      )
      .toBe(true);
    await expect(page.locator(".entries")).not.toContainText("遠い知人");
    await expect(page.locator(".entries")).toContainText("この世界に生まれた");
    await page.reload();
    await expect(next).toBeEnabled();
    await expect(page.locator(".entries")).not.toContainText("遠い知人");
  });
}
