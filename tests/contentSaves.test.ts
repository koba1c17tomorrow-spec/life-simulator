import { it, expect } from "vitest";
import modern from "../public/worlds/modern/events.json";
import coastal from "../public/worlds/coastal/events.json";
import { validateEvents, validateManifest } from "../src/content";
import {
  newGame,
  advanceMonth,
  choose,
  autoResolve,
  normalizeGameState,
  selectEvents,
  type EventDefinition,
} from "../src/engine";
import { saveSlot, loadSlot, exportSave, importSave } from "../src/saves";
it("validates both worlds and rejects malformed content before play", () => {
  expect(validateEvents(modern).length).toBeGreaterThan(50);
  expect(validateEvents(coastal).length).toBeGreaterThan(modern.length);
  for (const bad of [
    [],
    [...modern, modern[0]],
    [{ ...modern[0], weight: NaN }],
    [{ ...modern[0], effects: [{ stat: "not-a-stat", delta: 1 }] }],
    [{ ...modern[0], presentation: "choice", choices: [] }],
    [{ ...modern[0], requires: [{ field: "bad" }] }],
  ])
    expect(() => validateEvents(bad)).toThrow();
});
it("roundtrips saves, slots remain independent and broken imports do not mutate state", () => {
  const state = newGame(99);
  state.stats.money = 50000;
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  saveSlot(storage, 1, state);
  saveSlot(storage, 2, newGame(100));
  expect(loadSlot(storage, 1)).toEqual(state);
  expect(loadSlot(storage, 2).birthSeed).toBe(100);
  expect(() => loadSlot(storage, 3)).toThrow();
  expect(importSave(exportSave(state))).toEqual(state);
  expect(() => importSave("{")).toThrow();
  expect(state.stats.money).toBe(50000);
});
it("rejects corrupt nested state and invalid pending choices", () => {
  for (const patch of [
    { savings: -1 },
    { priority: "bogus" },
    { worldId: "unknown" },
    { flags: [] },
    { benefits: { health: "forever" } },
    { pending: { eventId: "bad", text: "bad", choices: [] } },
    { scheduled: [{}] },
    { people: [{ id: "a" }] },
  ])
    expect(() => normalizeGameState({ ...newGame(), ...patch })).toThrow();
});
it("migration retains old saves while translating old policy names", () => {
  const old: any = newGame(12);
  delete old.savings;
  delete old.timeline;
  delete old.studyPath;
  delete old.degree;
  delete old.birthSeed;
  old.priority = "study";
  old.month = 300;
  old.graduatedUniversity = true;
  const n = normalizeGameState(old);
  expect(n.priority).toBe("learning");
  expect(n.degree).toBe("university");
  expect(n.birthSeed).toBeNull();
  expect(n.savings).toBe(0);
});
it("graduation outranks optional decisions and generic choices have a yearly gap", () => {
  const s = newGame();
  s.month = 215;
  s.lastChoiceMonth = 210;
  const n = advanceMonth(s, []);
  expect(n.pending?.eventId).toBe("career-start");
  const t = newGame();
  t.month = 120;
  t.lastChoiceMonth = 115;
  const events: EventDefinition[] = [
    {
      id: "ordinary",
      text: "日常",
      category: "growth",
      presentation: "choice",
      weight: 100,
      choices: [{ label: "はい", effects: [] }],
    },
  ];
  for (let i = 0; i < 20; i++) expect(selectEvents(t, events)).toEqual([]);
});
it("world and seed recreate a life, including save and continue", () => {
  const events = validateEvents(coastal);
  let a = newGame(123, {}, "coastal"),
    b = newGame(123, {}, "coastal");
  a.autoChoices = true;
  b.autoChoices = true;
  for (let i = 0; i < 300 && !a.finished; i++) {
    a = autoResolve(advanceMonth(a, events), events);
    b = autoResolve(advanceMonth(b, events), events);
    if (i === 100) b = importSave(exportSave(b));
  }
  expect(a).toEqual(b);
  expect(a.origin.region).toBe("coastal");
});

it("world manifests cannot escape their content directory", () => {
  expect(
    validateManifest(
      { id: "modern", name: "現代", events: "events.json" },
      "modern",
    ).events,
  ).toBe("events.json");
  for (const events of [
    "../evil.json",
    "https://example.com/events.json",
    "/events.json",
  ])
    expect(() =>
      validateManifest({ id: "modern", name: "現代", events }, "modern"),
    ).toThrow();
});
