import type { Capabilities } from "./capabilities";
import type { Trait } from "./traits";
import type { Origin } from "./origins";
export type RuleStat =
  | "health"
  | "happiness"
  | "knowledge"
  | "sociability"
  | "money";
export type RuleField =
  | RuleStat
  | "schoolPerformance"
  | "debt"
  | "ageMonths"
  | "friendCloseness";
export type Requirement = {
  employed?: boolean;
  flag?: string;
  notFlag?: string;
  region?: string;
  jobId?: string;
  field?: RuleField;
  min?: number;
  max?: number;
  trait?: Trait;
  wealth?: Origin["wealth"];
  career?: string;
  education?: string;
};
export type RollRule = {
  base: number;
  stat?: RuleStat;
  statFactor?: number;
  gradeFactor?: number;
  trait?: Trait;
  traitBonus?: number;
  wealth?: Origin["wealth"];
  wealthBonus?: number;
};
export type RuleContext = {
  capabilities?: Capabilities;
  month: number;
  stats: Record<RuleStat, number>;
  origin?: Origin;
  traits?: Trait[];
  career?: string;
  education?: string;
  debt?: number;
  friendCloseness?: number;
  flags?: Record<string, boolean>;
  jobId?: string | null;
  benefits?: Record<string, number>;
};
export function satisfies(
  ctx: RuleContext,
  requirements: Requirement[] = [],
): boolean {
  return requirements.every((r) => {
    if (
      r.employed !== undefined &&
      (ctx.career !== undefined && ctx.career !== "none") !== r.employed
    )
      return false;
    if (r.flag && !ctx.flags?.[r.flag]) return false;
    if (r.notFlag && ctx.flags?.[r.notFlag]) return false;
    if (r.region && ctx.origin?.region !== r.region) return false;
    if (r.jobId && ctx.jobId !== r.jobId) return false;
    if (r.trait && !ctx.traits?.includes(r.trait)) return false;
    if (r.wealth && ctx.origin?.wealth !== r.wealth) return false;
    if (r.career && ctx.career !== r.career) return false;
    if (r.education && ctx.education !== r.education) return false;
    if (r.field) {
      const value =
        r.field === "ageMonths"
          ? ctx.month
          : r.field === "schoolPerformance"
            ? ctx.origin?.schoolPerformance
            : r.field === "debt"
              ? ctx.debt
              : r.field === "friendCloseness"
                ? ctx.friendCloseness
                : ctx.stats[r.field];
      if (value === undefined || !Number.isFinite(value)) return false;
      if (r.min !== undefined && value < r.min) return false;
      if (r.max !== undefined && value > r.max) return false;
    }
    return true;
  });
}
export function rollFactors(
  ctx: RuleContext,
  rule: RollRule,
): Record<string, number> {
  return {
    基礎: rule.base,
    習得技能:
      rule.stat && ctx.capabilities
        ? Math.min(
            5,
            ctx.capabilities.skills[
              rule.stat === "knowledge"
                ? "learning"
                : rule.stat === "sociability"
                  ? "communication"
                  : "professional"
            ] / 20,
          ) *
          (["knowledge", "sociability", "money"].includes(rule.stat) ? 1 : 0)
        : 0,
    能力: rule.stat ? (ctx.stats[rule.stat] ?? 0) * (rule.statFactor ?? 0) : 0,
    成績: (ctx.origin?.schoolPerformance ?? 0) * (rule.gradeFactor ?? 0),
    特性:
      rule.trait && ctx.traits?.includes(rule.trait)
        ? (rule.traitBonus ?? 0)
        : 0,
    家庭:
      rule.wealth && ctx.origin?.wealth === rule.wealth
        ? (rule.wealthBonus ?? 0)
        : 0,
    趣味への投資:
      rule.trait === "creative" &&
      ctx.benefits?.creative !== undefined &&
      ctx.benefits.creative >= ctx.month
        ? 5
        : 0,
  };
}
export function rollChance(ctx: RuleContext, rule: RollRule): number {
  return Math.max(
    0,
    Math.min(
      ctx.capabilities &&
        rule.stat &&
        ["knowledge", "sociability", "money"].includes(rule.stat)
        ? 95
        : 100,
      Math.round(
        Object.values(rollFactors(ctx, rule)).reduce((a, b) => a + b, 0),
      ),
    ),
  );
}
export function rollExplanation(ctx: RuleContext, rule: RollRule): string {
  return Object.entries(rollFactors(ctx, rule))
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => `${k}${v >= 0 ? "+" : ""}${v.toFixed(1)}`)
    .join(" / ");
}
