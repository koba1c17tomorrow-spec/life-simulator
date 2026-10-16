import { expect, it } from "vitest";
import { abilityGain } from "../src/balance";
import { progressionMonth, promotionMonths } from "../src/progression";
import { newGame, applyEffects, normalizeGameState } from "../src/engine";
it("repeated high ability gains taper while early learning and losses keep their meaning", () => {
  expect(abilityGain(20, 2)).toBe(2);
  expect(abilityGain(60, 2)).toBe(2);
  expect(abilityGain(80, 2)).toBe(1);
  expect(abilityGain(95, 2)).toBeGreaterThan(0);
  expect(abilityGain(95, 2)).toBeLessThan(abilityGain(80, 2));
  expect(abilityGain(80, -2)).toBe(-2);
  const s = newGame();
  s.stats.knowledge = 80;
  applyEffects(s, [
    { stat: "knowledge", delta: 2 },
    { stat: "money", delta: 1000 },
  ]);
  expect(s.stats.knowledge).toBe(81);
  expect(s.stats.money).toBe(1000);
});
it("later promotions need longer experience, without cutting entry wages", () => {
  expect(promotionMonths(0)).toBe(60);
  expect(promotionMonths(3)).toBeGreaterThan(promotionMonths(1));
  const s = newGame();
  s.month = 300;
  s.career = "office";
  s.careerLevel = 2;
  s.experience = 60;
  progressionMonth(s, () => {});
  expect(s.careerLevel).toBe(2);
  s.experience = promotionMonths(2) - 1;
  progressionMonth(s, () => {});
  expect(s.careerLevel).toBe(3);
  expect(s.experience).toBe(0);
});
it("importing an existing high ability or promotion state does not rewrite earned values", () => {
  const s = newGame();
  s.stats.knowledge = 100;
  s.stats.money = 200000000;
  s.careerLevel = 5;
  expect(normalizeGameState(s)).toEqual(s);
});
