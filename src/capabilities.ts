import type { GameState } from "./engine";
import type { Trait } from "./traits";
export const skillNames = {
  learning: "学習技法",
  professional: "実務",
  communication: "対話",
};
export type Skill = keyof typeof skillNames;
export type Capabilities = {
  version: 1;
  observedSinceMonth: number;
  legacyBaseline: boolean;
  skills: Record<Skill, number>;
  practice: Record<Skill, number>;
  revealedTraits: Trait[];
};
export function initialCapabilities(
  month = 0,
  legacyBaseline = false,
): Capabilities {
  return {
    version: 1,
    observedSinceMonth: month,
    legacyBaseline,
    skills: { learning: 0, professional: 0, communication: 0 },
    practice: { learning: 0, professional: 0, communication: 0 },
    revealedTraits: [],
  };
}
export function visibleTraits(
  s: Pick<GameState, "traits" | "capabilities">,
): Trait[] {
  return !s.capabilities || s.capabilities.legacyBaseline
    ? s.traits
    : s.capabilities.revealedTraits;
}
export type PracticeContext = "self" | "school" | "job";
export function practiceSkill(s: GameState, skill: Skill, units = 1): void {
  practiceHours(s, skill, units * 8);
}
export function practiceHours(
  s: GameState,
  skill: Skill,
  hours: number,
  context: PracticeContext = "self",
): void {
  if (!Number.isFinite(hours) || hours < 0) throw Error("練習時間が不正です");
  if (hours === 0 || s.finished) return;
  s.capabilities ??= initialCapabilities(s.month, true);
  const c = s.capabilities;
  const affinity =
    skill === "learning"
      ? "quickLearner"
      : skill === "communication"
        ? "outgoing"
        : "resilient";
  const density =
    context === "school" ? 0.1 / 17.5 : context === "job" ? 0.1 / 20 : 1;
  const units = (hours / 8) * density;
  let environment =
    (skill === "learning" &&
      s.education !== "preschool" &&
      s.education !== "working") ||
    (skill === "professional" && s.career !== "none" && !s.retired)
      ? 1.1
      : 1;
  const benefit =
    skill === "learning"
      ? "learning"
      : skill === "professional"
        ? "qualification"
        : "social";
  if ((s.benefits[benefit] ?? -1) >= s.month) environment *= 1.2;
  c.skills[skill] = Math.min(
    100,
    c.skills[skill] +
      units *
        (s.traits.includes(affinity) ? 1.2 : 1) *
        Math.min(1, s.stats.health / 85) *
        Math.max(0.2, 1 - s.stress / 125) *
        environment *
        (1 - c.skills[skill] / 100),
  );
  c.practice[skill] += units;
  const relevant: Record<Skill, Trait[]> = {
    learning: ["quickLearner", "creative"],
    communication: ["outgoing", "careful"],
    professional: ["resilient", "frail"],
  };
  for (const t of relevant[skill])
    if (
      c.practice[skill] >= 3 &&
      s.traits.includes(t) &&
      !c.revealedTraits.includes(t)
    )
      c.revealedTraits.push(t);
}
export function validateCapabilities(
  value: unknown,
  month: number,
  traits: Trait[],
): void {
  const c = value as Capabilities;
  if (
    !c ||
    c.version !== 1 ||
    !Number.isInteger(c.observedSinceMonth) ||
    c.observedSinceMonth < 0 ||
    c.observedSinceMonth > month ||
    typeof c.legacyBaseline !== "boolean" ||
    !Array.isArray(c.revealedTraits) ||
    new Set(c.revealedTraits).size !== c.revealedTraits.length ||
    !c.revealedTraits.every((t) => traits.includes(t))
  )
    throw Error("能力モデルが不正です");
  for (const k of Object.keys(skillNames) as Skill[])
    if (
      !Number.isFinite(c.skills?.[k]) ||
      c.skills[k] < 0 ||
      c.skills[k] > 100 ||
      !Number.isFinite(c.practice?.[k]) ||
      c.practice[k] < 0
    )
      throw Error("技能が不正です");
}
