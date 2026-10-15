import { it, expect } from "vitest";
import {
  newGame,
  advanceMonth,
  choose,
  type EventDefinition,
} from "../src/engine";
import { healthMonth } from "../src/health";
import { satisfies } from "../src/eventRules";
it("retires at 65 and receives pension rather than job prompts", () => {
  let s = newGame();
  s.month = 779;
  s.career = "office";
  s.lifetimeWork = 480;
  s = advanceMonth(s, []);
  expect(s.retired).toBe(true);
  expect(s.career).toBe("none");
  expect(s.monthlyIncome).toBe(133000);
  expect(s.pending).toBeNull();
});
it("illness has a finite recovery and cause of death is recorded", () => {
  const s = newGame();
  s.month = 300;
  s.illness = "怪我";
  s.illnessUntil = 300;
  healthMonth(
    s,
    () => 1,
    () => {},
  );
  expect(s.illness).toBeNull();
  expect(s.flags.recovered).toBe(true);
  s.month = 1200;
  healthMonth(
    s,
    () => 1,
    () => {},
  );
  expect(s.finished).toBe(true);
  expect(s.deathCause).toBe("老衰");
});
it("caregiving consumes energy and is part of the story", () => {
  const s = newGame();
  s.month = 600;
  s.people[0].birthMonth = -400;
  s.people[0].illness = true;
  const logs: string[] = [];
  healthMonth(
    s,
    () => 1,
    (x) => logs.push(x),
  );
  expect(s.caregivingMonths).toBe(1);
  expect(logs.some((x) => x.includes("介護"))).toBe(true);
});
it("decisions have delayed, once-only consequences and causal flags", () => {
  const s = newGame();
  s.month = 10;
  s.monthStarted = true;
  s.pending = {
    eventId: "project",
    text: "挑戦",
    choices: [
      {
        label: "始める",
        effects: [],
        setFlag: "project",
        delayed: {
          months: 2,
          text: "努力が実った",
          effects: [{ stat: "knowledge", delta: 2 }],
          flag: "reward",
        },
      },
    ],
  };
  let n = choose(s, 0, []);
  expect(satisfies(n, [{ flag: "project", notFlag: "reward" }])).toBe(true);
  n = advanceMonth(n, []);
  expect(n.flags.reward).toBeUndefined();
  n = advanceMonth(n, []);
  expect(n.flags.reward).toBe(true);
  expect(n.scheduled).toHaveLength(0);
  expect(n.history.filter((x) => x.text.includes("努力が実った"))).toHaveLength(
    1,
  );
});
