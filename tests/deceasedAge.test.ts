import { expect, it } from "vitest";
import {
  advanceMonth,
  autoResolve,
  newGame,
  normalizeGameState,
} from "../src/engine";
import { npcMonth } from "../src/relationships";
import { personAgeMonths, personAgeLabel } from "../src/social";
import { exportSave, importSave } from "../src/saves";
import fixture from "./fixtures/current-v1-club-pending.json";

it.each(["modern", "coastal"])(
  "%s freezes a new death across months and saved continuations",
  (world) => {
    const s = newGame(42, {}, world);
    s.month = 300;
    const p = s.people[0];
    p.birthMonth = -900; // Deterministic age-limit death; no forced random outcome.
    const relations = structuredClone(s.relations);
    npcMonth(
      s,
      () => 1,
      () => {},
    );
    expect(p.alive).toBe(false);
    expect(p.deathMonth).toBe(300);
    expect(personAgeMonths(p, 300)).toBe(1200);
    const frozen = structuredClone(p);
    s.autoChoices = true;
    let next = importSave(exportSave(s));
    for (let i = 0; i < 24; i++) {
      next = autoResolve(advanceMonth(next, []), []);
      next = importSave(exportSave(next));
    }
    expect(next.people[0]).toEqual(frozen);
    expect(personAgeLabel(next.people[0], next.month)).toBe("100歳");
    expect(next.relations.find((r) => r.id === p.id)).toEqual(relations[0]);
    expect(next.finished).toBe(false);
  },
);
it("living ages advance while missing/null death dates remain unknown", () => {
  const p = newGame().people[0];
  expect(personAgeMonths(p, 12)! - personAgeMonths(p, 0)!).toBe(12);
  p.alive = false;
  expect(personAgeLabel(p, 0)).toBe("死亡時年齢不明");
  expect(personAgeLabel(p, 120)).toBe("死亡時年齢不明");
  p.deathMonth = null;
  expect(personAgeMonths(p, 120)).toBeNull();
});
it("legacy deceased saves preserve existing logs/relations and do not fabricate death dates", () => {
  const v = structuredClone(fixture);
  v.state.people[0].alive = false;
  const s = importSave(JSON.stringify(v));
  expect(s.people[0]).not.toHaveProperty("deathMonth");
  expect(s.history).toEqual(v.state.history);
  expect(s.relations).toEqual(v.state.relations);
  expect(importSave(exportSave(s))).toEqual(s);
});
it.each([-1000, 1.5, 9999, "300"])(
  "rejects invalid explicit death month %s",
  (value) => {
    const s = newGame();
    s.people[0].alive = false;
    Object.assign(s.people[0], { deathMonth: value });
    expect(() => normalizeGameState(s)).toThrow();
  },
);
it("does not rewrite an already-dead person's spouse state when another NPC dies", () => {
  const s = newGame();
  s.month = 301;
  s.people[0].alive = false;
  s.people[0].spouseId = "father";
  s.people[1].spouseId = "mother";
  s.people[1].birthMonth = -1200;
  const frozen = structuredClone(s.people[0]);
  npcMonth(
    s,
    () => 1,
    () => {},
  );
  expect(s.people[0]).toEqual(frozen);
});
