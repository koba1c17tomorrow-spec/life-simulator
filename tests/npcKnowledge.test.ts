import { expect, it } from "vitest";
import { newGame, advanceMonth, choose, meetPerson } from "../src/engine";
import { npcMonth } from "../src/relationships";
import { recordNpcFact, npcFact, learnWorldEvent } from "../src/npcEvents";
import { importSave, exportSave } from "../src/saves";
import fixture from "./fixtures/current-v1-club-pending.json";

it("private NPC facts never enter history/timeline by matching prose", () => {
  const s = newGame();
  const history = structuredClone(s.history),
    timeline = structuredClone(s.timeline);
  const e = recordNpcFact(
    s,
    "【就職】あなたと母の名前があるが非公開の事情",
    npcFact("npc.employment", ["father"], { occupation: "employed" }),
  );
  expect(s.history).toEqual(history);
  expect(s.timeline).toEqual(timeline);
  expect(e.pcKnowledge).toBeUndefined();
  expect(learnWorldEvent(s, e.id, "direct")).toBe(false);
  expect(learnWorldEvent(s, e.id, "public")).toBe(false);
  expect(importSave(exportSave(s)).worldHistory).toEqual(s.worldHistory);
});
it("direct encounters and public facts cross an explicit one-time knowledge boundary", () => {
  const s = newGame();
  const direct = recordNpcFact(
    s,
    "父と出会いについて話した",
    npcFact("npc.contact", ["player", "father"], {}, "participants"),
  );
  const pub = recordNpcFact(
    s,
    "町の公知の出来事",
    npcFact("world.notice", [], { category: "notice" }, "public"),
  );
  expect(direct.pcKnowledge).toEqual({ month: 0, source: "direct" });
  expect(pub.pcKnowledge?.source).toBe("public");
  const before = structuredClone(s.history);
  expect(learnWorldEvent(s, pub.id, "public")).toBe(false);
  expect(s.history).toEqual(before);
  expect(s.history.some((e) => e.worldEventId === direct.id)).toBe(true);
});
it("talk reports a participant's own facts later, preserving both times without repeats", () => {
  const s = newGame();
  const e = recordNpcFact(
    s,
    "父が就職した。",
    npcFact("npc.employment", ["father"], { occupation: "employed" }),
  );
  expect(learnWorldEvent(s, e.id, "reported", "mother")).toBe(false);
  s.month = 1;
  const a = meetPerson(importSave(exportSave(s)), "father", "talk");
  const known = a.worldHistory!.events[0];
  expect(known.month).toBe(0);
  expect(known.pcKnowledge).toEqual({
    month: 1,
    source: "reported",
    informantId: "father",
  });
  expect(a.history[0].month).toBe(1);
  expect(a.history[0].text).toContain("出来事: 0か月目");
  const later = meetPerson(
    advanceMonth(importSave(exportSave(a)), []),
    "father",
    "talk",
  );
  expect(later.history.filter((log) => log.worldEventId === e.id)).toHaveLength(
    1,
  );
});
it("a dead person cannot report and spending time does not automatically expose all private facts", () => {
  const s = newGame();
  const e = recordNpcFact(s, "父の事情", npcFact("npc.employment", ["father"]));
  expect(
    meetPerson(s, "father", "spend").worldHistory!.events[0].pcKnowledge,
  ).toBeUndefined();
  s.people[1].alive = false;
  expect(learnWorldEvent(s, e.id, "reported", "father")).toBe(false);
});
it.each(["modern", "coastal"])(
  "%s monthly NPC death is internal unless the notification rule applies",
  (world) => {
    const s = newGame(42, {}, world);
    s.month = 300;
    s.people.push({
      id: "remote",
      name: "遠い知人",
      kind: "friend",
      birthMonth: -1200,
      alive: true,
      movedAway: true,
    });
    s.relations.push({
      id: "remote",
      closeness: 5,
      trust: 5,
      lastContactMonth: 0,
    });
    const next = advanceMonth(s, []);
    const death = next.worldHistory!.events.find(
      (e) => e.kind === "npc.death" && e.personIds.includes("remote"),
    )!;
    expect(death).toBeDefined();
    expect(death.data.deathMonth).toBe(301);
    expect(death.pcKnowledge).toBeUndefined();
    expect(next.history.some((log) => log.text.includes("遠い知人"))).toBe(
      false,
    );
    expect(next.timeline.some((log) => log.text.includes("遠い知人"))).toBe(
      false,
    );
    expect(next.people.find((p) => p.id === "remote")!.alive).toBe(false);
    expect(importSave(exportSave(next))).toEqual(next);
  },
);
it("close family death gets a notification, preserving the death fact and existing relation", () => {
  const s = newGame();
  s.month = 300;
  s.people[0].birthMonth = -1200;
  const r = structuredClone(s.relations[0]);
  npcMonth(
    s,
    () => 1,
    (text, fact) => recordNpcFact(s, text, fact),
  );
  const e = s.worldHistory!.events.find((e) => e.kind === "npc.death")!;
  expect(e.pcKnowledge?.source).toBe("reported");
  expect(s.history.some((log) => log.worldEventId === e.id)).toBe(true);
  expect(s.relations[0]).toEqual(r);
});
it("pending save/reload cannot duplicate an already-known fact and direct PC choices remain", () => {
  const s = importSave(JSON.stringify(fixture));
  const e = recordNpcFact(
    s,
    "公知の知らせ",
    npcFact("world.notice", [], {}, "public"),
  );
  const paused = advanceMonth(importSave(exportSave(s)), []);
  expect(paused).toEqual(s);
  const selected = choose(paused, 0, []);
  expect(
    selected.history.filter((log) => log.worldEventId === e.id),
  ).toHaveLength(1);
  expect(selected.history.some((log) => log.text.includes("文化・芸術"))).toBe(
    true,
  );
  expect(
    selected.worldHistory!.events.filter((e) => e.kind === "pc.choice"),
  ).toHaveLength(1);
  expect(choose(importSave(exportSave(selected)), 0, [])).toEqual(selected);
});
it("legacy history survives verbatim without invented knowledge or retroactive world facts", () => {
  const s = importSave(JSON.stringify(fixture));
  expect(s.history).toEqual(fixture.state.history);
  expect(s.timeline).toEqual(fixture.state.timeline);
  expect(s.worldHistory).toBeUndefined();
});
