import { record } from "../src/journal";
import { it, expect } from "vitest";
import {
  newGame,
  normalizeGameState,
  advanceMonth,
  autoResolve,
} from "../src/engine";
it("migrates old saves and preserves random stream and progress", () => {
  const old: any = newGame(42);
  old.month = 120;
  delete old.origin;
  delete old.people;
  delete old.career;
  const next = normalizeGameState(old);
  expect(next.month).toBe(120);
  expect(next.seed).toBe(old.seed);
  expect(next.people.length).toBe(2);
  expect(normalizeGameState(next)).toEqual(next);
});
it("rejects corrupt and future save formats", () => {
  expect(() => normalizeGameState({ version: 99 })).toThrow();
  const old = newGame();
  old.stats.health = NaN;
  expect(() => normalizeGameState(old)).toThrow();
});
it("seeded automatic life finishes without blocking", () => {
  let s = newGame(42);
  s.autoChoices = true;
  for (let i = 0; i < 1200 && !s.finished; i++) {
    s = autoResolve(advanceMonth(s, []), []);
    expect(s.pending).toBeNull();
    expect(Object.values(s.stats).every(Number.isFinite)).toBe(true);
  }
  expect(s.finished).toBe(true);
});

it("history IDs stay unique after more than 1500 entries and after save reload", () => {
  let s = newGame();
  for (let i = 0; i < 1600; i++) record(s, "記録");
  expect(s.history.length).toBe(1500);
  s = normalizeGameState(JSON.parse(JSON.stringify(s)));
  for (let i = 0; i < 10; i++) record(s, "続き");
  expect(new Set(s.history.map((e) => e.id)).size).toBe(1500);
});

it("migrates NPC counters without reusing existing identities", () => {
  const old: any = newGame();
  old.people.push({
    id: "friend-4",
    name: "友人",
    kind: "friend",
    birthMonth: 0,
    alive: true,
  });
  delete old.nextPersonId;
  expect(normalizeGameState(old).nextPersonId).toBe(5);
});
