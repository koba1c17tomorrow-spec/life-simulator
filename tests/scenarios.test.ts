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

it("zero-time withdrawal stays importable and never creates a zero-hour activity", () => {
  const started = startScenario(ready(), "town-errand");
  const done = chooseScenario(started, "leave", 0);
  expect(done.scenarios!.active!.status).toBe("withdrawn");
  expect(done.timeBudget?.activities.some((a) => a.hours === 0) ?? false).toBe(
    false,
  );
  expect(importSave(exportSave(done))).toEqual(done);
});
it("modern work/home choices enforce money and public relationship conditions and apply costs once", () => {
  let s = startScenario(ready(), "work-and-home", "mother");
  s = chooseScenario(s, "consult", 0);
  expect(s.scenarios!.active!.sceneId).toBe("task");
  const poor = structuredClone(s);
  poor.stats.money = 0;
  expect(chooseScenario(poor, "shared", 1)).toBe(poor);
  const before = s.stats.money,
    done = chooseScenario(s, "shared", 1);
  const success = done.scenarios!.active!.history[1].success;
  expect(done.stats.money).toBe(before - 100 + (success ? 250 : 0));
  expect(done.scenarios!.active!.history[1].cost).toBe(100);
  expect(chooseScenario(done, "shared", 1)).toBe(done);
  expect(importSave(exportSave(done))).toEqual(done);
});
it("waiting-month passes ordinary pending and scheduled work once before scene resumption", () => {
  let s = ready();
  s.month = 215;
  s.autoChoices = true;
  s.scheduled = [
    {
      month: 216,
      text: "一度だけ届く知らせ",
      effects: [{ stat: "money", delta: 123 }],
    },
  ];
  s = startScenario(s, "town-errand");
  s.timeBudget = {
    version: 1,
    month: 215,
    allocations: { all: 720 },
    activities: [],
    overload: 0,
    legacyBaseline: false,
  };
  s = chooseScenario(s, "prepare", 0);
  const next = autoResolve(advanceMonth(importSave(exportSave(s)), []), []);
  expect(next.month).toBe(216);
  expect(next.scheduled).toHaveLength(0);
  expect(
    next.history.filter((e) => e.text === "【あの時から】一度だけ届く知らせ"),
  ).toHaveLength(1);
  expect(next.scenarios!.active!.status).toBe("running");
  expect(advanceMonth(next, [])).toBe(next);
});
it("retains prior choices when starting another run and rejects stale run IDs", () => {
  const first = autoScenario(startScenario(ready(), "town-errand"));
  const originalRun = structuredClone(first.scenarios!.active!);
  first.month += 12;
  const next = startScenario(first, "town-errand");
  expect(next.scenarios!.archive).toEqual([originalRun]);
  expect(chooseScenario(next, "prepare", 0, originalRun.id)).toBe(next);
  expect(importSave(exportSave(next))).toEqual(next);
});
it("ability and skills change outcomes, with both success and failure in a deterministic seed cohort", () => {
  const outcomes = new Set<string>();
  let changed = 0;
  for (let seed = 1; seed <= 32; seed++) {
    const s = ready();
    s.seed = seed;
    const prepared = chooseScenario(
      startScenario(s, "town-errand"),
      "prepare",
      0,
    );
    const low = chooseScenario(prepared, "explain", 1);
    outcomes.add(low.scenarios!.active!.status);
    const high = structuredClone(prepared);
    high.stats.knowledge = 100;
    high.stats.sociability = 100;
    high.capabilities!.skills.communication = 100;
    const result = chooseScenario(high, "explain", 1);
    if (result.scenarios!.active!.status !== low.scenarios!.active!.status)
      changed++;
  }
  expect(outcomes).toEqual(new Set(["completed", "failed"]));
  expect(changed).toBeGreaterThan(0);
});
