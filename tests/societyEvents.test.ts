import { expect, it } from "vitest";
import fixture from "./fixtures/current-v1-club-pending.json";
import {
  newGame,
  advanceMonth,
  autoResolve,
  normalizeGameState,
} from "../src/engine";
import {
  societyEventsMonth,
  socialCandidates,
  noteSocietyChoice,
} from "../src/societyEvents";
import { createSociety } from "../src/society";
import { recordWorldEvent } from "../src/worldHistory";
import { npcReply } from "../src/npcAgency";
import { importSave, exportSave } from "../src/saves";
function run(world = "modern") {
  let s = newGame(7919, {}, world);
  for (let i = 0; i < 180; i++) s = autoResolve(advanceMonth(s, []), []);
  return s;
}
it.each(["modern", "coastal"])(
  "events, pause and save continuation are deterministic: %s",
  (world) => {
    let a = run(world),
      b = importSave(exportSave(a));
    expect(a.societyEvents).toBeDefined();
    for (let i = 0; i < 24; i++) {
      a = autoResolve(advanceMonth(a, []), []);
      b = autoResolve(advanceMonth(b, []), []);
      expect(b).toEqual(a);
    }
    const old = structuredClone(a);
    societyEventsMonth(a);
    expect(a).toEqual(old);
    expect(
      a.worldHistory?.events.some((e) => e.kind.startsWith("society.")),
    ).toBe(true);
  },
);
it("distinguishes random, condition and causal history with cooldowns", () => {
  const s = newGame(1);
  s.month = 24;
  s.society!.axes.publicHealth = 40;
  societyEventsMonth(s);
  const candidates = socialCandidates(s);
  // Use a fresh global cooldown to inspect eligibility without forcing production RNG outcomes.
  s.societyEvents!.lastEventMonth = null;
  expect(
    socialCandidates(s).some((c) => c.definition.id === "sanitation"),
  ).toBe(true);
  expect(
    socialCandidates(s).some((c) => c.definition.id === "supply-recovery"),
  ).toBe(false);
  const e = recordWorldEvent(s, {
    month: 12,
    kind: "society.supply-delay",
    personIds: [],
    data: {},
    visibility: "public",
  });
  s.societyEvents!.latest["supply-delay"] = { month: 12, eventId: e.id };
  expect(
    socialCandidates(s).find((c) => c.definition.id === "supply-recovery")!
      .causes,
  ).toEqual([e.id]);
  s.societyEvents!.lastEventMonth = 24;
  expect(socialCandidates(s)).toEqual([]);
});
it("records a new actual community choice as a cause and never invents old contributions", () => {
  const s = newGame(4);
  s.month = 100;
  s.flags.community = true;
  societyEventsMonth(s);
  s.societyEvents!.lastEventMonth = null;
  expect(
    socialCandidates(s).some((c) => c.definition.id === "community-result"),
  ).toBe(false);
  const e = recordWorldEvent(s, {
    month: 75,
    kind: "pc.choice",
    personIds: ["player"],
    data: { eventId: "community_project", choiceIndex: 0 },
    visibility: "participants",
    pcKnowledge: { month: 75, source: "direct" },
  });
  noteSocietyChoice(s, e);
  expect(
    socialCandidates(s).find((c) => c.definition.id === "community-result")!
      .causes,
  ).toEqual([e.id]);
});
it("does not auto-disclose events or consume legacy/NPC randomness and bounds occurrence rate", () => {
  const s = newGame(1);
  const seed = s.seed;
  s.randomStreams = {
    version: 1,
    states: { pcHealth: 1, npcRelations: 2, events: 3, worldSociety: 4 },
  };
  const streams = structuredClone(s.randomStreams);
  for (let month = 1; month <= 1200; month++) {
    s.month = month;
    societyEventsMonth(s);
  }
  const events = s.worldHistory?.events ?? [];
  expect(events.length).toBeGreaterThan(0);
  for (let i = 1; i < events.length; i++)
    expect(events[i].month - events[i - 1].month).toBeGreaterThanOrEqual(12);
  expect(events.every((e) => !e.pcKnowledge)).toBe(true);
  expect(s.history).toHaveLength(1);
  expect(s.seed).toBe(seed);
  expect(s.randomStreams).toEqual(streams);
});
it("uses fantasy event text and conditions without pretending a playable fantasy world exists", () => {
  const s = newGame(1);
  s.society = createSociety("fantasy", 0, 1, false);
  for (let i = 1; i <= 240; i++) {
    s.month = i;
    societyEventsMonth(s);
  }
  expect(
    s.worldHistory?.events.some(
      (e) =>
        String(e.data.text).includes("街道") ||
        String(e.data.text).includes("井戸") ||
        String(e.data.text).includes("評議会"),
    ),
  ).toBe(true);
});
it("shared unsafe-outing gate covers PC and NPC invitations, but not conversations", () => {
  const s = newGame(1);
  s.society!.axes.safety = 10;
  expect(npcReply(s, "mother", "spend").reason).toContain("治安");
  expect(npcReply(s, "mother", "spend", "father").reason).toContain("治安");
  expect(npcReply(s, "mother", "talk").reason).not.toContain("治安");
});
it("rejects invalid causal references and unsupported event versions", () => {
  const s = run();
  expect(() =>
    normalizeGameState({
      ...s,
      societyEvents: { ...s.societyEvents, version: 2 },
    }),
  ).toThrow();
  expect(() =>
    normalizeGameState({
      ...s,
      societyEvents: {
        ...s.societyEvents,
        latest: { "supply-delay": { eventId: "world-999999", month: s.month } },
      },
    }),
  ).toThrow();
});

it("preserves an old pending community choice without creating an extension before its boundary", () => {
  let s = importSave(JSON.stringify(fixture));
  s.pending = {
    eventId: "community_project",
    text: "参加するか",
    choices: [{ label: "参加", effects: [], setFlag: "community" }],
  };
  s.autoChoices = true;
  s = autoResolve(s, []);
  expect(s.society).toBeUndefined();
  expect(s.societyEvents).toBeUndefined();
  expect(importSave(exportSave(s))).toEqual(s);
  const next = advanceMonth(s, []);
  expect(next.society!.legacyBaseline).toBe(true);
});

it("applies actual bounded effects and stores real causal IDs for all three event kinds", () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 800; seed++) {
    const s = newGame(seed);
    s.month = 24;
    s.society!.axes.publicHealth = 40;
    s.society!.axes.stability = 40;
    const cause = recordWorldEvent(s, {
      month: 12,
      kind: "society.supply-delay",
      personIds: [],
      visibility: "public",
      data: {},
    });
    const choice = recordWorldEvent(s, {
      month: 0,
      kind: "pc.choice",
      personIds: ["player"],
      visibility: "participants",
      data: { eventId: "community_project", choiceIndex: 0 },
      pcKnowledge: { month: 0, source: "direct" },
    });
    s.flags.community = true;
    s.societyEvents = {
      version: 1,
      startMonth: 0,
      lastTick: 23,
      lastEventMonth: 12,
      latest: { "supply-delay": { month: 12, eventId: cause.id } },
      contribution: { month: 0, eventId: choice.id },
    };
    const before = structuredClone(s.society!.axes);
    societyEventsMonth(s);
    const e = s.worldHistory!.events.at(-1)!;
    if (!e.kind.startsWith("society.") || e.id === cause.id) continue;
    seen.add(e.kind);
    const changes = e.data.effects as Record<string, number>;
    for (const [key, delta] of Object.entries(changes))
      expect(
        s.society!.axes[key as keyof typeof before] -
          before[key as keyof typeof before],
      ).toBe(delta);
    if (e.kind === "society.supply-recovery")
      expect(e.data.causes).toEqual([cause.id]);
    if (e.kind === "society.community-result")
      expect(e.data.causes).toEqual([choice.id]);
  }
  expect(seen).toEqual(
    new Set([
      "society.sanitation",
      "society.council-review",
      "society.supply-recovery",
      "society.community-result",
    ]),
  );
});
it("random supply shocks really change the economy, with no journal disclosure", () => {
  let found = false;
  for (let seed = 1; seed <= 200; seed++) {
    const s = newGame(seed);
    s.month = 1;
    const before = s.society!.axes.economy;
    societyEventsMonth(s);
    if (s.worldHistory?.events[0]?.kind === "society.supply-delay") {
      expect(s.society!.axes.economy).toBe(before - 2);
      expect(s.history).toHaveLength(1);
      found = true;
      break;
    }
  }
  expect(found).toBe(true);
});
