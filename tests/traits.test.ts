import { describe, it, expect } from "vitest";
import { newGame, advanceMonth, takeAction } from "../src/engine";
import { randomTraits, traitMonthlyEffects } from "../src/traits";
describe("birth traits", () => {
  it("are deterministic and distinct", () => {
    expect(newGame(42).traits).toEqual(newGame(42).traits);
    expect(new Set(newGame(42).traits).size).toBe(newGame(42).traits.length);
  });
  it("have one to three traits", () => {
    for (let i = 0; i < 100; i++) {
      const n = newGame(i).traits.length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });
  it("change passive health", () => {
    expect(traitMonthlyEffects(["frail"], true).health).toBeLessThan(
      traitMonthlyEffects(["resilient"], true).health,
    );
  });
  it("quick learner increases studying benefit", () => {
    const s = newGame();
    s.traits = ["quickLearner"];
    s.month = 100;
    const t = takeAction(s, "study");
    expect(t.stats.knowledge - s.stats.knowledge).toBeCloseTo(1.8);
  });
});

it("familial traits bias draws but cannot create duplicate traits or endless loops", () => {
  const a = randomTraits(() => 0.1, ["creative"]);
  expect(a).toEqual(["creative"]);
  expect(new Set(randomTraits(() => 0.9)).size).toBe(3);
  const s = newGame(20);
  expect(s.origin.parentTraits).toHaveLength(2);
  expect(s.people[0].traits).toEqual(s.origin.parentTraits[0]);
});
