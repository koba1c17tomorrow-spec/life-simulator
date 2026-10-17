import { expect, it } from "vitest";
import {
  newGame,
  advanceMonth,
  autoResolve,
  normalizeGameState,
} from "../src/engine";
import {
  startScenario,
  chooseScenario,
  autoScenario,
  withdrawScenario,
  scenarioChoices,
} from "../src/scenarios";
import { remainingHours } from "../src/timeBudget";
import { importSave, exportSave } from "../src/saves";
import fixture from "./fixtures/current-v1-club-pending.json";
const ready = () => {
  const s = newGame(7919);
  s.month = 300;
  s.stats.money = 10000;
  return s;
};
it("keeps old saves without invented scenario state and rejects a pending start", () => {
  const s = importSave(JSON.stringify(fixture));
  expect(s.scenarios).toBeUndefined();
  expect(startScenario(s, "town-errand")).toBe(s);
});
it("pauses ordinary months and uses isolated RNG, exactly-once hours and skill gains", () => {
  const original = ready(),
    s = startScenario(original, "town-errand", "mother");
  expect(original.scenarios).toBeUndefined();
  expect(advanceMonth(s, [])).toBe(s);
  const hours = remainingHours(s),
    seed = s.seed;
  const next = chooseScenario(s, "prepare", 0);
  expect(next.seed).toBe(seed);
  expect(remainingHours(next)).toBe(hours - 4);
  expect(next.scenarios!.inventory["errand-note"]).toBe(1);
  expect(chooseScenario(next, "prepare", 0)).toBe(next);
  expect(chooseScenario(next, "explain", 0)).toBe(next);
  const done = chooseScenario(next, "explain", 1);
  expect(remainingHours(done)).toBe(hours - 12);
  expect(done.scenarios!.active!.status).toMatch(/completed|failed/);
  expect(chooseScenario(done, "explain", 1)).toBe(done);
  expect(done.worldHistory!.events.at(-1)!.pcKnowledge?.source).toBe("direct");
});
it("saved manual and automated scenes produce identical states", () => {
  const s = startScenario(ready(), "town-errand");
  const prepared = chooseScenario(s, "prepare", 0);
  expect(autoScenario(importSave(exportSave(prepared)))).toEqual(
    autoScenario(prepared),
  );
  expect(autoScenario(s)).toEqual(chooseScenario(prepared, "explain", 1));
});
it("waits for a month without partial charging and resumes after scheduled/pending work exactly once", () => {
  let s = startScenario(ready(), "town-errand");
  s.timeBudget = {
    version: 1,
    month: 300,
    allocations: { all: 720 },
    activities: [],
    overload: 0,
    legacyBaseline: false,
  };
  const waiting = chooseScenario(s, "prepare", 0);
  expect(waiting.scenarios!.active!.status).toBe("waiting-month");
  expect(waiting.scenarios!.active!.step).toBe(0);
  expect(waiting.stats.money).toBe(s.stats.money);
  const saved = importSave(exportSave(waiting));
  saved.autoChoices = true;
  const next = autoResolve(advanceMonth(saved, []), []);
  expect(next.month).toBe(301);
  expect(next.scenarios!.active!.status).toBe("running");
  expect(next.scenarios!.active!.history).toEqual([]);
  expect(advanceMonth(next, [])).toBe(next);
  expect(chooseScenario(next, "prepare", 0).scenarios!.active!.step).toBe(1);
});
it("conditions, withdrawal, cooldown and corrupt state are enforced", () => {
  let s = startScenario(ready(), "town-errand");
  s = chooseScenario(s, "prepare", 0);
  delete s.scenarios!.inventory["errand-note"];
  expect(
    scenarioChoices(s).find((c) => c.choice.id === "explain")!.reason,
  ).toContain("持ち物");
  s = withdrawScenario(s);
  expect(s.scenarios!.active!.status).toBe("withdrawn");
  expect(startScenario(s, "town-errand")).toBe(s);
  expect(() =>
    normalizeGameState({ ...s, scenarios: { ...s.scenarios, version: 2 } }),
  ).toThrow();
  expect(() =>
    normalizeGameState({
      ...s,
      scenarios: {
        ...s.scenarios,
        active: { ...s.scenarios!.active, sceneId: "missing" },
      },
    }),
  ).toThrow();
});
