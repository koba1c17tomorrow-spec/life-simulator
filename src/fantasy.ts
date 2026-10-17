import type { GameState, EventDefinition } from "./engine";
import { worldRules } from "./worldRules";
import { cloneState } from "./cloneState";
import { societyMonth } from "./society";
import { societyEventsMonth } from "./societyEvents";
import { prepareNpcAgency, npcAgencyMonth } from "./npcAgency";
import { observeNpcTiers } from "./npcTiers";
import { recordNpcFact, npcFact } from "./npcEvents";
import {
  budgetFor,
  chargeTime,
  remainingHours,
  actionHours,
  actionFactor,
  actionCost,
  type Intensity,
} from "./timeBudget";
import { practiceHours } from "./capabilities";
import { delayedMonth } from "./health";
import { record } from "./journal";
import { scenarioActive, resumeScenarioMonth } from "./scenarios";
export type FantasyState = {
  version: 1;
  species: "human" | "elf";
  role: string;
  magic: number;
  magicHours: number;
};
export function initializeFantasy(s: GameState, species?: string): void {
  if (species !== undefined && !["human", "elf"].includes(species))
    throw Error("未知の種族です");
  s.fantasy = {
    version: 1,
    species:
      species === "elf"
        ? "elf"
        : species === "human"
          ? "human"
          : s.seed % 2
            ? "elf"
            : "human",
    role: "farmer",
    magic: 0,
    magicHours: 0,
  };
  s.stats.money = 20;
  s.origin.parentOccupation = "手仕事";
  s.jobId = null;
  s.history[0].text =
    "街と工房のある世界に生まれた。冒険をしなくても、暮らしは続いていく。";
  for (const p of s.people) {
    p.species = s.fantasy.species;
    p.education = undefined;
  }
  for (let i = 1; i <= 3; i++) {
    s.people.push({
      id: "friend-" + i,
      name: ["隣家の職人", "市の商人", "農園の知人"][i - 1],
      kind: "friend",
      birthMonth: -240,
      alive: true,
      health: 85,
      occupation: "employed",
      species: i === 3 ? "human" : s.fantasy.species,
      personality: i === 2 ? "quiet" : "kind",
      values: i === 3 ? "freedom" : "family",
      gender: i === 2 ? "female" : "male",
      orientation: "bisexual",
    });
    s.relations.push({
      id: "friend-" + i,
      closeness: 35,
      trust: 35,
      lastContactMonth: 0,
    });
  }
  s.nextPersonId = 4;
}
function draw(s: GameState) {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
export function setFantasyRole(original: GameState, role: string): GameState {
  if (
    !original.fantasy ||
    !Object.hasOwn(worldRules("fantasy").careers, role) ||
    original.month < 192 ||
    original.pending ||
    original.finished ||
    scenarioActive(original)
  )
    return original;
  const s = cloneState(original);
  s.fantasy!.role = role;
  return s;
}
export function practiceMagic(original: GameState): GameState {
  if (
    !original.fantasy ||
    original.month < 72 ||
    original.pending ||
    original.finished ||
    scenarioActive(original) ||
    original.lastActionMonth === original.month ||
    original.stats.health < 20 ||
    remainingHours(original) < 8
  )
    return original;
  const s = cloneState(original);
  chargeTime(s, "生活魔法の練習", 8);
  s.lastActionMonth = s.month;
  s.fantasy!.magic = Math.min(
    100,
    s.fantasy!.magic + 0.5 * (1 - s.fantasy!.magic / 100),
  );
  s.fantasy!.magicHours += 8;
  practiceHours(s, "learning", 8);
  record(s, "灯りや道具を扱う、日常の魔法を練習した。");
  return s;
}
export function fantasyAction(
  s: GameState,
  kind: "study" | "work" | "rest",
  intensity: Intensity,
): void {
  const hours = actionHours(intensity),
    factor = actionFactor(intensity);
  chargeTime(s, kind, hours);
  s.lastActionMonth = s.month;
  s.stats.money -= kind === "study" ? intensity - 1 : 0;
  if (kind === "work") {
    s.stats.money += Math.round(3 * factor);
    practiceHours(s, "professional", hours);
    s.stress = Math.min(100, s.stress + factor);
  }
  if (kind === "study") {
    practiceHours(s, "learning", hours);
    s.stats.knowledge = Math.min(100, s.stats.knowledge + 0.1 * factor);
  }
  if (kind === "rest") {
    s.stats.health = Math.min(100, s.stats.health + factor);
    s.stress = Math.max(0, s.stress - factor);
  }
  record(
    s,
    "【活動】" +
      { study: "徒弟の学習", work: "町の手仕事", rest: "休息" }[kind] +
      "に取り組んだ。",
  );
}
export function advanceFantasyMonth(
  s: GameState,
  events: EventDefinition[],
): GameState {
  if (s.finished || s.pending) return s;
  const rules = worldRules("fantasy"),
    f = s.fantasy!;
  if (!s.monthStarted) {
    s.month++;
    s.monthStarted = true;
    societyMonth(s);
    societyEventsMonth(s);
    delayedMonth(
      s,
      (effects) => {
        for (const e of effects) {
          s.stats[e.stat] = Math.max(0, s.stats[e.stat] + e.delta);
          if (e.stat !== "money")
            s.stats[e.stat] = Math.min(100, s.stats[e.stat]);
        }
      },
      (text) => record(s, text),
    );
    s.education =
      s.month < 72
        ? "preschool"
        : s.month < rules.education.adultMonth
          ? "elementary"
          : "working";
    const adult = s.month >= rules.education.adultMonth;
    s.career = adult ? "office" : "none";
    s.jobId = null;
    const job = rules.careers[f.role];
    // Same public environment multiplier is available for every household, not a PC success bonus.
    const economy = 1 + (s.society!.axes.economy - 45) / 1000;
    s.monthlyIncome = adult
      ? Math.round(job.income * economy)
      : rules.economy.childAllowance;
    s.monthlyExpenses = adult
      ? rules.economy.monthlyCost + s.children * 3
      : rules.economy.childAllowance;
    s.expenseBreakdown = { "生活費（銀貨）": s.monthlyExpenses };
    const available = s.stats.money + s.monthlyIncome - s.monthlyExpenses;
    if (available < 0) {
      s.debt -= available;
      s.stats.money = 0;
    } else s.stats.money = available;
    const lifespan = rules.species[f.species].lifespanMonths;
    s.stats.health = Math.max(
      0,
      Math.min(100, s.stats.health + (s.month > lifespan - 180 ? -0.12 : 0.02)),
    );
    const sanitation = (s.society!.axes.publicHealth - 40) / 10000;
    s.stats.health = Math.max(0, Math.min(100, s.stats.health + sanitation));
    prepareNpcAgency(s);
    const ids = s.people.filter((p) => p.alive).map((p) => p.id);
    for (const p of s.people) {
      if (!p.alive) continue;
      const age = s.month - p.birthMonth,
        limit = rules.species[p.species ?? "human"].lifespanMonths;
      p.health = Math.max(
        0,
        Math.min(
          100,
          (p.health ?? 85) + (age > limit - 180 ? -0.12 : 0.02) + sanitation,
        ),
      );
      if (age >= limit || p.health <= 0) {
        p.alive = false;
        p.deathMonth = s.month;
        recordNpcFact(
          s,
          p.name + "が亡くなった。",
          npcFact("npc.death", [p.id], {
            pcPartner: p.id === s.partnerId || p.id === s.spouseId,
          }),
        );
      }
    }
    s.timeBudget = budgetFor(s);
    if (s.month >= lifespan || s.stats.health <= 0) {
      s.finished = true;
      s.deathCause = s.stats.health <= 0 ? "健康の衰弱" : "寿命";
      s.monthStarted = false;
      s.queue = [];
      resumeScenarioMonth(s);
      record(s, "【人生の終わり】" + s.deathCause + "により人生を終えた。");
      return s;
    }
    if (adult) {
      practiceHours(
        s,
        f.role === "scholar" ? "learning" : "professional",
        job.hours,
        "job",
      );
      s.workExperience++;
    } else if (s.month >= 72) practiceHours(s, "learning", 140, "school");
    npcAgencyMonth(s);
    observeNpcTiers(s, ids);
    for (const e of events) {
      if (
        (e.minAge ?? 0) <= s.month &&
        (e.maxAge ?? 1440) >= s.month &&
        s.month - (s.lastSeen[e.id] ?? -9999) >= (e.cooldownMonths ?? 12) &&
        draw(s) < 0.02
      ) {
        s.lastSeen[e.id] = s.month;
        for (const effect of e.effects ?? [])
          s.stats[effect.stat] = Math.max(
            0,
            effect.stat === "money"
              ? s.stats.money + effect.delta
              : Math.min(100, s.stats[effect.stat] + effect.delta),
          );
        record(s, e.text);
      }
    }
  }
  const plan = s.focusPlan;
  if (plan?.month === s.month && plan.status === "planned") {
    if (
      s.lastActionMonth !== s.month &&
      remainingHours(s) >= actionHours(plan.intensity) &&
      s.stats.money >= (plan.kind === "study" ? plan.intensity - 1 : 0) &&
      s.stats.health >= 20
    ) {
      fantasyAction(s, plan.kind, plan.intensity);
      plan.status = "executed";
      plan.actualHours = actionHours(plan.intensity);
      plan.reason = "実行した";
    } else {
      plan.status = "blocked";
      plan.actualHours = 0;
      plan.reason = "時間・資金・体調または行動枠が不足した";
    }
  }
  s.monthStarted = false;
  resumeScenarioMonth(s);
  return s;
}
export function validateFantasy(s: GameState): void {
  const f = s.fantasy;
  if (s.worldId !== "fantasy") {
    if (f !== undefined) throw Error("世界固有状態が不正です");
    return;
  }
  const r = worldRules("fantasy");
  if (
    !f ||
    f.version !== 1 ||
    !Object.hasOwn(r.species, f.species) ||
    !Object.hasOwn(r.careers, f.role) ||
    !Number.isFinite(f.magic) ||
    f.magic < 0 ||
    f.magic > 100 ||
    !Number.isFinite(f.magicHours) ||
    f.magicHours < 0 ||
    s.people.some((p) => !p.species || !Object.hasOwn(r.species, p.species))
  )
    throw Error("ファンタジー状態が不正です");
}
