import { expect, it } from "vitest";
import { newGame, normalizeGameState } from "../src/engine";
import { recordWorldEvent } from "../src/worldHistory";
import {
  readSocialNews,
  socialPresentation,
  newsReason,
} from "../src/socialPresentation";
import { remainingHours } from "../src/timeBudget";
import { exportSave, importSave } from "../src/saves";
function setup() {
  const s = newGame(42);
  s.month = 300;
  recordWorldEvent(s, {
    month: 295,
    kind: "society.supply-delay",
    personIds: [],
    visibility: "public",
    data: {
      text: "公表された供給の乱れ",
      effects: { economy: -2 },
      causes: [],
    },
  });
  recordWorldEvent(s, {
    month: 296,
    kind: "society.council-review",
    personIds: [],
    visibility: "private",
    data: { text: "非公開の協議内容" },
  });
  recordWorldEvent(s, {
    month: 296,
    kind: "npc.goal",
    personIds: ["mother"],
    visibility: "private",
    data: { text: "秘密の目標", disclosable: false },
  });
  return s;
}
it("never displays unobserved live axes, unpublished events or private NPC information", () => {
  const s = setup();
  const view = socialPresentation(s);
  expect(view.axes.every((a) => a.state === "未確認")).toBe(true);
  expect(view.events).toEqual([]);
  s.society!.axes.economy = 0;
  s.worldHistory!.events[1].data.text = "別の私的事実";
  expect(socialPresentation(s)).toEqual(view);
});
it("explicit news action charges once, preserves input and records distinct occurrence/knowledge dates", () => {
  const s = setup(),
    before = structuredClone(s),
    hours = remainingHours(s);
  const known = readSocialNews(s);
  expect(s).toEqual(before);
  expect(remainingHours(known)).toBe(hours - 2);
  expect(readSocialNews(known)).toBe(known);
  expect(socialPresentation(known).events[0]).toMatchObject({
    occurredMonth: 295,
    learnedMonth: 300,
    text: "公表された供給の乱れ",
  });
  expect(socialPresentation(known).events).toHaveLength(1);
  expect(known.worldHistory!.events[1].pcKnowledge).toBeUndefined();
  expect(known.worldHistory!.events[2].pcKnowledge).toBeUndefined();
  expect(importSave(exportSave(known))).toEqual(known);
  const view = socialPresentation(known);
  known.society!.axes.economy = 99;
  expect(socialPresentation(known)).toEqual(view);
});
it("shows only known causes and real player choices, not secret causal details", () => {
  const s = setup();
  const cause = recordWorldEvent(s, {
    month: 298,
    kind: "pc.choice",
    personIds: ["player"],
    visibility: "participants",
    pcKnowledge: { month: 298, source: "direct" },
    data: { choiceLabel: "長く関わってみる" },
  });
  recordWorldEvent(s, {
    month: 299,
    kind: "society.community-result",
    personIds: [],
    visibility: "public",
    data: {
      text: "活動の成果",
      causes: [cause.id],
      effects: { tolerance: 0.5 },
    },
  });
  const view = socialPresentation(readSocialNews(s));
  expect(view.events[0].explanation).toContain("長く関わってみる");
  s.worldHistory!.events.find((e) => e.id === cause.id)!.pcKnowledge =
    undefined;
  expect(socialPresentation(readSocialNews(s)).events[0].explanation).toContain(
    "未確認",
  );
});
it("blocks pending, completed, uninitialized and exhausted months without side effects", () => {
  const s = setup();
  for (const blocked of [
    { ...s, finished: true },
    { ...s, pending: { eventId: "x", text: "x", choices: [] } },
    { ...s, society: undefined },
    {
      ...s,
      timeBudget: {
        version: 1 as const,
        month: 300,
        allocations: { all: 720 },
        activities: [],
        overload: 0,
        legacyBaseline: false,
      },
    },
  ]) {
    expect(newsReason(blocked)).toBeTruthy();
    expect(readSocialNews(blocked)).toBe(blocked);
  }
});
it("rejects future, unsupported and out-of-range knowledge but preserves missing old knowledge", () => {
  const s = readSocialNews(setup());
  for (const patch of [
    { version: 2 },
    { observedMonth: 301 },
    { bands: { ...s.societyKnowledge!.bands, economy: 5 } },
  ])
    expect(() =>
      normalizeGameState({
        ...s,
        societyKnowledge: { ...s.societyKnowledge, ...patch },
      }),
    ).toThrow();
  expect(
    normalizeGameState({ ...s, societyKnowledge: undefined }).societyKnowledge,
  ).toBeUndefined();
});
