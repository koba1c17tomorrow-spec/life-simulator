import { expect, it } from "vitest";
import {
  newGame,
  meetPerson,
  normalizeGameState,
  advanceMonth,
  autoResolve,
} from "../src/engine";
import { contact } from "../src/social";
import { feelings, interact, observedAttitude } from "../src/directedRelations";
import fixture from "./fixtures/current-v1-club-pending.json";
it("preserves legacy relations without inventing reverse emotions", () => {
  const s = normalizeGameState(fixture.state);
  expect(s).toEqual(fixture.state);
  expect(feelings(s, "mother", "player").trust).toBeNull();
  expect(feelings(s, "player", "mother").trust).toBe(s.relations[0].trust);
});
it("keeps independently directed four axes and attraction, round trips and rejects missing references", () => {
  const s = meetPerson(newGame(), "mother");
  expect(feelings(s, "player", "mother")).not.toEqual(
    feelings(s, "mother", "player"),
  );
  expect(feelings(s, "mother", "player").attraction).toBeNull();
  expect(normalizeGameState(s)).toEqual(s);
  s.relationshipModel!.edges[0].to = "missing";
  expect(() => normalizeGameState(s)).toThrow();
});
it("explains improved, worse and unchanged reactions from actual circumstances", () => {
  for (const [personality, health, expected] of [
    ["kind", 85, 1],
    ["quiet", 85, 0],
    ["ambitious", 20, -1],
  ] as const) {
    const s = newGame();
    s.people[0].personality = personality;
    s.people[0].health = health;
    const before = s.relations[0].closeness;
    contact(s, 0, "mother", "spend");
    expect(Math.sign(s.relations[0].closeness - before)).toBe(expected);
    expect(s.relationshipModel!.lastInteraction!.outcome).toBe(expected);
  }
});
it("supports NPC-to-NPC edges without changing the player's relationships or journal", () => {
  const s = newGame();
  const old = structuredClone(s.relations);
  const log = structuredClone(s.history);
  interact(s, 0, "mother", "father", "talk");
  expect(feelings(s, "mother", "father").liking).not.toBeNull();
  expect(s.relations).toEqual(old);
  expect(s.history).toEqual(log);
});
it("freezes deceased edges and exposes only actually observed attitudes", () => {
  const s = meetPerson(newGame(), "mother");
  const observation = observedAttitude(s, "mother");
  s.relationshipModel!.edges.find((e) => e.from === "mother")!.liking = 0;
  expect(observedAttitude(s, "mother")).toBe(observation);
  s.people[0].alive = false;
  s.people[0].deathMonth = 0;
  s.month = 1;
  const old = structuredClone(s.relationshipModel);
  expect(meetPerson(s, "mother").relationshipModel).toEqual(old);
  expect(interact(s, 1, "father", "mother")).toBeNull();
});
it.each(["modern", "coastal"])(
  "replays directed relationships with saves in %s",
  (world) => {
    let a = newGame(42, {}, world);
    a.autoChoices = true;
    for (let i = 0; i < 12; i++) {
      a = meetPerson(a, "mother");
      const b = normalizeGameState(a);
      expect(autoResolve(advanceMonth(b, []), [])).toEqual(
        autoResolve(advanceMonth(a, []), []),
      );
      a = autoResolve(advanceMonth(a, []), []);
    }
  },
);
