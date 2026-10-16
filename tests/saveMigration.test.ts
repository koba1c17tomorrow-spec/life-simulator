import { describe, expect, it } from "vitest";
import fixture from "./fixtures/current-v1-club-pending.json";
import {
  advanceMonth,
  autoResolve,
  newGame,
  normalizeGameState,
} from "../src/engine";
import { exportSave, importSave, loadSlot, saveSlot, SAVE } from "../src/saves";
import { validateEvents } from "../src/content";
import modern from "../public/worlds/modern/events.json";
import coastal from "../public/worlds/coastal/events.json";

const text = JSON.stringify(fixture);
describe("P0-2 rejects invalid relations without inventing or clamping data", () => {
  it.each([
    ["closeness", -0.1],
    ["closeness", 100.1],
    ["trust", -1],
    ["trust", 150],
    ["trust", "50"],
    ["id", "not-a-person"],
  ])("rejects %s=%s through raw and envelope paths", (field, value) => {
    const input = structuredClone(fixture);
    Object.assign(input.state.relations[0], { [field]: value });
    const before = structuredClone(input);
    expect(() => normalizeGameState(input.state)).toThrow();
    expect(() => importSave(JSON.stringify(input))).toThrow();
    expect(input).toEqual(before);
  });
  it("accepts inclusive bounds, fractions and relations to deceased people", () => {
    const input = structuredClone(fixture);
    input.state.people[0].alive = false;
    Object.assign(input.state.relations[0], { closeness: 0, trust: 100 });
    Object.assign(input.state.relations[1], { closeness: 12.5, trust: 0.01 });
    expect(importSave(JSON.stringify(input))).toEqual(input.state);
  });
});

describe("P0-2 envelope identification is independent of state validation", () => {
  const state = fixture.state;
  it.each([
    { ...fixture, formatVersion: 99 },
    { ...fixture, formatVersion: "1" },
    { ...fixture, format: "another-game" },
    { format: "life-simulator", state },
    { formatVersion: 1, state },
    { ...fixture, state: null },
    { ...fixture, state: [] },
    { ...fixture, state: { ...state, version: 99 } },
    { ...state, ...fixture, formatVersion: 99 },
    { ...state, ...fixture },
    { ...state, formatVersion: 99 },
    { ...state, state },
    { ...fixture, state: { ...state, format: "life-simulator" } },
  ])("rejects unsupported, malformed or hybrid input %#", (input) => {
    expect(() => importSave(JSON.stringify(input))).toThrow();
  });
  it("raw autosave validation cannot bypass the envelope checks", () => {
    expect(() =>
      normalizeGameState({ ...state, ...fixture, formatVersion: 99 }),
    ).toThrow();
    expect(() => normalizeGameState(fixture)).toThrow();
  });
  it("preserves raw v1, supported envelopes and unrelated metadata/extensions", () => {
    expect(importSave(JSON.stringify(state))).toEqual(state);
    expect(importSave(text)).toEqual(state);
    expect(
      importSave(JSON.stringify({ ...fixture, exportedBy: "test" })),
    ).toEqual(state);
    const extended = {
      ...importSave(text),
      extensionForTest: { note: "retain" },
    };
    expect(importSave(exportSave(extended))).toEqual(extended);
    expect(JSON.parse(exportSave(importSave(text)))).toEqual(fixture);
  });
});

it("legacy defaults remain idempotent and never invent a birth seed", () => {
  // Same observed missing-field compatibility as existing migration tests;
  // this is not claimed to be a historical release's complete save schema.
  const input: Partial<typeof fixture.state> = structuredClone(fixture.state);
  delete input.birthSeed;
  delete input.savings;
  const normalized = normalizeGameState(input);
  expect(normalized.birthSeed).toBeNull();
  expect(normalized.savings).toBe(0);
  expect(normalized.seed).toBe(input.seed);
  expect(normalized.pending).toEqual(input.pending);
  expect(normalizeGameState(normalized)).toEqual(normalized);
  expect(input).not.toHaveProperty("savings");
});

it("invalid slot loads and failed imports leave all original storage bytes intact", () => {
  const data = new Map<string, string>([[SAVE, JSON.stringify(fixture.state)]]);
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const s = importSave(text);
  saveSlot(storage, 1, s);
  saveSlot(storage, 2, newGame(42, {}, "coastal"));
  const bad = structuredClone(fixture);
  bad.state.relations[0].trust = 150;
  data.set(`${SAVE}-slot-3`, JSON.stringify(bad));
  const before = [...data];
  expect(() => loadSlot(storage, 3)).toThrow();
  expect(() =>
    importSave(JSON.stringify({ ...fixture, formatVersion: 99 })),
  ).toThrow();
  expect([...data]).toEqual(before);
  expect(loadSlot(storage, 1)).toEqual(s);
  expect(loadSlot(storage, 2).worldId).toBe("coastal");
});

it.each(["modern", "coastal"])(
  "%s generated saves preserve pending, queues, delayed effects and determinism",
  (world) => {
    const events = validateEvents(world === "modern" ? modern : coastal);
    let uninterrupted = newGame(20261016, {}, world);
    uninterrupted.autoChoices = true;
    let resumed = importSave(exportSave(uninterrupted));
    for (let month = 0; month < 300; month++) {
      uninterrupted = advanceMonth(uninterrupted, events);
      resumed = importSave(exportSave(advanceMonth(resumed, events)));
      expect(resumed).toEqual(uninterrupted);
      uninterrupted = autoResolve(uninterrupted, events);
      resumed = autoResolve(resumed, events);
    }
    expect(resumed).toEqual(uninterrupted);
  },
);
