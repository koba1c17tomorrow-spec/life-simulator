import { npcFact, type NpcReporter } from "./npcEvents";
import { randomTraits } from "./traits";
import { compatible } from "./identity";
import type { GameState, PendingChoice } from "./engine";
export function canDate(s: GameState, id: string): boolean {
  const p = s.people.find((p) => p.id === id),
    r = s.relations.find((r) => r.id === id);
  return !!(
    s.month >= 192 &&
    !s.partnerId &&
    !s.spouseId &&
    p?.alive &&
    p.kind === "friend" &&
    s.month - p.birthMonth >= 192 &&
    !p.spouseId &&
    !p.partnerId &&
    p.gender &&
    p.orientation &&
    compatible(s.identity, { gender: p.gender, orientation: p.orientation }) &&
    r &&
    r.closeness >= 58 &&
    r.trust >= 48
  );
}
export function canMarry(s: GameState): boolean {
  const p = s.people.find((p) => p.id === s.partnerId);
  const r = s.relations.find((r) => r.id === s.partnerId);
  return !!(
    s.month >= 216 &&
    !s.spouseId &&
    p?.alive &&
    p.kind === "friend" &&
    s.month - p.birthMonth >= 216 &&
    !p.spouseId &&
    r &&
    r.closeness >= 50 &&
    r.trust >= 45
  );
}
export function canHaveChild(s: GameState): boolean {
  return !!(
    s.month >= 216 &&
    s.month < 600 &&
    s.children < 4 &&
    s.month - (s.lastSeen.birth ?? -999) >= 24 &&
    s.people.some(
      (p) =>
        p.id === s.spouseId &&
        p.alive &&
        p.kind === "friend" &&
        s.month - p.birthMonth >= 216,
    )
  );
}
export function lifeDecision(
  s: GameState,
  action: "date" | "marry" | "child",
  id?: string,
): PendingChoice | null {
  if (action === "date" && id && canDate(s, id))
    return {
      eventId: "romance-proposal",
      text: s.people.find((p) => p.id === id)!.name + "との交際を始める？",
      personId: id,
      choices: [
        { label: "交際を始める", effects: [], lifeAction: "date" },
        { label: "友人のままでいる", effects: [] },
      ],
    };
  if (action === "marry" && canMarry(s))
    return {
      eventId: "marriage-proposal",
      text: "交際相手と結婚について話し合った。",
      personId: s.partnerId!,
      choices: [
        { label: "結婚する", effects: [], lifeAction: "marry" },
        { label: "今は結婚しない", effects: [] },
      ],
    };
  if (action === "child" && canHaveChild(s))
    return {
      eventId: "family-plan",
      text: "子どもを迎え、育てることについて話し合った。",
      personId: s.spouseId!,
      choices: [
        { label: "子どもを迎える", effects: [], lifeAction: "child" },
        { label: "今は見送る", effects: [] },
      ],
    };
  return null;
}
export function addChild(
  s: GameState,
  log: (text: string) => void,
  random: () => number,
) {
  const id = "child-" + s.nextPersonId++;
  s.children++;
  s.people.push({
    id,
    name: `子ども・${s.children}`,
    traits: randomTraits(random, [
      ...s.traits,
      ...(s.people.find((p) => p.id === s.spouseId)?.traits ?? []),
    ]),
    kind: "family",
    birthMonth: s.month,
    alive: true,
    health: 90,
    personality: "kind",
    values: "family",
    occupation: "student",
    childCount: 0,
    parentIds: ["player", s.spouseId ?? "unknown"],
  });
  s.relations.push({ id, closeness: 75, trust: 70, lastContactMonth: s.month });
  s.flags.parent = true;
  log("【家族】子どもを迎えた。子育ての時間と費用を家計に織り込む。");
}
export function npcMonth(s: GameState, random: () => number, log: NpcReporter) {
  for (const p of s.people) {
    if (!p.alive) continue;
    const age = (s.month - p.birthMonth) / 12;
    p.health ??= 85;
    p.childCount ??= 0;
    if (age >= 18 && !p.education)
      p.education = age >= 22 && p.values === "career" ? "university" : "high";
    if (age >= 65) {
      p.occupation = "retired";
      p.health -= 0.08;
    }
    if (age >= 18 && p.occupation === "student") p.occupation = "unemployed";
    if (
      age >= 18 &&
      age < 65 &&
      p.occupation === "unemployed" &&
      random() < 0.035
    )
      p.occupation = "employed";
    if (random() < (age > 70 ? 0.003 : 0.0005)) {
      p.illness = true;
      p.health -= 8;
      log(
        p.name + "が体調を崩した。",
        npcFact("npc.illness", [p.id], { ill: true }),
      );
    }
    if (p.illness && random() < 0.1) {
      p.illness = false;
      p.health = Math.min(90, p.health + 5);
      log(
        p.name + "の体調が回復した。",
        npcFact("npc.recovery", [p.id], { ill: false }),
      );
    }
    if (
      age >= 100 ||
      (age >= 65 && random() < Math.max(0, (age - 60) * 0.00012)) ||
      p.health <= 0
    ) {
      p.alive = false;
      p.deathMonth = s.month;
      p.occupation = "retired";
      log(
        "【死別】" + p.name + "が亡くなった。",
        npcFact("npc.death", [p.id], {
          deathMonth: p.deathMonth,
          birthMonth: p.birthMonth,
          pcPartner: s.partnerId === p.id || s.spouseId === p.id,
          formerPartnerId: p.partnerId ?? null,
          formerSpouseId: p.spouseId ?? null,
        }),
      );
      if (s.partnerId === p.id || s.spouseId === p.id) {
        s.partnerId = null;
        s.spouseId = null;
        s.stats.happiness = Math.max(0, s.stats.happiness - 12);
        s.flags.bereaved = true;
      }
      if (p.spouseId) {
        const other = s.people.find((x) => x.id === p.spouseId);
        if (other?.alive) other.spouseId = null;
        p.spouseId = null;
      }
      if (p.partnerId) {
        const other = s.people.find((x) => x.id === p.partnerId);
        if (other?.alive) other.partnerId = null;
        p.partnerId = null;
      }
      continue;
    }
    if (p.movedAway && random() < 0.002) {
      p.movedAway = false;
      log(
        p.name + "が戻り、久しぶりに再会した。",
        npcFact("npc.reunion", ["player", p.id], {}, "participants"),
      );
      const r = s.relations.find((r) => r.id === p.id);
      if (r) {
        r.closeness = Math.min(100, r.closeness + 5);
        r.lastContactMonth = s.month;
      }
    }
    if (
      p.kind !== "friend" ||
      s.partnerId === p.id ||
      s.spouseId === p.id ||
      age < 18
    )
      continue;
    if (
      p.spouseId &&
      s.month - (p.marriedSince ?? 0) >= 24 &&
      random() < 0.0008
    ) {
      const formerSpouseId = p.spouseId;
      const other = s.people.find((x) => x.id === p.spouseId);
      if (other?.alive) {
        other.spouseId = null;
        other.partnerId = null;
      }
      p.spouseId = null;
      p.partnerId = null;
      log(
        p.name + "が離婚し、新しい生活を始めた。",
        npcFact("npc.divorce", [p.id, formerSpouseId]),
      );
    }
    if (
      !p.spouseId &&
      !p.partnerId &&
      random() < (p.values === "family" ? 0.006 : 0.004)
    ) {
      const other = s.people.find(
        (x) =>
          x.id !== p.id &&
          x.kind === "friend" &&
          x.alive &&
          !x.spouseId &&
          !x.partnerId &&
          x.id !== s.partnerId &&
          x.id !== s.spouseId &&
          s.month - x.birthMonth >= 216 &&
          p.gender &&
          p.orientation &&
          x.gender &&
          x.orientation &&
          compatible(
            { gender: p.gender, orientation: p.orientation },
            { gender: x.gender, orientation: x.orientation },
          ),
      );
      if (other && age >= 18) {
        p.partnerId = other.id;
        other.partnerId = p.id;
        p.partnerSince = s.month;
        other.partnerSince = s.month;
        s.npcLinks.push({
          a: p.id,
          b: other.id,
          kind: "dating",
          since: s.month,
        });
        log(
          p.name + "と" + other.name + "が交際を始めた。",
          npcFact("npc.dating", [p.id, other.id]),
        );
      }
    }
    if (
      p.partnerId &&
      !p.spouseId &&
      s.month - (p.partnerSince ?? s.month) >= 12 &&
      random() < (p.values === "freedom" ? 0.005 : 0.015)
    ) {
      const other = s.people.find(
        (x) => x.id === p.partnerId && x.alive && x.partnerId === p.id,
      );
      if (other?.alive) {
        p.spouseId = other.id;
        other.spouseId = p.id;
        p.marriedSince = s.month;
        other.marriedSince = s.month;
        s.npcLinks.push({
          a: p.id,
          b: other.id,
          kind: "married",
          since: s.month,
        });
        log(
          p.name + "と" + other.name + "が結婚した。",
          npcFact("npc.marriage", [p.id, other.id]),
        );
      }
    }
    if (
      p.spouseId &&
      p.id < p.spouseId &&
      s.month - (p.marriedSince ?? 0) >= 12 &&
      s.month - (p.lastChildMonth ?? -999) >= 24 &&
      age < 45 &&
      p.childCount < 3 &&
      random() < 0.004
    ) {
      p.childCount++;
      p.lastChildMonth = s.month;
      const other = s.people.find((x) => x.id === p.spouseId);
      if (other?.alive) {
        other.childCount = p.childCount;
        other.lastChildMonth = s.month;
      }
      log(
        p.name + "の家庭に子どもが生まれた。",
        npcFact("npc.birth", [p.id, p.spouseId], { childCount: p.childCount }),
      );
    }
  }
  if (s.month % 12 === 0) {
    const a = s.people.find(
      (p) => p.kind === "friend" && p.alive && !p.movedAway,
    );
    const b = s.people.find(
      (p) => p.kind === "friend" && p.alive && p.id !== a?.id && !p.movedAway,
    );
    if (a && b) {
      const kind = random() < 0.2 ? "conflict" : "friends";
      s.npcLinks = s.npcLinks.filter(
        (l) =>
          !(
            l.a === a.id &&
            l.b === b.id &&
            !["married", "dating"].includes(l.kind)
          ),
      );
      s.npcLinks.push({ a: a.id, b: b.id, kind, since: s.month });
      log(
        a.name +
          "と" +
          b.name +
          (kind === "friends"
            ? "は交流を続けている。"
            : "の意見がぶつかった。"),
        npcFact("npc." + kind, [a.id, b.id]),
      );
    }
  }
  s.npcLinks = s.npcLinks
    .filter(
      (l) =>
        s.people.some((p) => p.id === l.a && p.alive) &&
        s.people.some((p) => p.id === l.b && p.alive) &&
        (l.kind !== "dating" ||
          s.people.find((p) => p.id === l.a)?.partnerId === l.b) &&
        (l.kind !== "married" ||
          s.people.find((p) => p.id === l.a)?.spouseId === l.b),
    )
    .slice(-100);
}
