import { it, expect } from "vitest";
import {
  newGame,
  advanceMonth,
  autoResolve,
  meetPerson,
  choose,
  startRomance,
  normalizeGameState,
} from "../src/engine";
import {
  prepareNpcAgency,
  npcAgencyMonth,
  npcReply,
  npcFreeHours,
  selectGoal,
} from "../src/npcAgency";
import { createRandomStreams } from "../src/randomStreams";
import { interact, feelings } from "../src/directedRelations";
import { recordNpcFact, npcFact, shareWorldEvents } from "../src/npcEvents";
import fixture from "./fixtures/current-v1-club-pending.json";
function society(seed = 42, world = "modern") {
  const s = newGame(seed, {}, world);
  s.month = 300;
  s.education = "working";
  for (let i = 0; i < 4; i++) {
    const id = "npc-" + i;
    s.people.push({
      id,
      name: id,
      kind: "friend",
      birthMonth: 0,
      alive: true,
      health: 85,
      occupation: "employed",
      values: i % 2 ? "career" : "family",
      personality: i % 2 ? "ambitious" : "kind",
      gender: i % 2 ? "female" : "male",
      orientation: "bisexual",
    });
    s.relations.push({ id, closeness: 60, trust: 60, lastContactMonth: 0 });
  }
  return s;
}
it("initializes only forward observations, adopts existing stream and leaves legacy fixture untouched", () => {
  expect(normalizeGameState(fixture.state)).toEqual(fixture.state);
  const s = society();
  const people = structuredClone(s.people);
  s.randomStreams = createRandomStreams(12);
  s.randomStreams.states.npcRelations = 123;
  prepareNpcAgency(s);
  expect(s.randomStreams.states.npcRelations).toBe(123);
  expect(s.npcAgency!.streamSource).toBe("existing");
  expect(s.people).toEqual(people);
  expect(s.npcAgency!.actors["npc-0"].lastTick).toBeNull();
  expect(s.npcAgency!.actors["npc-0"].sinceMonth).toBe(300);
});
it("goals follow health, values and employment instead of a fixed plot", () => {
  const p = society().people.at(-1)!;
  expect(selectGoal({ ...p, illness: true }, 0)).toBe("health");
  expect(selectGoal({ ...p, occupation: "unemployed" }, 0)).toBe("stability");
  expect(selectGoal({ ...p, values: "family" }, 0)).toBe("family");
  expect(selectGoal({ ...p, values: "freedom" }, 0)).toBe("independence");
});
it("NPCs change jobs and relationships without player action; all time stays within budget", () => {
  const s = society();
  s.people[2].occupation = "unemployed";
  const old = s.seed;
  for (let i = 0; i < 120; i++) {
    s.month++;
    npcAgencyMonth(s);
    for (const a of Object.values(s.npcAgency!.actors))
      expect(a.usedHours).toBeLessThanOrEqual(a.availableHours);
  }
  expect(s.people[2].occupation).toBe("employed");
  expect(
    s.relationshipModel!.edges.some(
      (e) => e.from !== "player" && e.to !== "player",
    ),
  ).toBe(true);
  expect(s.worldHistory!.events.some((e) => e.kind === "npc.social")).toBe(
    true,
  );
  expect(s.seed).toBe(old); // Isolated new stream only.
});
it("can refuse invitations and romance, spends attempt time once and keeps private goals private", () => {
  const s = society();
  s.people[2].illness = true;
  const before = s.stats;
  const r = meetPerson(s, "npc-0", "talk");
  expect(r.history[0].text).toContain("断られた");
  expect(r.lastActionMonth).toBe(s.month);
  expect(r.timeBudget!.activities.at(-1)!.hours).toBe(2);
  expect(r.stats).toEqual(before);
  expect(meetPerson(r, "npc-0", "talk")).toEqual(r);
  const event = recordNpcFact(
    r,
    "内心の詳細",
    npcFact("npc.goal", ["npc-0"], { goal: "health", disclosable: false }),
  );
  shareWorldEvents(r, "npc-0");
  expect(event.pcKnowledge).toBeUndefined();
  expect(r.history.some((e) => e.text.includes("内心の詳細"))).toBe(false);
  const romance = society();
  romance.identity = { gender: "male", orientation: "bisexual" };
  romance.people[3].values = "freedom";
  const pending = startRomance(romance, "npc-1");
  expect(pending.pending).not.toBeNull();
  const refused = choose(pending, 0, []);
  expect(refused.partnerId).toBeNull();
  expect(refused.timeBudget!.activities.at(-1)!.hours).toBe(2);
  expect(
    refused.history.some((e) => e.text.includes("相談は成立しなかった")),
  ).toBe(true);
});
it("inbound feelings matter independently and NPCs can end relationships", () => {
  const s = society();
  prepareNpcAgency(s);
  interact(s, s.month, "npc-0", "player", "talk");
  const incoming = s.relationshipModel!.edges.find(
    (e) => e.from === "npc-0" && e.to === "player",
  )!;
  incoming.liking = 0;
  s.partnerId = "npc-0";
  s.people[2].partnerId = "player";
  expect(npcReply(s, "npc-0", "date").accepted).toBe(false);
  npcAgencyMonth(s);
  expect(s.partnerId).toBeNull();
  expect(s.people[2].partnerId).toBeNull();
  expect(s.history.some((e) => e.text.includes("関係を解消"))).toBe(true);
  expect(feelings(s, "npc-0", "player").liking).toBe(0);
});
it("same-month calls do not reset budgets, resurrect dead actors or repeat actions", () => {
  const s = society();
  npcAgencyMonth(s);
  const once = structuredClone(s);
  npcAgencyMonth(s);
  expect(s).toEqual(once);
  const p = s.people[2];
  p.alive = false;
  p.deathMonth = s.month;
  const frozen = structuredClone(p);
  const actor = structuredClone(s.npcAgency!.actors[p.id]);
  s.month++;
  npcAgencyMonth(s);
  expect(p).toEqual(frozen);
  expect(s.npcAgency!.actors[p.id]).toEqual(actor);
  expect(npcFreeHours(s, p.id)).toBe(0);
});
it.each(["modern", "coastal"])(
  "replays goals, streams, relations and history across saves in %s",
  (world) => {
    let a = society(42, world);
    a.autoChoices = true;
    for (let i = 0; i < 48; i++) {
      let b = normalizeGameState(a);
      a = autoResolve(advanceMonth(a, []), []);
      b = autoResolve(advanceMonth(b, []), []);
      expect(b).toEqual(a);
    }
    const invalid = structuredClone(a);
    invalid.npcAgency!.actors.missing = { ...invalid.npcAgency!.actors.mother };
    expect(() => normalizeGameState(invalid)).toThrow();
  },
);
it("orders new autonomous decisions by stable person ID rather than array order", () => {
  const a = society(),
    b = structuredClone(a);
  b.people.reverse();
  npcAgencyMonth(a);
  npcAgencyMonth(b);
  expect(b.npcAgency).toEqual(a.npcAgency);
  expect(b.randomStreams).toEqual(a.randomStreams);
  expect(b.relationshipModel).toEqual(a.relationshipModel);
  expect(b.worldHistory).toEqual(a.worldHistory);
});
it("a reproducible cohort forms reciprocal NPC romances without PC matchmaking", () => {
  let formed = 0;
  const seeds = [42, 7919, 15838, 23757, 31676, 39595, 47514, 55433];
  for (const seed of seeds) {
    const s = society(seed);
    for (const p of s.people.filter((p) => p.kind === "friend")) {
      p.values = "family";
      p.personality = "kind";
    }
    for (let i = 0; i < 240; i++) {
      s.month++;
      npcAgencyMonth(s);
    }
    formed +=
      s.worldHistory?.events.filter((e) => e.kind === "npc.dating").length ?? 0;
    for (const p of s.people)
      if (p.partnerId && p.partnerId !== "player")
        expect(s.people.find((x) => x.id === p.partnerId)?.partnerId).toBe(
          p.id,
        );
  }
  console.log(
    "NPC_ROMANCE_COHORT",
    JSON.stringify({ seeds, months: 240, formed }),
  );
  expect(formed).toBeGreaterThan(0);
});
it("retains prior public information and does not leak subsequent private changes through the profile", async () => {
  const { publicNpc, publicNpcLinks } = await import("../src/npcKnowledgeView");
  const s = society();
  prepareNpcAgency(s);
  const p = s.people[2];
  const before = publicNpc(s, p);
  p.occupation = "unemployed";
  p.childCount = 3;
  p.spouseId = "npc-1";
  s.npcLinks.push({ a: p.id, b: "npc-1", kind: "married", since: s.month });
  const event = recordNpcFact(
    s,
    "私的な就職情報",
    npcFact("npc.employment", [p.id], { occupation: "unemployed" }),
  );
  expect(publicNpc(s, p).occupation).toBe(before.occupation);
  expect(publicNpc(s, p).childCount).toBe(before.childCount);
  expect(publicNpcLinks(s)).toEqual([]);
  shareWorldEvents(s, p.id);
  expect(event.pcKnowledge).toBeDefined();
  expect(publicNpc(s, p).occupation).toBe("unemployed");
  expect(normalizeGameState(s)).toEqual(s);
});
it("does not overwrite the already-visible baseline with older known employment history", async () => {
  const { publicNpc } = await import("../src/npcKnowledgeView");
  const s = society();
  s.month = 100;
  recordNpcFact(
    s,
    "以前の仕事",
    npcFact(
      "npc.employment",
      ["npc-0"],
      { occupation: "unemployed" },
      "public",
    ),
  );
  s.month = 300;
  s.people[2].occupation = "employed";
  prepareNpcAgency(s);
  expect(publicNpc(s, s.people[2]).occupation).toBe("employed");
});
it("connection goals can recontact a long-unseen PC and quiet NPCs select conversation", () => {
  const s = society(7919);
  s.people[3].personality = "quiet";
  s.people[3].values = "career";
  s.relations.find((r) => r.id === "npc-1")!.lastContactMonth = 0;
  for (let i = 0; i < 240; i++) {
    s.month++;
    npcAgencyMonth(s);
  }
  expect(
    s.relations.find((r) => r.id === "npc-1")!.lastContactMonth,
  ).toBeGreaterThan(300);
  expect(feelings(s, "npc-1", "player").trust).toBeGreaterThan(50);
});

it("automatic choices preserve the input and its nested history, streams and relationship state", () => {
  const s = society();
  prepareNpcAgency(s);
  s.autoChoices = true;
  s.pending = {
    eventId: "input",
    text: "choice",
    choices: [
      { label: "a", effects: [] },
      { label: "b", effects: [] },
    ],
  };
  const snapshot = structuredClone(s);
  autoResolve(s, []);
  expect(s).toEqual(snapshot);
});

it("choice continuation keeps full nested isolation from the caller's saved state", () => {
  const s = society();
  prepareNpcAgency(s);
  s.monthStarted = true;
  s.pending = {
    eventId: "input",
    text: "choice",
    choices: [{ label: "a", effects: [] }],
  };
  const snapshot = structuredClone(s);
  const result = choose(s, 0, []);
  result.npcAgency!.actors.mother.fatigue = 99;
  result.history[0].text = "changed in returned state";
  expect(s).toEqual(snapshot);
});
it("ordinary repeat contacts near the numeric cap are not reported as new relationship stages", () => {
  const s = society(42);
  prepareNpcAgency(s);
  const r = s.relations[0];
  r.closeness = 100;
  r.trust = 100;
  interact(s, s.month, "mother", "player", "spend");
  for (let i = 0; i < 120; i++) {
    s.month++;
    r.closeness = 99.9;
    npcAgencyMonth(s);
  }
  const repeats =
    s.worldHistory?.events.filter(
      (e) => e.kind === "npc.contact" && e.personIds.includes("mother"),
    ) ?? [];
  expect(repeats).toEqual([]);
  expect(r.lastContactMonth).toBeGreaterThan(300);
});
it("supports safe custom IDs that shadow Object methods without reading inherited state", () => {
  const s = society();
  s.people[2].id = "toString";
  s.relations[2].id = "toString";
  prepareNpcAgency(s);
  expect(Object.entries(s.npcAgency!.actors).find(([id]) => id === "toString")![1].sinceMonth).toBe(300);
  expect(normalizeGameState(s)).toEqual(s);
});
it.each(["__proto__", "constructor", "prototype", "player"])(
  "rejects reserved NPC identifier %s before initializing new records",
  (id) => {
    const s = society();
    s.people[2].id = id;
    s.relations[2].id = id;
    expect(() => normalizeGameState(s)).toThrow();
  },
);
it("uses existing shared-child references for NPC family obligations without rewriting old counts", async () => {
  const {publicNpc}=await import("../src/npcKnowledgeView");
  const s=society();const p=s.people[2];p.childCount=0;
  prepareNpcAgency(s);const before=npcFreeHours(s,p.id);
  s.people.push({id:"shared-child",name:"共通の子",kind:"family",birthMonth:299,alive:true,gender:"female",orientation:"heterosexual",parentIds:["player",p.id]});
  expect(npcFreeHours(s,p.id)).toBe(before-8);
  expect(publicNpc(s,p).childCount).toBe(1);
  expect(p.childCount).toBe(0);
  expect(normalizeGameState(s)).toEqual(s);
});
