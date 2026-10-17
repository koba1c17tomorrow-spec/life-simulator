import { expect, it } from "vitest";
import { newGame, advanceMonth, autoResolve, takeAction } from "../src/engine";
import { setFantasyRole, practiceMagic } from "../src/fantasy";
import { worldRules } from "../src/worldRules";
import {
  startScenario,
  chooseScenario,
  autoScenario,
  scenarioChoices,
} from "../src/scenarios";
import { importSave, exportSave, saveSlot, loadSlot } from "../src/saves";
import { socialPresentation } from "../src/socialPresentation";
import { loadWorld } from "../src/content";
import fantasyEvents from "../public/worlds/fantasy/events.json";
import { validateEvents } from "../src/content";
const events = validateEvents(fantasyEvents);
it("uses real species, education, currency, jobs and social profiles without forced adventure", () => {
  let s = newGame(42, {}, "fantasy", "human");
  expect(s.fantasy!.species).toBe("human");
  expect(s.society!.profile).toBe("fantasy");
  expect(s.stats.money).toBe(20);
  for (let i = 0; i < 204; i++) s = advanceMonth(s, events);
  expect(s.finished).toBe(false);
  expect(s.education).toBe("working");
  expect(s.pending).toBeNull();
  expect(s.fantasy!.role).toBe("farmer");
  expect(s.monthlyIncome).toBeGreaterThan(s.monthlyExpenses);
  expect(s.scenarios).toBeUndefined();
  expect(s.fantasy!.magic).toBe(0);
  for (const role of Object.keys(worldRules("fantasy").careers)) {
    const a = advanceMonth(setFantasyRole(s, role), events);
    expect(a.fantasy!.role).toBe(role);
    expect(a.monthlyIncome).toBeGreaterThanOrEqual(30);
  }
  expect(importSave(exportSave(s))).toEqual(s);
});
it("species lifespan changes actual complete lives, with frozen NPC death clocks", () => {
  const ends: number[] = [];
  for (const species of ["human", "elf"]) {
    let s = newGame(42, {}, "fantasy", species);
    while (!s.finished && s.month < 1440) s = advanceMonth(s, []);
    expect(s.finished).toBe(true);
    ends.push(s.month);
    expect(importSave(exportSave(s))).toEqual(s);
    const dead = s.people.find((p) => !p.alive)!;
    const copy = structuredClone(dead);
    expect(advanceMonth(s, []).people.find((p) => p.id === dead.id)).toEqual(
      copy,
    );
  }
  expect(ends).toEqual([900, 1440]);
});
it("supports magic training, manual and auto crafting branches, and save continuation", () => {
  let s = newGame(42, {}, "fantasy", "human");
  s.month = 100;
  for (let i = 0; i < 3; i++) {
    s = practiceMagic(s);
    s = advanceMonth(s, []);
  }
  expect(s.fantasy!.magic).toBeGreaterThan(1);
  expect(s.fantasy!.magicHours).toBe(24);
  const started = startScenario(s, "guild-order", "mother"),
    prepared = chooseScenario(started, "tools", 0);
  expect(
    scenarioChoices(prepared).find((c) => c.choice.id === "magic")!.reason,
  ).toBe("");
  const done = chooseScenario(prepared, "magic", 1);
  expect(done.scenarios!.active!.status).toMatch(/completed|failed/);
  expect(chooseScenario(importSave(exportSave(prepared)), "magic", 1)).toEqual(
    done,
  );
  expect(autoScenario(importSave(exportSave(started)))).toEqual(
    autoScenario(started),
  );
  expect(done.scenarios!.inventory["borrowed-tools"]).toBeUndefined();
  expect(done.seed).toBe(prepared.seed);
  expect(chooseScenario(done, "magic", 1)).toBe(done);
});
it("fantasy uses its own small action costs and maintains independent save slots", () => {
  const s = newGame(1, {}, "fantasy");
  s.month = 200;
  const a = takeAction(s, "work"),
    b = takeAction(s, "study", 3);
  expect(a.stats.money - s.stats.money).toBe(3);
  expect(s.stats.money - b.stats.money).toBe(2);
  const data = new Map<string, string>(),
    storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        data.set(k, v);
      },
    };
  saveSlot(storage, 1, a);
  saveSlot(storage, 2, b);
  saveSlot(storage, 3, newGame(42, {}, "modern"));
  expect(loadSlot(storage, 1)).toEqual(a);
  expect(loadSlot(storage, 2)).toEqual(b);
  expect(loadSlot(storage, 3).worldId).toBe("modern");
});
it("private fantasy NPC goals and unobserved society remain absent from the public projection", () => {
  let s = newGame(42, {}, "fantasy");
  for (let i = 0; i < 180; i++) s = advanceMonth(s, events);
  expect(
    s.worldHistory!.events.some((e) => e.kind.startsWith("society.")),
  ).toBe(true);
  expect(socialPresentation(s).events).toEqual([]);
  expect(socialPresentation(s).axes.every((a) => a.state === "未確認")).toBe(
    true,
  );
  const restored = importSave(exportSave(s));
  expect(advanceMonth(restored, events)).toEqual(advanceMonth(s, events));
});
it("rejects future fantasy versions, missing world state, unknown species and magic outside bounds", () => {
  const s = newGame(42, {}, "fantasy");
  for (const f of [
    undefined,
    { ...s.fantasy, version: 2 },
    { ...s.fantasy, species: "unknown" },
    { ...s.fantasy, magic: 101 },
  ])
    expect(() => importSave(JSON.stringify({ ...s, fantasy: f }))).toThrow();
});
