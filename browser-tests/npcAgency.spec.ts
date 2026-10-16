import {test,expect} from "@playwright/test";
test("private NPC work and goals do not leak through normal profile and journal",async({page})=>{
  await page.goto("./");
  await page.evaluate(async()=>{
    const {newGame}=await import("/life-simulator/src/engine.ts");
    const {prepareNpcAgency}=await import("/life-simulator/src/npcAgency.ts");
    const {recordNpcFact,npcFact}=await import("/life-simulator/src/npcEvents.ts");
    const s=newGame(42);prepareNpcAgency(s);
    s.people[0].occupation="unemployed";
    recordNpcFact(s,"非公開の仕事変更",npcFact("npc.employment",["mother"],{occupation:"unemployed"}));
    recordNpcFact(s,"非公開の生活目標",npcFact("npc.goal",["mother"],{goal:"health",disclosable:false}));
    localStorage.setItem("life-sim-modern-v1",JSON.stringify(s));
  });
  await page.reload();
  await expect(page.locator(".feed")).not.toContainText("非公開の");
  await page.getByRole("button",{name:"人物",exact:true}).click();
  const mother=page.locator("article.person").filter({has:page.getByText("母",{exact:true})});
  await expect(mother).toContainText("employed");await expect(mother).not.toContainText("unemployed");
  await mother.getByRole("button",{name:"相談する"}).click();
  await expect(mother).toContainText("unemployed");
  await expect(page.locator(".feed")).not.toContainText("非公開の生活目標");
});
