import { expect, it } from "vitest";
import {
  advanceMonth,
  autoResolve,
  newGame,
  normalizeGameState,
} from "../src/engine";
import {
  createSociety,
  societyMonth,
  SOCIAL_AXES,
  societyRestriction,
} from "../src/society";
import { importSave, exportSave } from "../src/saves";
import fixture from "./fixtures/current-v1-club-pending.json";
it("initializes six bounded axes with world settings including a fantasy profile", () => {
  for (const world of ["modern", "coastal", "fantasy"]) {
    const s = newGame(7919, {}, world);
    expect(Object.keys(s.society!.axes)).toEqual([...SOCIAL_AXES]);
    expect(s.society!.profile).toBe(world);
    expect(s.society!.startMonth).toBe(0);
  }
  expect(createSociety("fantasy", 0, 1, false).axes).not.toEqual(
    createSociety("modern", 0, 1, false).axes,
  );
});
it("leaves actual v1 saves untouched until the first unstarted month, without fabricating past months", () => {
  let s = importSave(JSON.stringify(fixture));
  expect(s.society).toBeUndefined();
  const oldMonth = s.month;
  s.autoChoices = true;
  s = autoResolve(s, []);
  s = advanceMonth(s, []);
  expect(s.society!.legacyBaseline).toBe(true);
  expect(s.society!.startMonth).toBeGreaterThanOrEqual(oldMonth);
});
it("has mean reversion, bounded noise, one update per month and isolated random consumption", () => {
  const s = newGame(42);
  const seed = s.seed;
  s.society!.axes.economy = 100;
  s.month = 1;
  societyMonth(s);
  expect(s.society!.axes.economy).toBeLessThan(100);
  const once = structuredClone(s);
  societyMonth(s);
  expect(s).toEqual(once);
  expect(s.seed).toBe(seed);
  expect(s.randomStreams).toBeUndefined();
});
it.each(["modern", "coastal"])(
  "preserves deterministic saved continuation: %s",
  (world) => {
    let a = newGame(7919, {}, world);
    for (let i = 0; i < 36; i++) {
      a = autoResolve(advanceMonth(a, []), []);
      expect(
        autoResolve(advanceMonth(importSave(exportSave(a)), []), []),
      ).toEqual(autoResolve(advanceMonth(a, []), []));
    }
  },
);
it("rejects malformed extensions without rejecting missing extensions", () => {
  const s = newGame(1);
  for (const change of [
    { version: 2 },
    { randomState: -1 },
    { startMonth: 1 },
    { axes: { ...s.society!.axes, safety: 101 } },
  ]) {
    expect(() =>
      normalizeGameState({ ...s, society: { ...s.society, ...change } }),
    ).toThrow();
  }
  expect(
    societyRestriction(
      {
        ...s,
        society: { ...s.society!, axes: { ...s.society!.axes, safety: 10 } },
      },
      "spend",
    ),
  ).toBeTruthy();
});
