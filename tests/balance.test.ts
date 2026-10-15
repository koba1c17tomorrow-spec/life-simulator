import { describe, it, expect } from "vitest";
import { monthlyDrift, relativeScore, ageAverage } from "../src/balance";
import { annualSalary, jobChance } from "../src/progression";
import { newGame, advanceMonth, choose } from "../src/engine";
describe("balance and hiring", () => {
  it("age peers advance in knowledge", () => {
    expect(ageAverage(216, "knowledge")).toBeGreaterThan(
      ageAverage(72, "knowledge"),
    );
    expect(relativeScore(40, 216, "knowledge")).toBeLessThan(
      relativeScore(40, 72, "knowledge"),
    );
  });
  it("working reduces health passively", () => {
    expect(monthlyDrift(300, "office", "rest").health).toBeLessThan(0);
  });
  it("salary and probability are displayed from shared model", () => {
    const s = newGame();
    s.month = 264;
    expect(annualSalary("technical")).toBe(3120000);
    const p = jobChance(s, "technical");
    s.stats.knowledge += 40;
    expect(jobChance(s, "technical")).toBeGreaterThan(p);
  });
  it("stats decline when not maintained", () => {
    const s = newGame();
    s.month = 300;
    s.career = "office";
    s.priority = "rest";
    const n = advanceMonth(s, []);
    expect(n.stats.health).toBeLessThan(s.stats.health);
    expect(n.stats.knowledge).toBeLessThan(s.stats.knowledge);
  });
  it("career choices are resolved by seeded lottery", () => {
    const s = newGame(123);
    s.month = 215;
    const n = advanceMonth(s, []);
    expect(n.pending?.choices.some((c) => c.successChance !== undefined)).toBe(
      true,
    );
    const result = choose(n, 0, []);
    expect(result.pending).toBeNull();
  });
});
