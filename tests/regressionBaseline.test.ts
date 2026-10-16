import { describe, expect, it } from "vitest";
import {
  advanceMonth,
  choose,
  meetPerson,
  newGame,
  takeAction,
  type EventDefinition,
  type GameState,
} from "../src/engine";
import { exportSave, importSave, loadSlot, SAVE, saveSlot } from "../src/saves";
import { validateEvents } from "../src/content";
import { npcMonth } from "../src/relationships";
import modern from "../public/worlds/modern/events.json";
import coastal from "../public/worlds/coastal/events.json";
import fixture from "./fixtures/current-v1-club-pending.json";

// The fixture is an unedited export from the existing engine, not a proposed
// old schema. See fixtures/README.md for provenance and regeneration.
const fixtureText = JSON.stringify(fixture);
const worlds = {
  modern: validateEvents(modern),
  coastal: validateEvents(coastal),
};
type Operation =
  | { kind: "month" }
  | { kind: "choose"; index: number }
  | { kind: "action"; action: "study" | "rest" }
  | { kind: "contact"; id: string; mode: "talk" | "spend" };
function apply(s: GameState, op: Operation, events: EventDefinition[]) {
  switch (op.kind) {
    case "month":
      return advanceMonth(s, events);
    case "choose":
      return choose(s, op.index, events);
    case "action":
      return takeAction(s, op.action);
    case "contact":
      return meetPerson(s, op.id, op.mode);
  }
}
const actions: Operation[] = [
  { kind: "action", action: "rest" },
  { kind: "contact", id: "mother", mode: "talk" },
  { kind: "action", action: "study" },
  { kind: "contact", id: "father", mode: "spend" },
];

describe("P0-1 mixed-operation replay (same current rules, no golden random draws)", () => {
  for (const world of ["modern", "coastal"] as const) {
    it.each([42, 20261016])(
      `${world}: seed %i replays choices/actions and save/resume`,
      (seed) => {
        const identity = { gender: "female", orientation: "bisexual" } as const;
        const events = worlds[world];
        let original = newGame(seed, identity, world);
        let replay = newGame(seed, identity, world);
        let resumed = newGame(seed, identity, world);
        const operations: Operation[] = [];
        let choices = 0,
          savedPending = 0,
          savedAction = 0;
        const decisionIds: string[] = [];
        const execute = (op: Operation) => {
          operations.push(op);
          original = apply(original, op, events);
          replay = apply(replay, op, events);
          resumed = apply(resumed, op, events);
          if (
            resumed.pending ||
            op.kind === "action" ||
            op.kind === "contact"
          ) {
            resumed = importSave(exportSave(resumed));
            if (resumed.pending) savedPending++;
            else savedAction++;
          }
          // Failure output contains the complete reproducible operation prefix.
          const evidence = JSON.stringify({
            seed,
            world,
            identity,
            operations,
          });
          expect(replay, evidence).toEqual(original);
          expect(resumed, evidence).toEqual(original);
        };
        for (let month = 0; month < 160; month++) {
          expect(original.finished).toBe(false);
          execute(actions[month % actions.length]);
          execute({ kind: "month" });
          let guard = 0;
          while (original.pending) {
            expect(++guard).toBeLessThan(10);
            decisionIds.push(original.pending.eventId);
            execute({
              kind: "choose",
              index: choices++ % original.pending.choices.length,
            });
          }
        }
        expect(original.month).toBe(160);
        expect(decisionIds).toContain("club-plan");
        expect(choices).toBeGreaterThan(0);
        expect(savedPending).toBeGreaterThan(0);
        expect(savedAction).toBeGreaterThan(0);
        expect(
          original.history.some((e) => e.text.includes("自主的に勉強")),
        ).toBe(true);
        expect(original.history.some((e) => e.text.includes("母と"))).toBe(
          true,
        );
      },
    );
  }
});

describe("P0-1 current save fixture and three-slot contract", () => {
  it("reads the real v1 export and raw autosave, preserving a pending month", () => {
    expect(SAVE).toBe("life-sim-modern-v1");
    expect(fixture.format).toBe("life-simulator");
    expect(fixture.formatVersion).toBe(1);
    expect(fixture.state.version).toBe(1);
    const s = importSave(fixtureText);
    expect(s).toEqual(fixture.state);
    expect(JSON.parse(exportSave(s))).toEqual({
      format: "life-simulator",
      formatVersion: 1,
      state: s,
    });
    expect(importSave(JSON.stringify(fixture.state))).toEqual(s);
    expect(importSave(exportSave(s))).toEqual(s);
    expect(s.pending?.eventId).toBe("club-plan");
    expect(advanceMonth(s, [])).toEqual(s);
    const chosen = choose(s, 0, []);
    expect(chosen.month).toBe(144);
    expect(chosen.pending).toBeNull();
    expect(chosen.monthStarted).toBe(false);
    expect(advanceMonth(chosen, []).month).toBe(145);
    expect(advanceMonth(importSave(exportSave(chosen)), [])).toEqual(
      advanceMonth(chosen, []),
    );
  });

  it("all three slots are independent snapshots, including overwrites and continued play", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, text: string) => {
        data.set(key, text);
      },
    };
    const a = importSave(fixtureText);
    const b = choose(a, 0, []);
    const c = advanceMonth(b, []);
    [a, b, c].forEach((s, i) => saveSlot(storage, i + 1, s));
    expect([...data.keys()]).toEqual(
      [1, 2, 3].map((n) => `life-sim-modern-v1-slot-${n}`),
    );
    const untouched = [data.get(`${SAVE}-slot-1`), data.get(`${SAVE}-slot-3`)];
    const replacement = advanceMonth(c, []);
    saveSlot(storage, 2, replacement);
    expect(loadSlot(storage, 2)).toEqual(replacement);
    expect([loadSlot(storage, 1), loadSlot(storage, 3)]).toEqual([a, c]);
    expect([data.get(`${SAVE}-slot-1`), data.get(`${SAVE}-slot-3`)]).toEqual(
      untouched,
    );
    const loaded = loadSlot(storage, 3);
    loaded.stats.money += 100;
    expect(loadSlot(storage, 3)).toEqual(c);
    expect(advanceMonth(loadSlot(storage, 3), [])).toEqual(advanceMonth(c, []));
    expect(data.has(SAVE)).toBe(false);
    for (const slot of [0, 4, 1.5, NaN]) {
      expect(() => saveSlot(storage, slot, a)).toThrow();
      expect(() => loadSlot(storage, slot)).toThrow();
    }
  });

  it("rejects broken/current-unsupported inputs without modifying the saved snapshots", () => {
    const original = fixtureText;
    for (const text of [
      "{",
      "null",
      JSON.stringify({ ...fixture.state, version: 99 }),
      JSON.stringify({ ...fixture, formatVersion: 99 }),
      JSON.stringify({ ...fixture, state: { ...fixture.state, seed: -1 } }),
    ])
      expect(() => importSave(text)).toThrow();
    expect(JSON.stringify(fixture)).toBe(original);
    expect(importSave(original)).toEqual(fixture.state);
  });
});

describe("P0-1 monthly suspension and action accounting", () => {
  it("pending/queued events and delayed effects survive save without repeating monthly systems", () => {
    const event: EventDefinition = {
      id: "baseline-choice",
      category: "growth",
      presentation: "choice",
      weight: 1,
      text: "回帰検証の選択",
      choices: [
        {
          label: "実行",
          effects: [{ stat: "money", delta: 123 }],
          setFlag: "baselineChosen",
          delayed: {
            months: 1,
            text: "回帰検証の翌月結果",
            effects: [{ stat: "money", delta: 456 }],
          },
        },
      ],
    };
    const tail: EventDefinition = {
      id: "baseline-tail",
      category: "health",
      presentation: "log",
      weight: 1,
      text: "回帰検証の残り処理",
      effects: [{ stat: "money", delta: 789 }],
    };
    // Use a real, already-started month; queue orchestration is controlled so
    // assertions do not depend on a random event being selected.
    const base = choose(importSave(fixtureText), 0, []);
    const queued = {
      ...base,
      monthStarted: true,
      queue: [event.id, tail.id],
      lastChoiceMonth: -999,
    };
    const events = [event, tail];
    const paused = advanceMonth(queued, events);
    expect(paused.pending?.eventId).toBe(event.id);
    expect(paused.queue).toEqual([tail.id]);
    for (let i = 0; i < 3; i++)
      expect(advanceMonth(paused, events)).toEqual(paused);
    const restored = importSave(exportSave(paused));
    const resolved = choose(restored, 0, events);
    expect(resolved.month).toBe(base.month);
    expect(resolved.pending).toBeNull();
    expect(resolved.monthStarted).toBe(false);
    expect(resolved.queue).toEqual([]);
    expect(resolved.stats.money).toBe(base.stats.money + 123 + 789);
    expect(resolved.flags.baselineChosen).toBe(true);
    expect(resolved.history.filter((e) => e.text === tail.text)).toHaveLength(
      1,
    );
    for (const key of [
      "seed",
      "monthlyIncome",
      "monthlyExpenses",
      "lastSocialTick",
      "origin",
      "people",
      "relations",
    ] as const)
      expect(resolved[key]).toEqual(base[key]);
    expect(choose(resolved, 0, events)).toEqual(resolved);
    expect(resolved.scheduled).toHaveLength(1);
    const next = advanceMonth(resolved, []);
    const withoutDelayed = advanceMonth({ ...resolved, scheduled: [] }, []);
    expect(next.stats.money).toBe(withoutDelayed.stats.money + 456);
    expect(next.month).toBe(base.month + 1);
    expect(next.scheduled).toHaveLength(0);
    const later = advanceMonth(importSave(exportSave(next)), []);
    expect(
      later.history.filter((e) => e.text.includes("回帰検証の翌月結果")),
    ).toHaveLength(1);
  });

  it("study/rest and contact share one action allowance, also after restoring a save", () => {
    const s = choose(importSave(fixtureText), 0, []);
    const study = takeAction(s, "study");
    expect(study.lastActionMonth).toBe(s.month);
    expect(meetPerson(importSave(exportSave(study)), "mother", "talk")).toEqual(
      study,
    );
    expect(takeAction(study, "rest")).toEqual(study);
    const following = advanceMonth(study, []);
    const contact = meetPerson(following, "mother", "talk");
    expect(contact.lastActionMonth).toBe(following.month);
    expect(contact.history.length).toBe(following.history.length + 1);
    expect(takeAction(contact, "study")).toEqual(contact);
    const pending = importSave(fixtureText);
    expect(takeAction(pending, "study")).toEqual(pending);
    expect(meetPerson(pending, "mother")).toEqual(pending);
  });

  it("age-year boundaries and finished lives have no extra month or side effects", () => {
    let s = newGame(42);
    for (let i = 0; i < 11; i++) s = advanceMonth(s, []);
    expect(advanceMonth(s, []).month).toBe(12);
    expect(advanceMonth(advanceMonth(s, []), []).month).toBe(13);
    const ended = { ...s, finished: true, deathCause: "回帰検証用の終了状態" };
    expect(advanceMonth(ended, [])).toEqual(ended);
    expect(takeAction(ended, "rest")).toEqual(ended);
    expect(meetPerson(ended, "mother")).toEqual(ended);
  });
});

it("already-deceased NPCs receive no further life tick or contact action", () => {
  const s = choose(importSave(fixtureText), 0, []);
  s.month = 601; // Avoid the independent annual link-generation branch.
  s.people = [{ ...s.people[0], alive: false, illness: true, health: 0 }];
  s.relations = s.relations.filter((r) => r.id === s.people[0].id);
  s.npcLinks = [];
  const before = structuredClone(s.people);
  npcMonth(
    s,
    () => {
      throw Error("A deceased NPC must not consume life-event randomness");
    },
    () => {
      throw Error("A deceased NPC must not generate a new life event");
    },
  );
  expect(s.people).toEqual(before);
  expect(meetPerson(s, s.people[0].id)).toEqual(s);
});
