import { it, expect } from "vitest";
import {
  newGame,
  takeAction,
  advanceMonth,
  choose,
  normalizeGameState,
  type GameState,
} from "../src/engine";
import { practiceHours } from "../src/capabilities";
import { rollChance, rollFactors } from "../src/eventRules";
const seeds = Array.from({ length: 32 }, (_, i) => 7919 * (i + 1));
it("paired seed cohort isolates actual hours, talent, health, stress, environment and diminishing gains", () => {
  const rows = seeds.map((seed) => {
    const s = newGame(seed);
    s.month = 120;
    s.traits = [];
    s.education = "working";
    const gain = (hours: number, patch: (s: GameState) => void = () => {}) => {
      const n = structuredClone(s);
      patch(n);
      const before = n.capabilities!.skills.learning;
      practiceHours(n, "learning", hours);
      return n.capabilities!.skills.learning - before;
    };
    const base = gain(8);
    expect(gain(16)).toBeGreaterThan(base);
    expect(gain(8, (n) => (n.traits = ["quickLearner"]))).toBeGreaterThan(base);
    expect(gain(8, (n) => (n.stats.health = 40))).toBeLessThan(base);
    expect(gain(8, (n) => (n.stress = 80))).toBeLessThan(base);
    expect(gain(8, (n) => (n.education = "university"))).toBeGreaterThan(base);
    expect(gain(8, (n) => (n.capabilities!.skills.learning = 90))).toBeLessThan(
      base,
    );
    return { seed, base, high: gain(32) };
  });
  console.log("SKILL_COHORT", JSON.stringify(rows));
});
it("real intensity uses charged hours; blocked plans and pending resume never earn extra practice", () => {
  const s = newGame(42);
  s.month = 120;
  s.stats.money = 1000;
  const a = takeAction(s, "study", 1),
    b = takeAction(s, "study", 3);
  expect(b.capabilities!.practice.learning).toBe(
    4 * a.capabilities!.practice.learning,
  );
  expect(b.capabilities!.skills.learning).toBeGreaterThan(
    a.capabilities!.skills.learning,
  );
  s.pending = {
    eventId: "pause",
    text: "pause",
    choices: [{ label: "ok", effects: [] }],
  };
  expect(takeAction(s, "study", 3)).toEqual(s);
  expect(advanceMonth(s, [])).toEqual(s);
  expect(choose(s, 0, [])).toEqual(choose(normalizeGameState(s), 0, []));
});
it("paired uniform draws demonstrate improved outcomes but not guaranteed success or duplicated skill factors", () => {
  const a = newGame();
  a.capabilities!.skills.learning = 0;
  const b = structuredClone(a);
  b.capabilities!.skills.learning = 100;
  const rule = { base: 40, stat: "knowledge" as const, statFactor: 0.5 };
  const count = (s: typeof a) => {
    let successes = 0;
    for (const seed of seeds) {
      let value = seed;
      for (let i = 0; i < 1000; i++) {
        value = (Math.imul(1664525, value) + 1013904223) >>> 0;
        if (value / 4294967296 * 100 < rollChance(s, rule)) successes++;
      }
    }
    return successes;
  };
  console.log("SKILL_OUTCOMES", JSON.stringify({ seeds, trials: 32000, untrained: count(a), trained: count(b) }));
  expect(count(b)).toBeGreaterThan(count(a));
  expect(count(b)).toBeLessThan(32000);
  expect(rollFactors(b, rule).習得技能 - rollFactors(a, rule).習得技能).toBe(5);
  expect(rollChance(b, { ...rule, base: 1000 })).toBe(95);
});
it("monthly attendance comes from the actual budget, is saved and is applied once", () => {
  const s = newGame(42);
  s.month = 143;
  const paused = advanceMonth(s, []);
  expect(paused.timeBudget!.participation?.school).toBe(140);
  expect(normalizeGameState(paused)).toEqual(paused);
  expect(advanceMonth(paused, [])).toEqual(paused);
  const corrupt = structuredClone(paused);
  corrupt.timeBudget!.participation!.school = 141;
  expect(() => normalizeGameState(corrupt)).toThrow();
});
