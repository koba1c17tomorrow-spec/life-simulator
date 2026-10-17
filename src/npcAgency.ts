import {
  capturePublicProfile,
  ownEntry,
  type PublicProfile,
} from "./npcKnowledgeView";
import type { GameState } from "./engine";
import { relationLabel, type Person, type SocialState } from "./social";
import { createRandomStreams, drawFromStream } from "./randomStreams";
import {
  feelings,
  interact,
  registerInterest,
  observedAttitude,
} from "./directedRelations";
import { npcFact, recordNpcFact } from "./npcEvents";
import { chargeTime, remainingHours } from "./timeBudget";
import { practiceHours } from "./capabilities";
import { compatible } from "./identity";
export type Goal =
  | "health"
  | "stability"
  | "family"
  | "independence"
  | "connection";
export type NpcActor = {
  sinceMonth: number;
  goal: Goal;
  goalChangedMonth: number;
  lastTick: number | null;
  fatigue: number;
  budgetMonth: number;
  availableHours: number;
  usedHours: number;
  lastAction?: {
    month: number;
    kind: string;
    success: boolean;
    targetId?: string;
  };
};
export type NpcAgency = {
  version: 1;
  startMonth: number;
  startSeed: number;
  streamSource: "existing" | "currentSeed";
  lastTick: number | null;
  actors: Record<string, NpcActor>;
  knownAfterEventId: number;
  knownPeople: Record<string, PublicProfile>;
  knownLinks: SocialState["npcLinks"];
};
export function hasNpcActor(s: SocialState, id: string): boolean {
  return !!s.npcAgency && Object.hasOwn(s.npcAgency.actors, id);
}
function capacity(p: Person, s: GameState): number {
  const sharedChildren = s.people.filter(c=>c.parentIds?.includes("player")&&c.parentIds.includes(p.id)).length;
  return Math.max(
    0,
    720 -
      240 -
      60 -
      60 -
      (p.occupation === "employed" ? 160 : 0) -
      Math.max(p.childCount ?? 0, sharedChildren) * 8 -
      (p.illness ? 48 : 0),
  );
}
export function selectGoal(p: Person, fatigue: number): Goal {
  if (p.illness || (p.health ?? 85) < 40 || fatigue >= 80) return "health";
  if (p.occupation === "unemployed") return "stability";
  if (p.values === "family") return "family";
  if (p.values === "freedom" && !p.movedAway) return "independence";
  return "connection";
}
export function prepareNpcAgency(s: GameState): void {
  if (!s.npcAgency) {
    const streamSource = s.randomStreams ? "existing" : "currentSeed";
    s.randomStreams ??= createRandomStreams(s.seed);
    s.npcAgency = {
      version: 1,
      startMonth: s.month,
      startSeed: s.seed,
      streamSource,
      lastTick: null,
      actors: {},
      knownAfterEventId: s.worldHistory?.nextId ?? 1,
      knownPeople: {},
      knownLinks: structuredClone(s.npcLinks),
    };
  }
  for (const p of [...s.people].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  )) {
    if (["__proto__", "prototype", "constructor", "player"].includes(p.id))
      throw Error("NPCに予約識別子は使えません");
    if (!ownEntry(s.npcAgency.knownPeople, p.id))
      s.npcAgency.knownPeople[p.id] = capturePublicProfile(
        p,
        s.month,
        s.worldHistory?.nextId ?? 1,
      );
    if (!p.alive) continue;
    if (!ownEntry(s.npcAgency.actors, p.id))
      s.npcAgency.actors[p.id] = {
        sinceMonth: s.month,
        goal: selectGoal(p, 0),
        goalChangedMonth: s.month,
        lastTick: null,
        fatigue: 0,
        budgetMonth: s.month,
        availableHours: capacity(p,s),
        usedHours: 0,
      };
    const a = s.npcAgency.actors[p.id];
    if (a.budgetMonth !== s.month) {
      a.budgetMonth = s.month;
      a.availableHours = capacity(p,s);
      a.usedHours = 0;
    }
  }
}
export function npcFreeHours(s: GameState, id: string): number {
  const p = s.people.find((p) => p.id === id);
  if (!p?.alive) return 0;
  const a = s.npcAgency ? ownEntry(s.npcAgency.actors, id) : undefined;
  return Math.max(
    0,
    Math.min(capacity(p,s), a?.budgetMonth === s.month ? a.availableHours : 720) -
      (a?.budgetMonth === s.month ? a.usedHours : 0),
  );
}
export function reserveNpcHours(
  s: GameState,
  id: string,
  hours: number,
): boolean {
  if (!hasNpcActor(s, id)) return true; // Standalone legacy helper retains its previous contract.
  if (npcFreeHours(s, id) < hours) return false;
  s.npcAgency!.actors[id].usedHours += hours;
  return true;
}
export function npcReply(
  s: GameState,
  id: string,
  intent: "spend" | "talk" | "date" | "marry" | "child",
  proposer = "player",
): { accepted: boolean; reason: string } {
  const p = s.people.find((p) => p.id === id),
    a = s.npcAgency ? ownEntry(s.npcAgency.actors, id) : undefined;
  if (!p?.alive) return { accepted: false, reason: "相手と会うことができない" };
  const hours = intent === "marry" || intent === "child" ? 16 : 8;
  if (
    p.movedAway ||
    (p.health ?? 85) < 35 ||
    p.illness ||
    (a?.fatigue ?? 0) >= 85 ||
    npcFreeHours(s, id) < hours
  )
    return { accepted: false, reason: "今は体調や予定の都合で応じられない" };
  const e = feelings(s, id, proposer);
  if ((e.liking ?? 50) < 30 || (e.trust ?? 50) < 30)
    return { accepted: false, reason: "今は距離を置きたいと伝えられた" };
  if (
    ["date", "marry", "child"].includes(intent) &&
    (s.month - p.birthMonth < 192 ||
      p.kind !== "friend" ||
      p.parentIds?.includes(proposer) ||
      s.people
        .find((x) => x.id === proposer)
        ?.parentIds?.some(
          (id) => id !== "unknown" && p.parentIds?.includes(id),
        ) ||
      p.values === "freedom" ||
      (p.occupation === "unemployed" && intent !== "date"))
  )
    return {
      accepted: false,
      reason: "今はその関係や生活を選ぶつもりはないと伝えられた",
    };
  return { accepted: true, reason: "応じてもらえた" };
}
function draw(s: GameState): number {
  return drawFromStream(s.randomStreams!, "npcRelations");
}
function fact(
  s: GameState,
  p: Person,
  kind: string,
  text: string,
  data: Record<string, string | number | boolean> = {},
): void {
  recordNpcFact(s, text, npcFact(kind, [p.id], data));
}
function endRelationship(s: GameState, p: Person, otherId: string): void {
  const other = s.people.find((x) => x.id === otherId);
  if (otherId !== "player" && !other?.alive) return;
  p.partnerId = null;
  p.spouseId = null;
  if (otherId === "player") {
    s.partnerId = null;
    s.spouseId = null;
    s.stats.happiness = Math.max(0, s.stats.happiness - 8);
  } else {
    if (other!.partnerId === p.id) other!.partnerId = null;
    if (other!.spouseId === p.id) other!.spouseId = null;
  }
  s.npcLinks = s.npcLinks.filter(
    (l) =>
      !(
        ((l.a === p.id && l.b === otherId) ||
          (l.a === otherId && l.b === p.id)) &&
        ["dating", "married"].includes(l.kind)
      ),
  );
  recordNpcFact(
    s,
    p.name + "から、関係を解消して別々に生活したいと伝えられた。",
    npcFact(
      "npc.separation",
      [p.id, otherId],
      {},
      otherId === "player" ? "participants" : "private",
    ),
  );
}
export function npcAgencyMonth(s: GameState): void {
  prepareNpcAgency(s);
  const agency = s.npcAgency!;
  if (agency.lastTick !== null && agency.lastTick >= s.month) return;
  const people = [...s.people]
    .filter(
      (p) => p.alive && s.month - p.birthMonth >= 216 && agency.actors[p.id],
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const pairs = new Set<string>();
  for (const p of people) {
    const a = agency.actors[p.id];
    if (a.lastTick !== null && a.lastTick >= s.month) continue;
    a.lastTick = s.month;
    a.fatigue = Math.min(
      100,
      a.fatigue + (p.occupation === "employed" ? 0.2 : 0),
    );
    const goal = selectGoal(p, a.fatigue);
    if (goal !== a.goal) {
      a.goal = goal;
      a.goalChangedMonth = s.month;
      fact(s, p, "npc.goal", p.name + "は生活の優先事項を見直した。", {
        goal,
        disclosable: false,
      });
    }
    const act = (kind: string, hours: number, success = true) => {
      if (!reserveNpcHours(s, p.id, hours)) return false;
      a.lastAction = { month: s.month, kind, success };
      return true;
    };
    const partner = p.spouseId ?? p.partnerId;
    if (
      partner &&
      ((feelings(s, p.id, partner).liking ?? 50) < 25 ||
        (feelings(s, p.id, partner).trust ?? 50) < 25 ||
        (p.values === "freedom" &&
          s.month - (p.partnerSince ?? s.month) >= 24 &&
          draw(s) < 0.05)) &&
      act("separate", 8)
    ) {
      endRelationship(s, p, partner);
      continue;
    }
    if (goal === "health") {
      if (act("rest", 24)) a.fatigue = Math.max(0, a.fatigue - 12);
      continue;
    }
    if (
      p.occupation === "employed" &&
      s.month - p.birthMonth < 780 &&
      draw(s) < 0.002
    ) {
      p.occupation = "unemployed";
      fact(
        s,
        p,
        "npc.employment",
        p.name + "は仕事を離れ、次の生活を考え始めた。",
        { occupation: "unemployed" },
      );
    }
    if (
      p.occupation === "unemployed" &&
      s.month - p.birthMonth < 780 &&
      act("job-search", 16, false)
    ) {
      if (draw(s) < (p.education === "university" ? 0.1 : 0.08)) {
        p.occupation = "employed";
        a.lastAction!.success = true;
        fact(
          s,
          p,
          "npc.employment",
          p.name + "は仕事を探し、新しい職に就いた。",
          { occupation: "employed" },
        );
      }
      continue;
    }
    if (
      goal === "independence" &&
      p.occupation === "employed" &&
      draw(s) < 0.0015 &&
      act("move", 24)
    ) {
      p.movedAway = true;
      fact(s, p, "npc.move", p.name + "は自立した生活を選び、遠方へ移った。", {
        movedAway: true,
      });
      continue;
    }
    const socialChance =
      goal === "connection" || goal === "family" ? 0.12 : 0.08;
    const mode = p.personality === "quiet" ? "talk" : "spend";
    if (p.movedAway || draw(s) >= socialChance || npcFreeHours(s, p.id) < 8)
      continue;
    const r = s.relations.find((r) => r.id === p.id);
    if (r && draw(s) < 0.6 && remainingHours(s) >= 8 && s.stats.health >= 20) {
      if (!act("contact-player", 8)) continue;
      chargeTime(s, "NPCとの交流", 8);
      const oldAttitude = observedAttitude(s, p.id);
      const oldBand = relationLabel(r);
      a.lastAction!.targetId = "player";
      const response = interact(s, s.month, p.id, "player", mode);
      if (response) {
        practiceHours(s, "communication", 8);
        if (
          oldAttitude !== observedAttitude(s, p.id) ||
          oldBand !== relationLabel(r)
        )
          recordNpcFact(
            s,
            p.name + "から声をかけられ、" + response.attitude,
            npcFact("npc.contact", [p.id, "player"], {}, "participants"),
          );
      }
      continue;
    }
    // A small stable acquaintance neighborhood bounds pair state growth; no global all-pairs graph.
    const index = people.indexOf(p);
    const candidates = [1, 2, 3]
      .map((offset) => people[(index + offset) % people.length])
      .filter(
        (x) => x && x.id !== p.id && npcReply(s, x.id, mode, p.id).accepted,
      );
    const other = candidates[Math.floor(draw(s) * candidates.length)];
    if (!other) continue;
    const key = JSON.stringify([p.id, other.id].sort());
    if (pairs.has(key) || npcFreeHours(s, other.id) < 8) continue;
    pairs.add(key);
    if (!act("socialize", 8)) continue;
    reserveNpcHours(s, other.id, 8);
    const oldLink = s.npcLinks.find(
      (l) =>
        ((l.a === p.id && l.b === other.id) ||
          (l.a === other.id && l.b === p.id)) &&
        ["friends", "conflict"].includes(l.kind),
    );
    a.lastAction!.targetId = other.id;
    const result = interact(s, s.month, p.id, other.id, mode);
    if (result) {
      s.npcLinks = s.npcLinks.filter(
        (l) =>
          !(
            ((l.a === p.id && l.b === other.id) ||
              (l.b === p.id && l.a === other.id)) &&
            ["friends", "conflict"].includes(l.kind)
          ),
      );
      s.npcLinks.push({
        a: p.id,
        b: other.id,
        kind: result.outcome < 0 ? "conflict" : "friends",
        since: s.month,
      });
      if (
        !oldLink ||
        oldLink.kind !== (result.outcome < 0 ? "conflict" : "friends")
      )
        recordNpcFact(
          s,
          p.name + "と" + other.name + "は交流し、" + result.attitude,
          npcFact("npc.social", [p.id, other.id], {
            relationship: result.outcome < 0 ? "conflict" : "friends",
          }),
        );
    }
    if (
      p.kind === "friend" &&
      other.kind === "friend" &&
      !p.parentIds?.includes(other.id) &&
      !other.parentIds?.includes(p.id) &&
      !p.parentIds?.some(
        (id) => id !== "unknown" && other.parentIds?.includes(id),
      ) &&
      !p.partnerId &&
      !p.spouseId &&
      !other.partnerId &&
      !other.spouseId &&
      p.id !== s.partnerId &&
      p.id !== s.spouseId &&
      other.id !== s.partnerId &&
      other.id !== s.spouseId &&
      p.gender &&
      p.orientation &&
      other.gender &&
      other.orientation &&
      compatible(
        { gender: p.gender, orientation: p.orientation },
        { gender: other.gender, orientation: other.orientation },
      ) &&
      npcReply(s, p.id, "date", other.id).accepted &&
      npcReply(s, other.id, "date", p.id).accepted &&
      (feelings(s, p.id, other.id).liking ?? 50) >= 55 &&
      (feelings(s, other.id, p.id).liking ?? 50) >= 55 &&
      draw(s) < 0.1
    ) {
      p.partnerId = other.id;
      other.partnerId = p.id;
      p.partnerSince = s.month;
      other.partnerSince = s.month;
      registerInterest(s, s.month, p.id, other.id, 10);
      registerInterest(s, s.month, other.id, p.id, 10);
      s.npcLinks.push({ a: p.id, b: other.id, kind: "dating", since: s.month });
      recordNpcFact(
        s,
        p.name + "と" + other.name + "は交際を始めた。",
        npcFact("npc.dating", [p.id, other.id]),
      );
    }
  }
  agency.lastTick = s.month;
}
export function validateNpcAgency(s: GameState): void {
  const n = s.npcAgency;
  if (n === undefined) return;
  const month = (v: number) => Number.isInteger(v) && v >= 0 && v <= s.month;
  if (
    !n ||
    n.version !== 1 ||
    !month(n.startMonth) ||
    !Number.isInteger(n.startSeed) ||
    n.startSeed < 0 ||
    n.startSeed > 0xffffffff ||
    !["existing", "currentSeed"].includes(n.streamSource) ||
    !s.randomStreams ||
    !Number.isInteger(n.knownAfterEventId) ||
    n.knownAfterEventId < 1 ||
    n.knownAfterEventId > (s.worldHistory?.nextId ?? 1) ||
    !n.knownPeople ||
    typeof n.knownPeople !== "object" ||
    Array.isArray(n.knownPeople) ||
    !Array.isArray(n.knownLinks) ||
    (n.lastTick !== null && !month(n.lastTick)) ||
    !n.actors ||
    typeof n.actors !== "object" ||
    Array.isArray(n.actors)
  )
    throw Error("NPC行動状態が不正です");
  for (const [id, p] of Object.entries(n.knownPeople))
    if (
      !s.people.some((p) => p.id === id) ||
      !p ||
      typeof p.alive !== "boolean" ||
      !month(p.observedMonth) ||
      !Number.isInteger(p.afterEventId) ||
      p.afterEventId < 1 ||
      p.afterEventId > (s.worldHistory?.nextId ?? 1) ||
      (p.occupation !== undefined &&
        !["student", "employed", "unemployed", "retired"].includes(
          p.occupation,
        )) ||
      [p.illness, p.movedAway].some(
        (x) => x !== undefined && typeof x !== "boolean",
      ) ||
      (p.childCount !== undefined &&
        (!Number.isInteger(p.childCount) || p.childCount < 0)) ||
      (p.deathMonth !== undefined &&
        p.deathMonth !== null &&
        (!month(p.deathMonth) || p.alive))
    )
      throw Error("NPCの確認済み情報が不正です");
  for (const l of n.knownLinks)
    if (
      !l ||
      !s.people.some((p) => p.id === l.a) ||
      !s.people.some((p) => p.id === l.b) ||
      l.a === l.b ||
      typeof l.kind !== "string" ||
      !month(l.since)
    )
      throw Error("確認済み人物参照が不正です");
  for (const [id, a] of Object.entries(n.actors))
    if (
      !s.people.some((p) => p.id === id) ||
      !a ||
      !month(a.sinceMonth) ||
      a.sinceMonth < n.startMonth ||
      !month(a.goalChangedMonth) ||
      (a.lastTick !== null && !month(a.lastTick)) ||
      !["health", "stability", "family", "independence", "connection"].includes(
        a.goal,
      ) ||
      !month(a.budgetMonth) ||
      ![a.fatigue, a.availableHours, a.usedHours].every(Number.isFinite) ||
      a.fatigue < 0 ||
      a.fatigue > 100 ||
      a.availableHours < 0 ||
      a.availableHours > 720 ||
      a.usedHours < 0 ||
      a.usedHours > a.availableHours ||
      (a.lastAction !== undefined &&
        (!a.lastAction ||
          !month(a.lastAction.month) ||
          typeof a.lastAction.kind !== "string" ||
          typeof a.lastAction.success !== "boolean" ||
          (a.lastAction.targetId !== undefined &&
            a.lastAction.targetId !== "player" &&
            !s.people.some((p) => p.id === a.lastAction!.targetId))))
    )
      throw Error("NPC目標・時間・参照が不正です");
}
