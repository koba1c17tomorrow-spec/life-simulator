import { it, expect } from "vitest";
import { newGame, advanceMonth, takeAction } from "../src/engine";
import { spend, transfer, restructure, changeLiving } from "../src/economy";
import { naturalGrowth, monthlyDrift } from "../src/balance";
it("policy is a small age appropriate correction, including decline", () => {
  for (const month of [1, 36, 120, 300, 900]) {
    const n = naturalGrowth(month, "none"),
      s = monthlyDrift(month, "none", "learning");
    expect(s.knowledge - n.knowledge).toBeCloseTo(
      Math.max(Math.abs(n.knowledge), 0.02) * 0.1,
    );
  }
  let s = newGame();
  s.priority = "learning";
  s.traits = [];
  for (let i = 0; i < 36; i++) s = advanceMonth(s, []);
  expect(s.stats.knowledge).toBeLessThan(20);
});
it("blocks child, unaffordable, repeated and same-month purchases", () => {
  const s = newGame();
  s.stats.money = 100000;
  expect(spend(s, "books")).toBe(s);
  s.month = 120;
  const n = spend(s, "books");
  expect(n.stats.money).toBe(97000);
  expect(spend(n, "books")).toBe(n);
  expect(spend(n, "hobby")).toBe(n);
  n.month++;
  expect(spend(n, "books")).toBe(n);
});
it("money transfers preserve total assets and cannot overdraw or accept invalid amounts", () => {
  const s = newGame();
  s.month = 240;
  s.stats.money = 100000;
  const n = transfer(s, "save", 30000);
  expect(n.stats.money + n.savings).toBe(100000);
  expect(transfer(n, "withdraw", 40000)).toBe(n);
  expect(transfer(n, "save", NaN)).toBe(n);
  expect(transfer(n, "save", -1)).toBe(n);
  expect(transfer(n, "withdraw", 30000).stats.money).toBe(100000);
});
it("restructuring consumes assets and imposes restrictions without ending life", () => {
  const s = newGame();
  s.month = 300;
  s.debt = 10000000;
  s.savings = 1000000;
  const n = restructure(s);
  expect(n.debt).toBe(3150000);
  expect(n.savings).toBe(0);
  expect(n.finished).toBe(false);
  expect(restructure(n)).toBe(n);
  expect(changeLiving(n, "comfortable")).toBe(n);
  expect(transfer(n, "invest", 1)).toBe(n);
});
it("purchases influence future systems and relationships", () => {
  const s = newGame();
  s.month = 240;
  s.stats.money = 100000;
  expect(spend(s, "books").benefits.learning).toBe(252);
  expect(spend(s, "gift").relations[0].closeness).toBeGreaterThan(
    s.relations[0].closeness,
  );
});

it("voluntary preschool learning is bounded too", () => {
  let s = newGame();
  s.traits = ["quickLearner"];
  for (let m = 0; m < 72; m++) {
    s = takeAction(s, "study");
    s = advanceMonth(s, []);
  }
  expect(s.stats.knowledge).toBeLessThan(30);
});
