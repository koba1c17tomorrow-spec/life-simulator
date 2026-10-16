import { expect, it } from "vitest";
import fixture from "./fixtures/current-v1-club-pending.json";
import {
  newGame,
  takeAction,
  meetPerson,
  normalizeGameState,
  advanceMonth,
  autoResolve,
} from "../src/engine";
import {
  initialCapabilities,
  practiceSkill,
  visibleTraits,
} from "../src/capabilities";
import { hiringFactors, JOBS } from "../src/careers";
it("retains real legacy state without invented skills or credentials", () => {
  expect(normalizeGameState(fixture.state)).toEqual(fixture.state);
  const legacy = normalizeGameState(fixture.state);
  legacy.pending = null;
  const after = takeAction(legacy, "study");
  expect(after.capabilities?.legacyBaseline).toBe(true);
  expect(after.capabilities?.observedSinceMonth).toBe(legacy.month);
  expect(after.degree).toBe(legacy.degree);
  expect(after.flags).toEqual(legacy.flags);
  expect(normalizeGameState(after)).toEqual(after);
});
it("discovers fixed traits gradually and practices once per actual action", () => {
  let s = newGame(42);
  s.month = 100;
  s.traits = ["quickLearner"];
  expect(visibleTraits(s)).toEqual([]);
  const before = s.stats.knowledge;
  s = takeAction(s, "study");
  expect(s.stats.knowledge).toBeCloseTo(before + 1.8);
  expect(s.capabilities?.skills.learning).toBe(1.2);
  expect(takeAction(s, "study")).toEqual(s);
  expect(meetPerson(s, "mother")).toEqual(s);
  practiceSkill(s, "learning", 2);
  expect(visibleTraits(s)).toEqual(["quickLearner"]);
  expect(s.traits).toEqual(["quickLearner"]);
});
it("rejects corrupt skill/discovery input; valid optional extension round trips", () => {
  const s = newGame();
  expect(normalizeGameState(s)).toEqual(s);
  s.capabilities!.skills.learning = 101;
  expect(() => normalizeGameState(s)).toThrow();
  s.capabilities = initialCapabilities();
  s.capabilities.revealedTraits = ["quickLearner"];
  s.traits = [];
  expect(() => normalizeGameState(s)).toThrow();
});
it.each(["modern", "coastal"])(
  "preserves skill growth and deterministic resume in %s",
  (world) => {
    let a = newGame(42, {}, world);
    a.autoChoices = true;
    for (let i = 0; i < 100; i++) a = autoResolve(advanceMonth(a, []), []);
    let b = normalizeGameState(a);
    for (let i = 0; i < 12; i++) {
      a = takeAction(a, "study");
      b = takeAction(b, "study");
      a = autoResolve(advanceMonth(a, []), []);
      b = autoResolve(advanceMonth(b, []), []);
    }
    expect(b).toEqual(a);
  },
);
it("skills supplement a judgment without duplicating base abilities", () => {
  const s = newGame();
  const before = hiringFactors(s, JOBS[0]);
  s.capabilities!.skills.professional = 80;
  const after = hiringFactors(s, JOBS[0]);
  expect(after.習得技能).toBeGreaterThan(before.習得技能);
  expect(after.知識適性).toBe(before.知識適性);
});
it("monthly schooling practices once across choice pause and resume", () => {
  const s = newGame(42); s.month = 143;
  const paused = advanceMonth(s, []);
  expect(paused.pending).not.toBeNull();
  expect(paused.capabilities!.practice.learning).toBe(0.1);
  expect(advanceMonth(paused, [])).toEqual(paused);
});
