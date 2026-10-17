import { expect, it } from "vitest";
import fixture from "./fixtures/current-v1-club-pending.json";
import {
  newGame,
  takeAction,
  advanceMonth,
  choose,
  autoResolve,
  normalizeGameState,
  meetPerson,
} from "../src/engine";
import {
  actionHours,
  actionReason,
  budgetFor,
  chargeTime,
  planFocus,
  remainingHours,
} from "../src/timeBudget";
import { spend, PURCHASES, purchaseReason } from "../src/economy";
it("unifies obligations, discretionary action and separate purchase quota", () => {
  let s = newGame(42);
  s.month = 300;
  s.education = "working";
  s.career = "office";
  s.stats.money = 100000;
  const start = remainingHours(s);
  expect(start).toBe(176);
  s = takeAction(s, "study");
  expect(remainingHours(s)).toBe(start - 8);
  expect(takeAction(s, "rest")).toEqual(s);
  expect(meetPerson(s, "mother")).toEqual(s);
  s = spend(s, "books");
  expect(remainingHours(s)).toBe(start - 10);
  expect(spend(s, "books")).toEqual(s);
  expect(s.timeBudget!.activities.map((a) => a.hours)).toEqual([8, 2]);
});
it("intensity trades time and money for effect, checking conditions before any change", () => {
  const s = newGame(42);
  s.month = 100;
  s.stats.money = 1000;
  s.traits = [];
  const low = takeAction(s, "study", 1);
  const high = takeAction(s, "study", 3);
  expect(high.stats.knowledge - s.stats.knowledge).toBe(
    2 * (low.stats.knowledge - s.stats.knowledge),
  );
  expect(high.stats.money).toBe(0);
  expect(high.stress).toBe(s.stress + 3);
  expect(remainingHours(high)).toBe(remainingHours(s) - 32);
  s.stats.money = 999;
  expect(actionReason(s, "study", 3)).toContain("所持金");
  expect(takeAction(s, "study", 3)).toEqual(s);
  s.stats.money = 1000;
  s.stats.health = 39;
  expect(actionReason(s, "study", 3)).toContain("健康");
  expect(takeAction(s, "study", 3)).toEqual(s);
});
it("accepts exact time boundary and rejects competing activity without mutation", () => {
  const s = newGame();
  s.month = 100;
  s.timeBudget = budgetFor(s);
  chargeTime(s, "既存活動", remainingHours(s) - 8);
  const result = takeAction(s, "rest");
  expect(remainingHours(result)).toBe(0);
  expect(
    purchaseReason(result, PURCHASES.find((p) => p.id === "books")!),
  ).toContain("時間");
  chargeTime(s, "追加義務", 1);
  expect(actionReason(s, "rest")).toContain("時間");
  expect(takeAction(s, "rest")).toEqual(s);
});
it("waits for school choice, saves intent, resumes once and resets only at next month", () => {
  const s = newGame(42);
  s.month = 143;
  const plan = planFocus(s, "study", 1);
  const paused = advanceMonth(plan, []);
  expect(paused.month).toBe(144);
  expect(paused.pending).not.toBeNull();
  expect(paused.focusPlan!.status).toBe("planned");
  expect(paused.timeBudget!.activities).toEqual([]);
  expect(advanceMonth(paused, [])).toEqual(paused);
  const resumed = choose(normalizeGameState(paused), 0, []);
  expect(resumed).toEqual(choose(paused, 0, []));
  expect(resumed.focusPlan!.status).toBe("executed");
  expect(resumed.focusPlan!.actualHours).toBe(8);
  expect(resumed.timeBudget!.activities).toHaveLength(1);
  expect(takeAction(resumed, "study")).toEqual(resumed);
  const next = advanceMonth(resumed, []);
  expect(next.month).toBe(145);
  expect(next.timeBudget!.activities).toEqual([]);
});
it("events and obligations can interrupt intentions without charging action costs", () => {
  const s = newGame(42);
  s.month = 143;
  s.stats.money = 1000;
  s.scheduled = [
    {
      month: 144,
      text: "臨時の支出",
      effects: [{ stat: "money", delta: -1000 }],
    },
  ];
  const paused = advanceMonth(planFocus(s, "study", 3), []);
  expect(paused.stats.money).toBe(0);
  const result = choose(paused, 0, []);
  expect(result.focusPlan!.status).toBe("blocked");
  expect(result.focusPlan!.reason).toContain("所持金");
  expect(result.timeBudget!.activities).toEqual([]);
  const busy = newGame();
  busy.month = 300;
  busy.education = "university";
  busy.career = "office";
  busy.children = 4;
  busy.illness = "cold";
  busy.stress = 85;
  expect(remainingHours(busy)).toBe(0);
  expect(budgetFor(busy).overload).toBeGreaterThan(0);
  expect(takeAction(busy, "rest")).toEqual(busy);
});
it("keeps legacy pending state intact and rejects overspending/corrupt time extensions", () => {
  expect(normalizeGameState(fixture.state)).toEqual(fixture.state);
  const old = normalizeGameState(fixture.state);
  const resumed = choose(old, 0, []);
  expect(resumed.month).toBe(144);
  const s = newGame();
  s.timeBudget = budgetFor(s);
  s.timeBudget.activities = [{ kind: "bad", hours: 721 }];
  expect(() => normalizeGameState(s)).toThrow();
  const plan = planFocus(newGame(), "rest", 1);
  plan.focusPlan!.actualHours = 8;
  expect(() => normalizeGameState(plan)).toThrow();
});
it.each(["modern", "coastal"])(
  "preserves planned focus and consumption across save/replay in %s",
  (world) => {
    let a = newGame(42, {}, world);
    a.month = 300;
    a.education = "working";
    a.autoChoices = true;
    a.stats.money = 100000;
    a = planFocus(a, "study", 2);
    let b = normalizeGameState(a);
    for (let i = 0; i < 12; i++) {
      a = autoResolve(advanceMonth(a, []), []);
      b = autoResolve(advanceMonth(b, []), []);
      expect(a).toEqual(b);
      expect(remainingHours(a)).toBeGreaterThanOrEqual(0);
      a = planFocus(a, "rest", 3);
      b = normalizeGameState(planFocus(b, "rest", 3));
    }
  },
);
it("does not reclaim already reserved time after switching obligations", () => {
  const s = newGame();
  s.month = 300;
  s.career = "office";
  s.timeBudget = budgetFor(s);
  const before = remainingHours(s);
  s.career = "none";
  expect(remainingHours(s)).toBe(before);
});

it("interrupts a planned focus on death without applying time or effects", () => {
  const s = newGame(42);
  s.month = 1199;
  s.education = "working";
  const result = advanceMonth(planFocus(s, "rest", 3), []);
  expect(result.finished).toBe(true);
  expect(result.focusPlan!.status).toBe("blocked");
  expect(result.focusPlan!.actualHours).toBe(0);
  expect(result.timeBudget!.activities).toEqual([]);
  expect(advanceMonth(result, [])).toEqual(result);
});
it("does not reserve the previous education stage again in the graduation month", () => {
  const s = newGame(42);
  s.month = 263;
  s.education = "university";
  s.studyPath = "university";
  s.graduatedUniversity = true;
  const result = advanceMonth(s, []);
  expect(result.month).toBe(264);
  expect(result.education).toBe("working");
  expect(result.timeBudget!.allocations.学業).toBe(0);
});
it("reserves duties acquired during a choice before exposing the completed month", () => {
  const s = newGame(0); s.month = 300; s.monthStarted = true; s.education = "working";
  s.timeBudget = budgetFor(s);
  s.pending = { eventId: "job-plan", text: "仕事を選ぶ", choices: [{ label: "応募", effects: [], career: "parttime" }] };
  const result = choose(s, 0, []);
  expect(result.career).toBe("parttime");
  expect(result.timeBudget!.allocations.仕事).toBe(80);
  const before = remainingHours(result); result.career = "none";
  expect(remainingHours(result)).toBe(before);
});
