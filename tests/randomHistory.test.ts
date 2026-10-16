import { expect, it } from "vitest";
import {
  createRandomStreams,
  drawFromStream,
  STREAM_NAMES,
} from "../src/randomStreams";
import { recordWorldEvent } from "../src/worldHistory";
import { newGame, advanceMonth, choose } from "../src/engine";
import { exportSave, importSave } from "../src/saves";
import fixture from "./fixtures/current-v1-club-pending.json";

it("named streams initialize deterministically and cannot consume another stream", () => {
  const a = createRandomStreams(42),
    b = createRandomStreams(42);
  expect(a).toEqual(b);
  expect(new Set(Object.values(a.states)).size).toBe(STREAM_NAMES.length);
  for (let i = 0; i < 100; i++)
    expect(drawFromStream(a, "npcRelations")).toBeGreaterThanOrEqual(0);
  for (const name of ["pcHealth", "events", "worldSociety"] as const) {
    expect(a.states[name]).toBe(b.states[name]);
    expect(drawFromStream(a, name)).toBe(drawFromStream(b, name));
  }
});
it("stream continuation survives save without modifying the legacy random state", () => {
  const a = newGame(42);
  a.randomStreams = createRandomStreams(42);
  drawFromStream(a.randomStreams, "pcHealth");
  const b = importSave(exportSave(a));
  for (const name of STREAM_NAMES)
    expect(drawFromStream(a.randomStreams, name)).toBe(
      drawFromStream(b.randomStreams!, name),
    );
  expect(a.seed).toBe(42);
  expect(a).toEqual(b);
});
it("legacy fixture is unchanged and no independent past streams/history are invented", () => {
  const s = importSave(JSON.stringify(fixture));
  expect(s).toEqual(fixture.state);
  expect(s).not.toHaveProperty("randomStreams");
  expect(s).not.toHaveProperty("worldHistory");
});
it("structured world events are detached, uniquely identified and saved", () => {
  const s = newGame(42);
  const data = { transition: { from: "school", to: "work" } };
  const first = recordWorldEvent(s, {
    month: 0,
    kind: "test.transition",
    personIds: ["player"],
    data,
    visibility: "private",
  });
  data.transition.to = "mutated";
  expect(first.data.transition).toEqual({ from: "school", to: "work" });
  const resumed = importSave(exportSave(s));
  const second = recordWorldEvent(resumed, {
    month: 0,
    kind: "test.other",
    personIds: [],
    data: {},
    visibility: "public",
  });
  expect(second.id).not.toBe(first.id);
  expect(resumed.worldHistory!.events[0]).toEqual(first);
  expect(s.history).toHaveLength(1);
});
it("an actual saved decision is recorded once, without changing month or legacy seed", () => {
  const a = importSave(JSON.stringify(fixture));
  const b = choose(a, 0, []);
  expect(b.worldHistory?.events).toHaveLength(1);
  expect(b.worldHistory?.events[0].data.eventId).toBe("club-plan");
  expect(b.seed).toBe(a.seed);
  expect(b.month).toBe(a.month);
  expect(choose(importSave(exportSave(b)), 0, [])).toEqual(b);
  expect(advanceMonth(b, []).month).toBe(a.month + 1);
});
it.each([
  "streams-version",
  "streams-state",
  "history-version",
  "history-id",
  "knowledge-time",
])("rejects malformed extension: %s", (kind) => {
  const s = newGame(42);
  s.randomStreams = createRandomStreams(42);
  recordWorldEvent(s, {
    month: 0,
    kind: "test",
    personIds: [],
    data: {},
    visibility: "private",
  });
  const v = JSON.parse(exportSave(s));
  if (kind === "streams-version") v.state.randomStreams.version = 99;
  if (kind === "streams-state") v.state.randomStreams.states.pcHealth = -1;
  if (kind === "history-version") v.state.worldHistory.version = 99;
  if (kind === "history-id") v.state.worldHistory.events[0].id = "world-99";
  if (kind === "knowledge-time")
    v.state.worldHistory.events[0].pcKnowledge = { month: 1, source: "direct" };
  expect(() => importSave(JSON.stringify(v))).toThrow();
});
