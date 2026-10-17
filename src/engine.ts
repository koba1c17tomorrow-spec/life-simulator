import { actionReason, actionHours, actionCost, actionFactor, budgetFor, chargeTime, remainingHours, validateTimeExtensions, type TimeBudget, type FocusPlan, type Intensity } from "./timeBudget";
import { initialCapabilities, practiceSkill, validateCapabilities, type Capabilities } from "./capabilities";
import { recordNpcFact, shareWorldEvents } from "./npcEvents";
import { validateRandomStreams, type RandomStreams } from "./randomStreams";
import { recordWorldEvent, validateWorldHistory, type WorldHistory } from "./worldHistory";
import { assertRawStateFormat, STATE_VERSION } from "./saveFormat";
import { record as log } from "./journal";
import { validateEvents, WORLDS } from "./content";
import {
  initialVitality,
  healthMonth,
  delayedMonth,
  updateAchievements,
  type Vitality,
} from "./health";
import {
  canDate,
  canMarry,
  canHaveChild,
  lifeDecision,
  addChild,
  npcMonth,
} from "./relationships";
import {
  initialSchool,
  schoolMonth,
  schoolMilestone,
  type School,
} from "./education";
import {
  initialEconomy,
  settleBudget,
  restructure,
  type Economy,
} from "./economy";
import {
  JOBS,
  jobOffers,
  offerChance,
  hiringExplanation,
  type JobId,
} from "./careers";
import {
  satisfies,
  rollChance,
  rollExplanation,
  type Requirement,
  type RollRule,
} from "./eventRules";
import {
  randomOrigin,
  schoolPerformanceDelta,
  admissionChance,
  type Origin,
} from "./origins";
import { randomTraits, traitMonthlyEffects, type Trait } from "./traits";
import { monthlyDrift, abilityGain } from "./balance";
import {
  randomIdentity,
  compatible,
  type Identity,
  type IdentityChoice,
} from "./identity";
import {
  initialProgression,
  normalizeProgression,
  progressionMonth,
  careerOptions,
  jobChance,
  annualSalary,
  type Career,
  type Progression,
} from "./progression";
import {
  initialSocial,
  normalizeSocial,
  socialMonth,
  contact,
  type SocialState,
} from "./social";
export type Stat =
  | "health"
  | "happiness"
  | "knowledge"
  | "sociability"
  | "money";
export type Effect = { stat: Stat; delta: number };
export type Choice = {
  label: string;
  effects: Effect[];
  relationshipDelta?: number;
  career?: Career;
  university?: boolean;
  successChance?: number;
  jobId?: JobId;
  lifeAction?: "date" | "marry" | "child";
  club?: School["club"];
  studyPath?: School["studyPath"];
  leaveSchool?: boolean;
  restructureDebt?: boolean;
  setFlag?: string;
  successFlag?: string;
  failureFlag?: string;
  delayed?: { months: number; text: string; effects: Effect[]; flag?: string };
  requires?: Requirement[];
  roll?: RollRule;
  successEffects?: Effect[];
  failureEffects?: Effect[];
  successText?: string;
  failureText?: string;
};
export type EventDefinition = {
  id: string;
  category: string;
  presentation: "log" | "choice" | "silent";
  minAge?: number;
  maxAge?: number;
  weight: number;
  priority?: number;
  setFlag?: string;
  cooldownMonths?: number;
  requiresFriendCloseness?: number;
  usesFriendName?: boolean;
  text: string;
  effects?: Effect[];
  choices?: Choice[];
  requires?: Requirement[];
};
export type LogEntry = { id: string; month: number; text: string; worldEventId?: string };
export type PendingChoice = {
  eventId: string;
  text: string;
  choices: Choice[];
  personId?: string;
};
export type Priority =
  | "learning"
  | "relationships"
  | "wellness"
  | "hobby"
  | "rest"
  | "study"
  | "social"
  | "health";
export type GameState = SocialState &
  Progression &
  Economy &
  School &
  Vitality & {
    timeBudget?: TimeBudget;
    focusPlan?: FocusPlan;
    capabilities?: Capabilities;
    version: 1;
    randomStreams?: RandomStreams;
    worldHistory?: WorldHistory;
    month: number;
    seed: number;
    stats: Record<Stat, number>;
    history: LogEntry[];
    lastSeen: Record<string, number>;
    pending: PendingChoice | null;
    queue: string[];
    monthStarted: boolean;
    finished: boolean;
    priority: Priority;
    lastActionMonth: number;
    identity: Identity;
    traits: Trait[];
    origin: Origin;
    jobId: JobId | null;
    autoChoices: boolean;
    insolvencyMonths: number;
    worldId: string;
    birthSeed: number | null;
    initialIdentityChoice: IdentityChoice;
  };
const initialStats: Record<Stat, number> = {
  health: 85,
  happiness: 60,
  knowledge: 15,
  sociability: 35,
  money: 0,
};
export function newGame(
  seed = 123456,
  identityChoice: IdentityChoice = {},
  worldId = "modern",
): GameState {
  const identitySeed = { value: seed >>> 0 };
  const draw = () => {
    identitySeed.value =
      (Math.imul(1664525, identitySeed.value) + 1013904223) >>> 0;
    return identitySeed.value / 4294967296;
  };
  const identity = randomIdentity(draw, identityChoice);
  const origin = randomOrigin(draw);
  const traits = randomTraits(draw, origin.parentTraits.flat());
  if (worldId === "coastal") origin.region = "coastal";
  return {
    worldId,
    birthSeed: seed >>> 0,
    initialIdentityChoice: { ...identityChoice },
    capabilities: initialCapabilities(),
    version: STATE_VERSION,
    month: 0,
    seed: seed >>> 0,
    stats: { ...initialStats },
    history: [{ id: "birth", month: 0, text: "あなたはこの世界に生まれた。" }],
    lastSeen: {},
    pending: null,
    queue: [],
    monthStarted: false,
    finished: false,
    priority: "rest",
    lastActionMonth: -1,
    identity,
    traits,
    origin,
    jobId: null,
    autoChoices: false,
    insolvencyMonths: 0,
    ...initialSocial(origin),
    ...initialProgression(),
    ...initialEconomy(),
    ...initialSchool(),
    ...initialVitality(),
  };
}
function random(s: GameState) {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function clamp(value: number, stat: Stat) {
  return stat === "money"
    ? Math.max(0, Math.min(1000000000, value))
    : Math.max(0, Math.min(100, value));
}
export function applyEffects(s: GameState, effects: Effect[] = []) {
  for (const e of effects) {
    if (
      Object.prototype.hasOwnProperty.call(s.stats, e.stat) &&
      Number.isFinite(e.delta)
    ) {
      if (e.stat === "money" && e.delta < 0 && s.stats.money + e.delta < 0) {
        s.debt += -(s.stats.money + e.delta);
        s.stats.money = 0;
      } else {
        const delta = e.stat === "knowledge" || e.stat === "sociability"
          ? abilityGain(s.stats[e.stat], e.delta) : e.delta;
        s.stats[e.stat] = clamp(s.stats[e.stat] + delta, e.stat);
      }
    }
  }
}
export function ageLabel(month: number) {
  return `${Math.floor(month / 12)}歳${month % 12}か月`;
}
function eligible(s: GameState, e: EventDefinition) {
  return (
    satisfies(s, e.requires) &&
    s.month >= (e.minAge ?? 0) &&
    s.month <= (e.maxAge ?? 9999) &&
    s.month - (s.lastSeen[e.id] ?? -99999) >= (e.cooldownMonths ?? 0) &&
    e.weight > 0 &&
    (e.requiresFriendCloseness === undefined ||
      s.relations.some(
        (r) =>
          s.people.some(
            (p) => p.id === r.id && p.kind === "friend" && p.alive,
          ) && r.closeness >= e.requiresFriendCloseness!,
      ))
  );
}
function eventWeight(s: GameState, e: EventDefinition) {
  const match =
    (s.priority === "relationships" && e.category === "social") ||
    (s.priority === "wellness" && e.category === "health") ||
    (s.priority === "learning" && e.category === "growth") ||
    (s.priority === "hobby" && e.id.includes("hobby"));
  return (
    e.weight *
    (match || (e.category === "social" && s.benefits.social >= s.month)
      ? 1.1
      : 1)
  );
}
export function selectEvents(s: GameState, events: EventDefinition[]) {
  const picked: string[] = [];
  for (const category of ["growth", "social", "work", "health"]) {
    if (random(s) > 0.38) continue;
    const pool = events.filter(
      (e) =>
        e.category === category &&
        eligible(s, e) &&
        (e.presentation !== "choice" || s.month - s.lastChoiceMonth >= 12),
    );
    const highest = Math.max(...pool.map((e) => e.priority ?? 0));
    const candidates =
      highest > 0 ? pool.filter((e) => (e.priority ?? 0) === highest) : pool;
    const total = candidates.reduce((n, e) => n + eventWeight(s, e), 0);
    if (total <= 0) continue;
    let roll = random(s) * total;
    for (const e of candidates) {
      roll -= eventWeight(s, e);
      if (roll < 0) {
        picked.push(e.id);
        break;
      }
    }
  }
  return picked;
}
export function advanceMonth(
  original: GameState,
  events: EventDefinition[],
): GameState {
  const s = normalizeProgression(normalizeSocial(structuredClone(original)));
  s.traits ??= [];
  s.origin ??= randomOrigin(() => 0.5);
  s.jobId ??= null;
  s.autoChoices ??= false;
  s.insolvencyMonths ??= 0;
  Object.assign(s, {
    ...initialEconomy(),
    ...initialSchool(),
    ...initialVitality(),
    ...s,
  });
  if (s.finished || s.pending) return s;
  if (!s.monthStarted) {
    s.month++;
    s.monthStarted = true;
    const drift = monthlyDrift(s.month, s.career, s.priority);
    applyEffects(
      s,
      Object.entries(drift).map(([stat, delta]) => ({
        stat: stat as Stat,
        delta,
      })),
    );
    if (
      s.month >= 72 &&
      s.month < 264 &&
      (s.month < 216 || s.graduatedUniversity)
    ) {
      s.origin.schoolPerformance = Math.max(
        0,
        Math.min(
          100,
          s.origin.schoolPerformance +
            schoolPerformanceDelta(s.origin, s.traits, s.priority),
        ),
      );
      if (s.month % 12 === 0)
        log(
          s,
          "学年が進んだ。現在の学業成績は" +
            Math.round(s.origin.schoolPerformance) +
            "点。",
        );
    }
    const traitEffects = traitMonthlyEffects(s.traits, s.career !== "none");
    applyEffects(
      s,
      Object.entries(traitEffects).map(([stat, delta]) => ({
        stat: stat as Stat,
        delta,
      })),
    );
    delayedMonth(
      s,
      (e) => applyEffects(s, e),
      (text) => log(s, text),
    );
    healthMonth(
      s,
      () => random(s),
      (text) => log(s, text),
    );
    updateAchievements(s);
    if (s.finished) { s.timeBudget = budgetFor(s); resolveFocus(s); return s; }
    socialMonth(
      s,
      s.month,
      () => random(s),
      (text, fact) => recordNpcFact(s, text, fact),
    );
    npcMonth(
      s,
      () => random(s),
      (text, fact) => recordNpcFact(s, text, fact),
    );
    if (s.priority === "relationships") {
      for (const r of s.relations)
        if (s.people.some((p) => p.id === r.id && p.alive && !p.movedAway)) {
          r.closeness = Math.min(100, r.closeness + 0.03);
          r.trust = Math.min(100, r.trust + 0.01);
        }
    }
    if (s.benefits.learning >= s.month)
      applyEffects(s, [{ stat: "knowledge", delta: 0.005 }]);
    if (s.month === 216 && s.graduatedUniversity) {
      const chance = admissionChance(s.origin, s.stats.knowledge, s.traits);
      const accepted = random(s) * 100 < chance;
      s.origin.universityAccepted = accepted;
      if (!accepted) {
        s.graduatedUniversity = false;
        s.studyPath = "job";
        log(
          s,
          "大学受験に不合格となった（合格率 " +
            chance +
            "%）。就職先を探すことにした。",
        );
      } else log(s, "大学受験に合格した（合格率 " + chance + "%）。");
    }
    schoolMonth(
      s,
      () => random(s),
      (text) => log(s, text),
    );
    progressionMonth(s, (text) => log(s, text));
    if (s.month >= 72 && s.education !== "working" && s.education !== "preschool") practiceSkill(s, "learning", 0.1);
    if (s.career !== "none" && !s.retired && s.month >= 192) practiceSkill(s, "professional", 0.1);
    s.timeBudget = budgetFor(s);
    settleBudget(
      s,
      () => random(s),
      (text) => log(s, text),
    );
    if (s.debt >= 3000000 && s.month % 6 === 0) {
      applyEffects(s, [
        { stat: "happiness", delta: -0.5 },
        { stat: "health", delta: -0.1 },
      ]);
      log(s, "返済できない借金により生活が困窮している。");
    }
    if (s.debt >= 10000000) {
      s.insolvencyMonths++;
      if (s.insolvencyMonths === 1 || s.insolvencyMonths % 12 === 0)
        log(
          s,
          "債務が膨らんだ。生活を切り詰め、返済や再就職を続ける必要がある。",
        );
    } else s.insolvencyMonths = 0;
    if (
      s.career !== "none" &&
      s.month >= 216 &&
      !s.retired &&
      random(s) < 0.002
    ) {
      s.jobId = null;
      s.career = "none";
      s.careerLevel = 0;
      log(s, "勤務先が倒産し、突然仕事を失った。");
    }
    const schoolDecision = schoolMilestone(s);
    if (schoolDecision) {
      s.pending = schoolDecision;
      s.lastSeen[schoolDecision.eventId] = s.month;
      s.lastChoiceMonth = s.month;
      return s;
    }
    if (
      (s.month === 216 &&
        !s.graduatedUniversity &&
        s.studyPath !== "vocational") ||
      (s.month === 264 && s.graduatedUniversity) ||
      (s.month === 240 && s.studyPath === "vocational")
    ) {
      s.pending = careerPrompt(s, "career-start");
      s.lastCareerPromptMonth = s.month;
      s.lastChoiceMonth = s.month;
      return s;
    }
    if (
      s.debt >= 3000000 &&
      !s.restructured &&
      s.month - (s.lastSeen["debt-plan"] ?? -999) >= 60 &&
      s.month - s.lastChoiceMonth >= 12
    ) {
      s.pending = {
        eventId: "debt-plan",
        text: "家計を立て直すため、債務整理を検討する。資産を返済に充て、残債を減らす代わりに7年間投資や高額消費に制約が付く。",
        choices: [
          { label: "債務整理で再出発する", effects: [], restructureDebt: true },
          { label: "返済を続ける", effects: [] },
        ],
      };
      s.lastSeen["debt-plan"] = s.month;
      s.lastChoiceMonth = s.month;
      return s;
    }
    if (s.month >= 192 && s.month - s.lastChoiceMonth >= 6) {
      if (
        !s.partnerId &&
        !s.spouseId &&
        s.month - (s.lastSeen["romance-proposal"] ?? -999) >= 18
      ) {
        const eligibleFriends = s.people.filter((p) => canDate(s, p.id));
        if (eligibleFriends.length && random(s) < 0.2) {
          const p =
            eligibleFriends[Math.floor(random(s) * eligibleFriends.length)];
          s.pending = lifeDecision(s, "date", p.id);
          s.lastSeen["romance-proposal"] = s.month;
          s.lastChoiceMonth = s.month;
          return s;
        }
      }
      if (
        s.month - (s.lastSeen["marriage-proposal"] ?? -999) >= 36 &&
        canMarry(s) &&
        random(s) < 0.15
      ) {
        s.pending = lifeDecision(s, "marry");
        s.lastSeen["marriage-proposal"] = s.month;
        s.lastChoiceMonth = s.month;
        return s;
      }
      if (
        s.month - (s.lastSeen["family-plan"] ?? -999) >= 48 &&
        canHaveChild(s) &&
        random(s) < 0.12
      ) {
        s.pending = lifeDecision(s, "child");
        s.lastSeen["family-plan"] = s.month;
        s.lastChoiceMonth = s.month;
        return s;
      }
    }
    if (
      canHaveChild(s) &&
      s.month - (s.lastSeen["birth"] ?? -999) >= 24 &&
      s.people.some(
        (p) =>
          p.id === s.spouseId &&
          p.gender &&
          p.gender !== s.identity.gender &&
          p.gender !== "nonbinary" &&
          s.identity.gender !== "nonbinary",
      ) &&
      random(s) < 0.0003
    ) {
      addChild(
        s,
        (text) => log(s, text),
        () => random(s),
      );
      s.lastSeen.birth = s.month;
      log(s, "予期しない妊娠をきっかけに家族が増えた。");
    }
    if (
      !s.retired &&
      s.career === "none" &&
      s.month >= 216 &&
      s.education !== "university" &&
      s.education !== "vocational" &&
      s.month - s.lastCareerPromptMonth >= 6
    ) {
      s.pending = careerPrompt(s, "career-search");
      s.lastCareerPromptMonth = s.month;
      s.lastChoiceMonth = s.month;
      return s;
    }
    if (
      !s.retired &&
      s.career !== "none" &&
      s.month >= 240 &&
      s.month - s.lastCareerPromptMonth >= 36 &&
      random(s) < 0.18
    ) {
      s.pending = careerPrompt(s, "career-change");
      s.lastCareerPromptMonth = s.month;
      s.lastChoiceMonth = s.month;
      return s;
    }
    s.queue = selectEvents(s, events).sort(
      (a, b) =>
        (events.find((e) => e.id === b)?.priority ?? 0) -
        (events.find((e) => e.id === a)?.priority ?? 0),
    );
  }
  while (s.queue.length) {
    const id = s.queue.shift()!;
    const e = events.find((x) => x.id === id);
    if (
      !e ||
      !eligible(s, e) ||
      (e.presentation === "choice" && s.month - s.lastChoiceMonth < 12)
    )
      continue;
    s.lastSeen[e.id] = s.month;
    if (e.setFlag) s.flags[e.setFlag] = true;
    const friend = e.usesFriendName
      ? s.relations
          .filter(
            (r) =>
              s.people.some(
                (p) => p.id === r.id && p.kind === "friend" && p.alive,
              ) && r.closeness >= (e.requiresFriendCloseness ?? 0),
          )
          .sort((a, b) => b.closeness - a.closeness)[0]
      : undefined;
    const text = e.usesFriendName
      ? e.text.replaceAll(
          "{npc}",
          s.people.find((p) => p.id === friend?.id)?.name ?? "友人",
        )
      : e.text;
    if (e.presentation === "choice" && e.choices?.length) {
      const friendCloseness = friend?.closeness;
      const choices = e.choices.filter((c) =>
        satisfies({ ...s, friendCloseness }, c.requires),
      );
      if (!choices.length) continue;
      s.lastChoiceMonth = s.month;
      s.pending = { eventId: e.id, text, choices, personId: friend?.id };
      return s;
    }
    applyEffects(s, e.effects);
    if (e.presentation === "log") log(s, text);
  }
  s.timeBudget = budgetFor(s);
  resolveFocus(s);
  s.monthStarted = false;
  return s;
}
export function choose(
  original: GameState,
  index: number,
  events: EventDefinition[],
): GameState {
  const s = normalizeProgression(normalizeSocial(structuredClone(original)));
  if (!s.pending || !s.pending.choices[index]) return s;
  const p = s.pending;
  const c = p.choices[index];
  if (c.restructureDebt) Object.assign(s, restructure({ ...s, pending: null }));
  if (c.club) s.club = c.club;
  if (c.studyPath) s.studyPath = c.studyPath;
  if (c.leaveSchool) {
    s.dropout = true;
    s.graduatedUniversity = false;
    s.studyPath = "job";
    s.education = "working";
    log(s, "学業を中断し、就職を目指すことにした。");
  }
  if (c.setFlag) s.flags[c.setFlag] = true;
  if (c.delayed)
    s.scheduled.push({
      month: s.month + c.delayed.months,
      text: c.delayed.text,
      effects: c.delayed.effects,
      flag: c.delayed.flag,
    });
  applyEffects(s, c.effects);
  if (c.roll) {
    const chance = rollChance(s, c.roll);
    log(s, "【判定の要因】" + rollExplanation(s, c.roll));
    const success = random(s) * 100 < chance;
    const resultFlag = success ? c.successFlag : c.failureFlag;
    if (resultFlag) s.flags[resultFlag] = true;
    applyEffects(s, success ? c.successEffects : c.failureEffects);
    log(
      s,
      (success ? "【成功】" : "【失敗】") +
        (success
          ? (c.successText ?? "挑戦に成功した。")
          : (c.failureText ?? "挑戦に失敗した。")) +
        "（成功率 " +
        chance +
        "%）",
    );
  }
  if (c.university !== undefined) {
    s.graduatedUniversity = c.university;
    s.origin.universityAccepted = null;
  }
  if (c.lifeAction === "date" && p.personId && canDate(s, p.personId)) {
    s.partnerId = p.personId;
    s.people.find((x) => x.id === p.personId)!.partnerId = "player";
    log(
      s,
      "【交際】" +
        s.people.find((x) => x.id === p.personId)!.name +
        "と交際を始めた。",
    );
  }
  if (c.lifeAction === "marry" && canMarry(s)) {
    s.spouseId = s.partnerId;
    s.people.find((x) => x.id === s.partnerId)!.spouseId = "player";
    log(s, "【結婚】結婚した。");
  }
  if (c.lifeAction === "child" && canHaveChild(s)) {
    addChild(
      s,
      (text) => log(s, text),
      () => random(s),
    );
    s.lastSeen.birth = s.month;
  }
  if (c.jobId) {
    s.lastJobApplicationMonth = s.month;
    const job = JOBS.find((j) => j.id === c.jobId);
    if (job) {
      const chance = offerChance(s, job);
      log(s, "【採用の要因】" + hiringExplanation(s, job));
      if (random(s) * 100 < chance) {
        s.jobId = job.id;
        s.career = job.category;
        s.careerLevel = 0;
        s.experience = 0;
        log(
          s,
          "【採用成功】" +
            job.name +
            "に就職した。年収目安 " +
            job.salary.toLocaleString() +
            "円（採用率 " +
            chance +
            "%）。",
        );
      } else
        log(
          s,
          "【採用失敗】" +
            job.name +
            "の選考に落ちた（採用率 " +
            chance +
            "%）。",
        );
    }
  } else if (c.career) {
    s.lastJobApplicationMonth = s.month;
    const chance = jobChance(s, c.career);
    if (random(s) * 100 < chance) {
      s.career = c.career;
      s.careerLevel = 0;
      s.experience = 0;
      log(
        s,
        "採用選考に合格した。年収の目安は" +
          annualSalary(c.career).toLocaleString() +
          "円。",
      );
    } else {
      log(s, "採用選考に不合格となった。仕事探しは続く。");
    }
  }
  if (p.personId && c.relationshipDelta) {
    const r = s.relations.find((r) => r.id === p.personId);
    if (r) {
      r.closeness = Math.max(
        0,
        Math.min(100, r.closeness + c.relationshipDelta),
      );
      r.trust = Math.max(0, Math.min(100, r.trust + c.relationshipDelta));
    }
  }
  const choiceEvent = recordWorldEvent(s, {
    month: s.month, kind: "pc.choice", personIds: ["player", ...(p.personId ? [p.personId] : [])],
    data: { eventId: p.eventId, choiceIndex: index, choiceLabel: c.label },
    visibility: "participants", pcKnowledge: { month: s.month, source: "direct" },
  });
  log(s, `${p.text} → ${c.label}`, choiceEvent.id);
  s.pending = null;
  return advanceMonth(s, events);
}
export function careerPrompt(s: GameState, eventId: string): PendingChoice {
  return {
    eventId,
    text:
      eventId === "career-start"
        ? "卒業を迎えた。適性に合う求人が届いた。"
        : eventId === "career-change"
          ? "転職の誘いが届いた。"
          : "求人情報が届いた。仕事を探そう。",
    choices: [
      ...jobOffers(s).map((j) => ({
        label: j.name,
        effects: [],
        jobId: j.id,
        successChance: offerChance(s, j),
      })),
      { label: "今回は応募しない", effects: [] },
    ],
  };
}
export function setAutoChoices(
  original: GameState,
  enabled: boolean,
): GameState {
  return { ...original, autoChoices: enabled };
}
export function autoResolve(
  original: GameState,
  events: EventDefinition[],
): GameState {
  let s = original;
  let count = 0;
  while (s.pending && s.autoChoices && count++ < 8) {
    const copy = structuredClone(s);
    const index = Math.floor(random(copy) * copy.pending!.choices.length);
    s = choose(copy, index, events);
  }
  return s;
}
function resolveFocus(s: GameState): void {
  const p = s.focusPlan;
  if (!p || p.month !== s.month || p.status !== "planned") return;
  const reason = actionReason(s, p.kind, p.intensity);
  if (reason) {
    p.status = "blocked"; p.reason = reason;
    log(s, "重点行動を実行できなかった：" + reason);
  } else {
    const result = takeAction(s, p.kind, p.intensity);
    Object.assign(s, result);
    s.focusPlan!.status = "executed";
    s.focusPlan!.actualHours = actionHours(p.intensity);
  }
}
export function takeAction(
  original: GameState,
  kind: "study" | "work" | "rest",
  intensity: Intensity = 1,
): GameState {
  const s = normalizeSocial(structuredClone(original));
  if (actionReason(s, kind, intensity)) return s;
  chargeTime(s, kind, actionHours(intensity));
  s.stats.money -= actionCost(kind, intensity);
  const factor = actionFactor(intensity);
  if (kind !== "rest") s.stress = Math.min(100, s.stress + ({ 1: 0, 2: 1, 3: 3 })[intensity]);
  const actions = {
    study: {
      text: "自主的に勉強した。",
      effects: [
        { stat: "knowledge", delta: 1 },
        { stat: "happiness", delta: -1 },
      ],
    },
    work: {
      text: "単発の仕事をした。",
      effects: [
        { stat: "money", delta: 1000 },
        { stat: "happiness", delta: -1 },
      ],
    },
    rest: {
      text: "ゆっくり休息した。",
      effects: [
        { stat: "happiness", delta: 2 },
        { stat: "health", delta: 1 },
      ],
    },
  } as const;
  const a = actions[kind];
  s.lastActionMonth = s.month;
  applyEffects(
    s,
    a.effects.map((e) => ({
      ...e,
      delta: factor * (kind === "study" && s.month < 72 ? e.delta * 0.05 : e.delta),
    })),
  );
  if (kind === "study" && s.traits?.includes("quickLearner"))
    applyEffects(s, [{ stat: "knowledge", delta: factor * (s.month < 72 ? 0.04 : 0.8) }]);
  if (kind !== "rest") practiceSkill(s, kind === "study" ? "learning" : "professional", factor);
  log(s, a.text);
  return s;
}

export function meetPerson(
  original: GameState,
  id: string,
  mode: "spend" | "talk" = "spend",
): GameState {
  const s = normalizeSocial(structuredClone(original));
  if (s.finished || s.pending || s.lastActionMonth === s.month || remainingHours(s) < 8) return s;
  const message = contact(s, s.month, id, mode);
  if (!message) return s;
  chargeTime(s, "交流", 8);
  if (s.traits?.includes("outgoing")) {
    const relation = s.relations.find((r) => r.id === id);
    if (relation) relation.closeness = Math.min(100, relation.closeness + 2);
  }
  s.lastActionMonth = s.month;
  applyEffects(
    s,
    mode === "talk"
      ? [{ stat: "sociability", delta: 2 }]
      : [
          { stat: "happiness", delta: 2 },
          { stat: "sociability", delta: 1 },
        ],
  );
  practiceSkill(s, "communication");
  log(s, message);
  if (mode === "talk") shareWorldEvents(s, id);
  return s;
}

export function setCareer(original: GameState, career: Career): GameState {
  const s = normalizeProgression(normalizeSocial(structuredClone(original)));
  if (
    s.pending ||
    s.finished ||
    !careerOptions(s).includes(career) ||
    s.career === career ||
    s.lastJobApplicationMonth === s.month
  )
    return s;
  s.lastJobApplicationMonth = s.month;
  if (random(s) * 100 < jobChance(s, career)) {
    s.career = career;
    s.jobId = null;
    s.careerLevel = 0;
    s.experience = 0;
    log(s, "採用され、新しい仕事を始めた。");
  } else {
    log(s, "応募したが採用されなかった。");
  }
  return s;
}
export function setUniversity(original: GameState, attend: boolean): GameState {
  const s = normalizeProgression(normalizeSocial(structuredClone(original)));
  if (
    s.pending ||
    s.finished ||
    s.month < 180 ||
    s.month >= 216 ||
    s.graduatedUniversity === attend
  )
    return s;
  s.graduatedUniversity = attend;
  s.studyPath = attend ? "university" : "job";
  log(
    s,
    attend ? "大学進学を目指すことにした。" : "高校卒業後は働くことにした。",
  );
  return s;
}
function requestLifeDecision(
  original: GameState,
  action: "date" | "marry" | "child",
  id?: string,
): GameState {
  if (original.pending || original.finished) return original;
  const pending = lifeDecision(original, action, id);
  if (!pending) return original;
  const s = structuredClone(original);
  s.pending = pending;
  s.monthStarted = true;
  s.lastChoiceMonth = s.month;
  s.lastSeen[pending.eventId] = s.month;
  return s;
}
export function startRomance(s: GameState, id: string): GameState {
  return requestLifeDecision(s, "date", id);
}
export function marry(s: GameState): GameState {
  return requestLifeDecision(s, "marry");
}
export function separate(original: GameState): GameState {
  const s = normalizeProgression(normalizeSocial(structuredClone(original)));
  if (s.pending || s.finished || (!s.partnerId && !s.spouseId)) return s;
  const id = s.spouseId ?? s.partnerId;
  const p = s.people.find((p) => p.id === id);
  log(s, (p?.name ?? "相手") + "と別れることになった。");
  if (p?.alive) {
    p.partnerId = null;
    p.spouseId = null;
  }
  s.partnerId = null;
  s.spouseId = null;
  return s;
}
export function haveChild(s: GameState): GameState {
  return requestLifeDecision(s, "child");
}

/** Supported old saves gain defaults; invalid input never overwrites a working save. */
export function normalizeGameState(value: unknown): GameState {
  assertRawStateFormat(value);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("セーブデータが不正です。");
  const check = (v: unknown, depth = 0): void => {
    if (depth > 30) throw Error("セーブの階層が深すぎます");
    if (typeof v === "number" && !Number.isFinite(v))
      throw Error("数値が不正です");
    if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (["__proto__", "prototype", "constructor"].includes(k))
          throw Error("不正なキーです");
        check(x, depth + 1);
      }
  };
  check(value);
  const v = value as Partial<GameState>;
  if (
    v.version !== STATE_VERSION ||
    !Number.isInteger(v.month) ||
    v.month! < 0 ||
    v.month! > 1440 ||
    !v.stats ||
    !Array.isArray(v.history) ||
    v.history.length > 10000
  )
    throw Error("対応していないセーブデータです。");
  if (!Number.isInteger(v.seed) || v.seed! < 0 || v.seed! > 4294967295)
    throw Error("乱数シードが不正です");
  for (const key of Object.keys(initialStats) as Stat[])
    if (
      !Number.isFinite(v.stats[key]) ||
      v.stats[key] < 0 ||
      (key !== "money" && v.stats[key] > 100)
    )
      throw Error("能力値が不正です。");
  if (
    !v.history.every(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.text === "string" &&
        (e.worldEventId === undefined || typeof e.worldEventId === "string") &&
        Number.isInteger(e.month),
    )
  )
    throw Error("記録が不正です。");
  const base = newGame(v.seed);
  const s = normalizeProgression(
    normalizeSocial({
      ...base,
      ...structuredClone(v),
      origin: { ...base.origin, ...v.origin },
    }),
  );
  if (v.capabilities === undefined) delete s.capabilities;
  else validateCapabilities(v.capabilities, s.month, s.traits);
  validateTimeExtensions(s);
  s.birthSeed = v.birthSeed ?? null;
  s.initialIdentityChoice = v.initialIdentityChoice ?? {};
  const options: Record<string, readonly string[]> = {
    worldId: WORLDS.map((w) => w.id),
    priority: [
      "learning",
      "relationships",
      "wellness",
      "hobby",
      "rest",
      "study",
      "social",
      "health",
    ],
    career: ["none", "parttime", "office", "technical", "creative", "service"],
    education: [
      "preschool",
      "elementary",
      "middle",
      "high",
      "university",
      "vocational",
      "working",
    ],
    studyPath: ["job", "vocational", "university"],
    club: ["none", "arts", "sports", "science"],
    living: ["basic", "standard", "comfortable"],
    housing: ["family", "rent", "owned"],
  };
  for (const [key, allowed] of Object.entries(options))
    if (!allowed.includes((s as any)[key])) throw Error(key + " が不正です");
  s.priority =
    (
      {
        study: "learning",
        social: "relationships",
        health: "wellness",
      } as Record<string, Priority>
    )[s.priority] ?? s.priority;
  if (v.studyPath === undefined && s.graduatedUniversity)
    s.studyPath = "university";
  if (v.degree === undefined && s.month >= 264 && s.graduatedUniversity)
    s.degree = "university";
  for (const key of [
    "debt",
    "savings",
    "investments",
    "stress",
    "workExperience",
    "lifetimeWork",
    "children",
    "careerLevel",
    "experience",
    "caregivingMonths",
  ] as const)
    if (!Number.isFinite(s[key]) || s[key] < 0)
      throw Error(key + " が不正です");
  for (const key of [
    "lastSeen",
    "flags",
    "purchases",
    "benefits",
    "expenseBreakdown",
  ] as const)
    if (!s[key] || typeof s[key] !== "object" || Array.isArray(s[key]))
      throw Error(key + " が不正です");
  if (
    !Object.values(s.flags).every((x) => typeof x === "boolean") ||
    !Object.values(s.benefits).every(Number.isFinite) ||
    !Object.values(s.lastSeen).every(Number.isFinite) ||
    !Object.values(s.purchases).every(Number.isFinite)
  )
    throw Error("履歴フラグが不正です");
  if (
    !Array.isArray(s.scheduled) ||
    !s.scheduled.every(
      (e) =>
        Number.isInteger(e.month) &&
        typeof e.text === "string" &&
        Array.isArray(e.effects) &&
        e.effects.every(
          (x) =>
            Object.keys(initialStats).includes(x.stat) &&
            Number.isFinite(x.delta),
        ),
    )
  )
    throw Error("遅延効果が不正です");
  if (
    !Array.isArray(s.timeline) ||
    !s.timeline.every(
      (e) => e && Number.isInteger(e.month) && typeof e.text === "string",
    ) ||
    !Array.isArray(s.achievements) ||
    !s.achievements.every((x) => typeof x === "string")
  )
    throw Error("年表が不正です");
  if (
    !Array.isArray(s.queue) ||
    !s.queue.every((x) => typeof x === "string") ||
    !Array.isArray(s.npcLinks)
  )
    throw Error("イベント進行が不正です");
  if (
    !s.people.every(
      (p) =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        Number.isFinite(p.birthMonth) &&
        typeof p.alive === "boolean" &&
        ["family", "friend", "teacher"].includes(p.kind),
    ) ||
    new Set(s.people.map((p) => p.id)).size !== s.people.length ||
    !s.relations.every(
      (r) =>
        r &&
        typeof r.id === "string" &&
        Number.isFinite(r.closeness) &&
        Number.isFinite(r.trust) &&
        Number.isFinite(r.lastContactMonth),
    )
  )
    throw Error("人物データが不正です");
  // Validate imported relations without clamping values or inventing people.
  // Other historical links and sentinel IDs need a separate migration policy.
  const personIds = new Set(s.people.map((p) => p.id));
  if (
    s.relations.some(
      (r) =>
        r.closeness < 0 || r.closeness > 100 ||
        r.trust < 0 || r.trust > 100 || !personIds.has(r.id),
    )
  )
    throw Error("関係値または人物への参照が不正です");
  if (
    !["male", "female", "nonbinary"].includes(s.identity.gender) ||
    !["heterosexual", "bisexual", "homosexual", "asexual"].includes(
      s.identity.orientation,
    )
  )
    throw Error("属性が不正です");
  if (
    !Array.isArray(s.traits) ||
    s.traits.some(
      (t) =>
        ![
          "quickLearner",
          "resilient",
          "outgoing",
          "frail",
          "creative",
          "careful",
        ].includes(t),
    )
  )
    throw Error("特性が不正です");
  if (
    !["struggling", "modest", "comfortable"].includes(s.origin.wealth) ||
    !["basic", "vocational", "university"].includes(s.origin.parentEducation) ||
    !["supportive", "strict", "unstable"].includes(s.origin.upbringing) ||
    !["city", "rural", "coastal"].includes(s.origin.region) ||
    !Number.isFinite(s.origin.schoolPerformance)
  )
    throw Error("出生条件が不正です");
  for (const key of [
    "finished",
    "monthStarted",
    "autoChoices",
    "retired",
    "restructured",
    "scholarship",
    "dropout",
    "graduatedUniversity",
  ] as const)
    if (typeof s[key] !== "boolean") throw Error(key + " が不正です");
  if (
    s.degree !== null &&
    !["high", "vocational", "university"].includes(s.degree)
  )
    throw Error("学歴が不正です");
  if (s.illness !== null && typeof s.illness !== "string")
    throw Error("病気の記録が不正です");
  if (s.deathCause !== null && typeof s.deathCause !== "string")
    throw Error("死因が不正です");
  if (s.jobId !== null && !JOBS.some((j) => j.id === s.jobId))
    throw Error("職業が不正です");
  if (!Number.isSafeInteger(s.logSequence) || s.logSequence < 0)
    throw Error("ログ番号が不正です");
  s.logSequence = Math.max(
    s.logSequence,
    ...s.history.map((e) =>
      /^log-[0-9]+$/.test(e.id) ? Number(e.id.slice(4)) : 0,
    ),
  );
  if (
    s.birthSeed !== null &&
    (!Number.isInteger(s.birthSeed) ||
      s.birthSeed < 0 ||
      s.birthSeed > 4294967295)
  )
    throw Error("出生シードが不正です");
  if (!s.initialIdentityChoice || typeof s.initialIdentityChoice !== "object")
    throw Error("出生属性が不正です");
  for (const p of s.people) {
    if (p.deathMonth !== undefined && p.deathMonth !== null &&
        (!Number.isInteger(p.deathMonth) || p.deathMonth < p.birthMonth || p.deathMonth > s.month || p.alive))
      throw Error("死亡年月が不正です");
    if (
      p.parentIds !== undefined &&
      (!Array.isArray(p.parentIds) ||
        !p.parentIds.every((x) => typeof x === "string"))
    )
      throw Error("家族データが不正です");
    if (
      p.gender !== undefined &&
      !["male", "female", "nonbinary"].includes(p.gender)
    )
      throw Error("人物属性が不正です");
  }
  if (
    s.npcLinks.some(
      (l) =>
        !l ||
        typeof l.a !== "string" ||
        typeof l.b !== "string" ||
        typeof l.kind !== "string" ||
        !Number.isFinite(l.since),
    )
  )
    throw Error("人物関係が不正です");
  const traitValues=['quickLearner','resilient','outgoing','frail','creative','careful'];
  if(!Array.isArray(s.origin.parentTraits)||s.origin.parentTraits.length!==2||!s.origin.parentTraits.every(ts=>Array.isArray(ts)&&ts.every(t=>traitValues.includes(t)))||typeof s.origin.parentOccupation!=='string'||!Number.isInteger(s.origin.siblings)||s.origin.siblings<0||s.origin.siblings>20||s.origin.schoolPerformance<0||s.origin.schoolPerformance>100)throw Error('家庭の記録が不正です');
  for(const p of s.people)if(p.traits!==undefined&&(!Array.isArray(p.traits)||p.traits.some(t=>!traitValues.includes(t))))throw Error('人物の特性が不正です');
  if (s.pending)
    validateEvents([
      {
        ...s.pending,
        id: s.pending.eventId,
        category: "growth",
        presentation: "choice",
        weight: 1,
      },
    ]);
  if (v.timeline === undefined)
    s.timeline = s.history
      .filter((e) => /【|卒業|進学|結婚|交際|就職/.test(e.text))
      .map(({ month, text }) => ({ month, text }))
      .reverse();
  validateRandomStreams(s.randomStreams);
  validateWorldHistory(s.worldHistory, s.month);
  return s;
}
