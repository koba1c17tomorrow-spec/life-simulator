import { scenarioActive } from "./scenarios";
import type { GameState } from "./engine";
export type ActionKind = "study" | "work" | "rest";
export type Intensity = 1 | 2 | 3;
export type TimeBudget = {
  version: 1;
  participation?: { school: number; work: number };
  month: number;
  allocations: Record<string, number>;
  activities: { kind: string; hours: number }[];
  overload: number;
  legacyBaseline: boolean;
};
export type FocusPlan = {
  month: number;
  kind: ActionKind;
  intensity: Intensity;
  status: "planned" | "executed" | "blocked";
  actualHours: number;
  reason: string;
};
export const actionHours = (i: Intensity) => ({ 1: 8, 2: 16, 3: 32 })[i];
export const actionFactor = (i: Intensity) => ({ 1: 1, 2: 1.5, 3: 2 })[i];
export const actionCost = (k: ActionKind, i: Intensity) =>
  k === "study" ? { 1: 0, 2: 500, 3: 1000 }[i] : 0;
function demands(s: GameState): Record<string, number> {
  return {
    睡眠: 240,
    休息: 60,
    家事: 60,
    学業:
      s.month >= 72 && s.education !== "working" && s.education !== "preschool"
        ? 140
        : 0,
    仕事:
      s.career !== "none" && !s.retired && s.month >= 192
        ? s.career === "parttime"
          ? 80
          : 160
        : 0,
    家庭: s.children * 8,
    療養: s.illness ? 48 : 0,
    疲労回復: s.stress >= 80 ? 24 : 0,
    生活方針: 24,
  };
}
export function budgetFor(s: GameState): TimeBudget {
  const b: TimeBudget =
    s.timeBudget?.month === s.month
      ? structuredClone(s.timeBudget)
      : {
          version: 1,
          month: s.month,
          allocations: {},
          activities: [],
          overload: 0,
          legacyBaseline: !s.capabilities || s.capabilities.legacyBaseline,
        };
  const used = b.activities.reduce((n, a) => n + a.hours, 0);
  let remaining = Math.max(
    0,
    720 - used - Object.values(b.allocations).reduce((a, b) => a + b, 0),
  );
  let overload = 0;
  for (const [k, hours] of Object.entries(demands(s))) {
    const extra = Math.max(0, hours - (b.allocations[k] ?? 0));
    const reserved = Math.min(remaining, extra);
    b.allocations[k] = (b.allocations[k] ?? 0) + reserved;
    remaining -= reserved;
    overload += extra - reserved;
  }
  b.overload = overload;
  return b;
}
export function remainingHours(s: GameState): number {
  const b = budgetFor(s);
  return (
    720 -
    Object.values(b.allocations).reduce((a, b) => a + b, 0) -
    b.activities.reduce((n, a) => n + a.hours, 0)
  );
}
export function chargeTime(s: GameState, kind: string, hours: number): void {
  s.timeBudget = budgetFor(s);
  if (hours > remainingHours(s)) throw Error("時間予算を超えています");
  s.timeBudget.activities.push({ kind, hours });
}
export function actionReason(
  s: GameState,
  kind: ActionKind,
  intensity: Intensity = 1,
): string {
  if (![1, 2, 3].includes(intensity)) return "行動強度が不正です";
  if (scenarioActive(s)) return "シナリオ進行中です";
  if (s.finished || s.pending) return "進行停止中は実行できません";
  if (s.lastActionMonth === s.month)
    return "自主行動・交流・重点行動は月1回までです";
  if (kind === "study" && s.month < 36) return "勉強は3歳からです";
  if (kind === "work" && s.month < 192) return "単発仕事は16歳からです";
  if (kind !== "rest" && s.stats.health < (intensity === 3 ? 40 : 20))
    return "健康状態が実行条件を満たしません";
  if (s.stats.money < actionCost(kind, intensity))
    return "所持金が不足しています";
  if (remainingHours(s) < actionHours(intensity))
    return "残り時間が不足しています";
  return "";
}
export function planFocus(
  s: GameState,
  kind: ActionKind,
  intensity: Intensity,
): GameState {
  if (
    scenarioActive(s) ||
    s.finished ||
    s.pending ||
    s.monthStarted ||
    !["study", "work", "rest"].includes(kind) ||
    ![1, 2, 3].includes(intensity)
  )
    return s;
  return {
    ...s,
    focusPlan: {
      month: s.month + 1,
      kind,
      intensity,
      status: "planned",
      actualHours: 0,
      reason: "",
    },
  };
}
export function validateTimeExtensions(s: GameState): void {
  const b = s.timeBudget;
  if (b !== undefined) {
    if (
      !b ||
      b.version !== 1 ||
      !Number.isInteger(b.month) ||
      b.month < 0 ||
      b.month > s.month ||
      typeof b.legacyBaseline !== "boolean" ||
      !b.allocations ||
      typeof b.allocations !== "object" ||
      Array.isArray(b.allocations) ||
      !Array.isArray(b.activities) ||
      !Number.isFinite(b.overload) ||
      b.overload < 0
    )
      throw Error("時間予算が不正です");
    if (
      b.participation !== undefined &&
      (!b.participation ||
        !["school", "work"].every((k) => {
          const x = b.participation![k as "school" | "work"];
          return (
            Number.isFinite(x) &&
            x >= 0 &&
            x <= (b.allocations[k === "school" ? "学業" : "仕事"] ?? 0)
          );
        }))
    )
      throw Error("参加時間が不正です");
    const values = Object.values(b.allocations);
    if (
      !values.every((x) => Number.isFinite(x) && x >= 0) ||
      !b.activities.every(
        (a) =>
          a &&
          typeof a.kind === "string" &&
          Number.isFinite(a.hours) &&
          a.hours > 0,
      ) ||
      values.reduce((a, b) => a + b, 0) +
        b.activities.reduce((n, a) => n + a.hours, 0) >
        720
    )
      throw Error("時間消費が不正です");
  }
  const p = s.focusPlan;
  if (
    p !== undefined &&
    (!p ||
      !Number.isInteger(p.month) ||
      p.month < 0 ||
      p.month > s.month + 1 ||
      !["study", "work", "rest"].includes(p.kind) ||
      ![1, 2, 3].includes(p.intensity) ||
      !["planned", "executed", "blocked"].includes(p.status) ||
      typeof p.reason !== "string" ||
      (p.month > s.month && p.status !== "planned") ||
      p.actualHours !==
        (p.status === "executed" ? actionHours(p.intensity) : 0))
  )
    throw Error("重点行動が不正です");
}
