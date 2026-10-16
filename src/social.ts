import { hasNpcActor, type NpcAgency } from "./npcAgency";
import { interact, type RelationshipModel } from "./directedRelations";
import { npcFact, type NpcReporter } from "./npcEvents";
import type { Trait } from "./traits";
import type { Origin } from "./origins";
import { randomIdentity, type Identity } from "./identity";
export type Person = Partial<Identity> & {
  traits?: Trait[];
  health?: number;
  illness?: boolean;
  spouseId?: string | null;
  partnerId?: string | null;
  partnerSince?: number;
  marriedSince?: number;
  lastChildMonth?: number;
  childCount?: number;
  parentIds?: string[];
  id: string;
  name: string;
  kind: "family" | "friend" | "teacher";
  birthMonth: number;
  alive: boolean;
  deathMonth?: number | null;
  personality?: "kind" | "bold" | "quiet" | "ambitious";
  values?: "family" | "career" | "freedom";
  occupation?: "student" | "employed" | "unemployed" | "retired";
  education?: "high" | "vocational" | "university";
  movedAway?: boolean;
};
export type Relation = {
  id: string;
  closeness: number;
  trust: number;
  lastContactMonth: number;
  romance?: number;
};
export type SocialState = {
  npcAgency?: NpcAgency;
  relationshipModel?: RelationshipModel;
  npcLinks: { a: string; b: string; kind: string; since: number }[];
  people: Person[];
  relations: Relation[];
  nextPersonId: number;
  lastSocialTick: number;
};
export function initialSocial(origin?: Origin): SocialState {
  const s: SocialState = {
    npcLinks: [],
    people: [
      {
        gender: "female",
        orientation: "heterosexual",
        id: "mother",
        name: "母",
        kind: "family",
        birthMonth: -336,
        alive: true,
      },
      {
        gender: "male",
        orientation: "heterosexual",
        id: "father",
        name: "父",
        kind: "family",
        birthMonth: -360,
        alive: true,
      },
    ],
    relations: [
      { id: "mother", closeness: 80, trust: 85, lastContactMonth: 0 },
      { id: "father", closeness: 65, trust: 75, lastContactMonth: 0 },
    ],
    nextPersonId: 1,
    lastSocialTick: 0,
  };
  if (origin) {
    for (const p of s.people) {
      p.traits = origin.parentTraits[p.id === "mother" ? 0 : 1];
      p.occupation = "employed";
      p.education =
        origin.parentEducation === "basic" ? "high" : origin.parentEducation;
      p.personality = origin.upbringing === "strict" ? "ambitious" : "kind";
      p.values = "family";
    }
  }
  return s;
}
export function normalizeSocial<T extends object>(state: T): T & SocialState {
  const s = state as Partial<SocialState>;
  const d = initialSocial();
  const people = Array.isArray(s.people)
    ? s.people.map((p) => ({
        ...p,
        gender:
          p.gender ??
          (p.id === "father"
            ? "male"
            : p.id === "mother"
              ? "female"
              : undefined),
        orientation:
          p.orientation ?? (p.kind === "family" ? "heterosexual" : undefined),
      }))
    : d.people;
  const used = new Set<string>();
  for (const p of people) {
    const base = p.name.replace(/（[0-9]+）$|\([0-9]+\)$/u, "");
    let name = base;
    let index = 2;
    while (used.has(name)) {
      name = base + "・" + index++;
    }
    p.name = name;
    used.add(name);
  }
  return {
    ...state,
    npcLinks: Array.isArray(s.npcLinks) ? s.npcLinks : [],
    people,
    relations: Array.isArray(s.relations) ? s.relations : d.relations,
    nextPersonId: Math.max(
      Number.isInteger(s.nextPersonId) ? s.nextPersonId! : 1,
      ...people.map((p) =>
        /^(friend|child)-[0-9]+$/.test(p.id)
          ? Number(p.id.split("-").at(-1)) + 1
          : 1,
      ),
    ),
    lastSocialTick: Number.isInteger(s.lastSocialTick)
      ? s.lastSocialTick!
      : d.lastSocialTick,
  };
}
export function socialMonth(
  s: SocialState,
  month: number,
  random: () => number,
  log: NpcReporter,
): void {
  if (s.lastSocialTick >= month) return;
  for (const r of s.relations) {
    const p = s.people.find((x) => x.id === r.id);
    if (!p?.alive || p.kind !== "friend") continue;
    if (month - r.lastContactMonth >= 6)
      r.closeness = Math.max(0, r.closeness - (p.movedAway ? 0.4 : 0.2));
    if (hasNpcActor(s,p.id)) continue;
    if (!p.movedAway && random() < 0.12) {
      const delta = 2 + Math.floor(random() * 4);
      r.closeness = Math.min(100, r.closeness + delta);
      r.trust = Math.min(100, r.trust + 1 + Math.floor(random() * 3));
      r.lastContactMonth = month;
      if (r.closeness >= 60 && random() < 0.13)
        log(
          p.name + "と自然に親しくなった。",
          npcFact("npc.contact", ["player", p.id], {}, "participants"),
        );
    } else if (random() < 0.025) {
      r.trust = Math.max(0, r.trust - 2);
    }
  }
  for (const p of s.people) {
    if (p.kind !== "friend" || !p.alive || hasNpcActor(s,p.id)) continue;
    const age = (month - p.birthMonth) / 12;
    if (
      age >= 18 &&
      age < 65 &&
      p.occupation !== "employed" &&
      random() < 0.018
    ) {
      p.occupation = "employed";
      log(
        p.name + "が就職した。",
        npcFact("npc.employment", [p.id], { occupation: "employed" }),
      );
    }
    if (
      age >= 18 &&
      age < 65 &&
      p.occupation === "employed" &&
      random() < 0.002
    ) {
      p.occupation = "unemployed";
      log(
        p.name + "が仕事を失った。",
        npcFact("npc.employment", [p.id], { occupation: "unemployed" }),
      );
    }
    if (age >= 18 && !p.movedAway && random() < 0.0015) {
      p.movedAway = true;
      log(
        p.name + "が遠くへ引っ越した。",
        npcFact("npc.move", [p.id], { movedAway: true }),
      );
    }
  }

  if (
    month >= 72 &&
    s.people.filter((p) => p.kind === "friend").length < 18 &&
    random() < 0.045
  ) {
    const names = [
      "葵",
      "陽菜",
      "悠斗",
      "凛",
      "蓮",
      "美咲",
      "結衣",
      "湊",
      "紬",
      "颯太",
      "琴音",
      "優花",
      "直樹",
      "莉子",
      "大和",
      "咲良",
      "蒼",
      "千尋",
      "海斗",
      "花音",
      "樹",
    ];
    const available = names.filter(
      (name) => !s.people.some((person) => person.name === name),
    );
    if (available.length === 0) {
      s.lastSocialTick = month;
      return;
    }
    const name = available[Math.floor(random() * available.length)];
    const identity = randomIdentity(random);
    const id = "friend-" + s.nextPersonId++;
    const personalities = ["kind", "bold", "quiet", "ambitious"] as const;
    const values = ["family", "career", "freedom"] as const;
    s.people.push({
      ...identity,
      id,
      name,
      kind: "friend",
      birthMonth: -Math.floor(random() * 36) + Math.floor(random() * 12),
      alive: true,
      personality: personalities[Math.floor(random() * personalities.length)],
      values: values[Math.floor(random() * values.length)],
      occupation: "student",
    });
    s.relations.push({ id, closeness: 35, trust: 35, lastContactMonth: month });
    log(
      name + "と知り合った。",
      npcFact("npc.encounter", ["player", id], {}, "participants"),
    );
  }
  s.lastSocialTick = month;
}
export function contact(
  s: SocialState,
  month: number,
  id: string,
  mode: "spend" | "talk" = "spend",
): string | null {
  const person = s.people.find((x) => x.id === id);
  const r = s.relations.find((x) => x.id === id);
  if (!person?.alive || !r) return null;
  const response = interact(s, month, "player", id, mode);
  return response ? person.name + "と" + response.attitude : null;
}

export function relationLabel(r: Relation): string {
  return r.closeness >= 75 && r.trust >= 65
    ? "親友"
    : r.closeness >= 45
      ? "友人"
      : r.closeness < 15
        ? "疎遠"
        : "知人";
}
export function personalityLabel(p: Person): string {
  return {
    kind: "思いやりがある",
    bold: "積極的",
    quiet: "物静か",
    ambitious: "向上心が強い",
  }[p.personality ?? "kind"];
}

/** Unknown historical deaths have no inferred date or age. */
export function personAgeMonths(
  person: Person,
  currentMonth: number,
): number | null {
  if (person.alive) return currentMonth - person.birthMonth;
  return person.deathMonth === undefined || person.deathMonth === null
    ? null
    : person.deathMonth - person.birthMonth;
}
export function personAgeLabel(person: Person, currentMonth: number): string {
  const age = personAgeMonths(person, currentMonth);
  return age === null ? "死亡時年齢不明" : `${Math.floor(age / 12)}歳`;
}
