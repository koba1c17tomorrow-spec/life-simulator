import { test, expect } from "@playwright/test";
test("NPC private emotion changes do not change normal relationship UI", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(async () => {
    const { newGame, meetPerson } = await import("/life-simulator/src/engine.ts");
    const s = meetPerson(newGame(42),"mother");
    localStorage.setItem("life-sim-modern-v1",JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("button",{name:"人物",exact:true}).click();
  const mother = page.locator("article.person").filter({has:page.getByText("母",{exact:true})});
  await expect(mother).toContainText("あなたの気持ち");
  await expect(mother).toContainText("観測した応対");
  const before = await mother.innerText();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("life-sim-modern-v1")!);
    const e = s.relationshipModel.edges.find((e: any) => e.from === "mother" && e.to === "player");
    e.liking=1; e.trust=2; e.closeness=3; e.respect=4; e.attraction=99;
    localStorage.setItem("life-sim-modern-v1",JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("button",{name:"人物",exact:true}).click();
  expect(await mother.innerText()).toBe(before);
});
