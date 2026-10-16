import { expect, it } from "vitest";
import {
  newGame,
  advanceMonth,
  autoResolve,
  meetPerson,
  normalizeGameState,
} from "../src/engine";
import { classifyNpc, observeNpcTiers } from "../src/npcTiers";
import fixture from "./fixtures/current-v1-club-pending.json";
import recent from "./fixtures/p3-2-coastal-observed.json";
it("keeps both real prior save formats unchanged until a new update boundary", () => {
  expect(normalizeGameState(fixture.state)).toEqual(fixture.state);
  expect(normalizeGameState(recent.state)).toEqual(recent.state);
  expect(normalizeGameState(recent.state).npcTiers).toBeUndefined();
});
it("classifies active, distant and archived people without inventing old clocks", () => {
  const s = newGame();
  s.month = 300;
  s.relations[0].closeness = 5;
  s.relations[0].lastContactMonth = 0;
  s.people[0].movedAway = true;
  expect(classifyNpc(s, s.people[0])).toBe("Dormant");
  expect(classifyNpc(s, s.people[1])).toBe("Active");
  s.people[1].alive = false;
  s.people[1].deathMonth = 200;
  observeNpcTiers(s);
  expect(s.npcTiers!.entries.mother.lastDetailedMonth).toBeNull();
  expect(s.npcTiers!.entries.father).toEqual({
    tier: "Archived",
    lastDetailedMonth: null,
  });
  s.month++;
  observeNpcTiers(s, ["mother", "father"]);
  expect(s.npcTiers!.entries.father.lastDetailedMonth).toBeNull();
  expect(s.npcTiers!.entries.mother.lastDetailedMonth).toBe(301);
});
it("Dormant is observation only: actual monthly health processing and clocks remain full", () => {
  const s = newGame(42);
  s.month = 300;
  s.autoChoices = true;
  s.people[0].movedAway = true;
  s.people[0].birthMonth = -600;
  s.people[0].health = 85;
  s.relations[0].closeness = 5;
  s.relations[0].lastContactMonth = 0;
  const n = autoResolve(advanceMonth(s, []), []);
  expect(n.npcTiers!.updates).toBe("full");
  expect(n.people[0].health).toBeLessThan(85);
  expect(n.npcTiers!.entries.mother.lastDetailedMonth).toBe(301);
});
it("new deaths record the completed month once and stay frozen after archival", () => {
  const s = newGame(42);
  s.month = 300;
  s.people[0].birthMonth = -899;
  s.autoChoices = true;
  const dead = autoResolve(advanceMonth(s, []), []);
  expect(dead.people[0].alive).toBe(false);
  expect(dead.npcTiers!.entries.mother).toEqual({
    tier: "Archived",
    lastDetailedMonth: 301,
  });
  const next = autoResolve(advanceMonth(dead, []), []);
  expect(next.people[0]).toEqual(dead.people[0]);
  expect(next.npcTiers!.entries.mother).toEqual(dead.npcTiers!.entries.mother);
});
it("recontact changes classification without replaying a month or adding update time", () => {
  const s = newGame();
  s.month = 300;
  s.people[0].kind = "friend";
  s.relations[0].closeness = 20;
  s.relations[0].lastContactMonth = 0;
  observeNpcTiers(s, ["mother", "father"]);
  expect(s.npcTiers!.entries.mother.tier).toBe("Dormant");
  const n = meetPerson(s, "mother", "talk");
  expect(n.npcTiers!.entries.mother.tier).toBe("Active");
  expect(n.npcTiers!.entries.mother.lastDetailedMonth).toBe(300);
  const before = structuredClone(n.npcTiers);
  observeNpcTiers(n);
  expect(n.npcTiers).toEqual(before);
});
it.each(["modern", "coastal"])(
  "preserves tier metadata, pending and streams across saves in %s",
  (world) => {
    let a = newGame(42, {}, world);
    a.month = 143;
    const paused = advanceMonth(a, []);
    expect(paused.pending).not.toBeNull();
    expect(advanceMonth(paused, [])).toEqual(paused);
    a = { ...paused, autoChoices: true };
    a = autoResolve(a, []);
    let b = normalizeGameState(a);
    for (let i = 0; i < 24; i++) {
      a = autoResolve(advanceMonth(a, []), []);
      b = autoResolve(advanceMonth(b, []), []);
      expect(b).toEqual(a);
    }
  },
);
it("rejects future clocks, unsupported deferred mode and missing NPC references", () => {
  const s = newGame();
  observeNpcTiers(s);
  const future = structuredClone(s);
  future.npcTiers!.entries.mother.lastDetailedMonth = 1;
  expect(() => normalizeGameState(future)).toThrow();
  const mode = structuredClone(s);
  (mode.npcTiers as any).updates = "deferred";
  expect(() => normalizeGameState(mode)).toThrow();
  s.npcTiers!.entries.missing = { tier: "Dormant", lastDetailedMonth: null };
  expect(() => normalizeGameState(s)).toThrow();
});
