import { JOBS } from "./careers";
import type { EventDefinition } from "./engine";
export const WORLDS = [
  { id: "modern", name: "現代の人生" },
  { id: "coastal", name: "海辺の町の人生" },
];
export function validateManifest(
  value: unknown,
  id: string,
): { id: string; name: string; events: string } {
  if (!value || typeof value !== "object")
    throw Error("ワールド定義が不正です");
  const v = value as Record<string, unknown>;
  if (
    v.id !== id ||
    typeof v.name !== "string" ||
    !v.name ||
    typeof v.events !== "string" ||
    !/^[-a-zA-Z0-9_]+\.json$/.test(v.events)
  )
    throw Error("ワールド定義が不正です");
  return v as { id: string; name: string; events: string };
}
export async function loadWorld(id: string): Promise<EventDefinition[]> {
  if (!WORLDS.some((w) => w.id === id)) throw Error("未知のワールドです");
  const manifestResponse = await fetch(`/worlds/${id}/manifest.json`);
  if (!manifestResponse.ok) throw Error("ワールドを読み込めません");
  const manifest = validateManifest(await manifestResponse.json(), id);
  const response = await fetch(`/worlds/${id}/${manifest.events}`);
  if (!response.ok) throw Error("イベントを読み込めません");
  return validateEvents(await response.json());
}
const traits = [
  "quickLearner",
  "resilient",
  "outgoing",
  "frail",
  "creative",
  "careful",
];
function optionalString(o: Record<string, any>, keys: string[]) {
  for (const k of keys)
    if (o[k] !== undefined && (typeof o[k] !== "string" || !o[k]))
      fail(k + " は空でない文字列が必要です");
}
const stats = ["health", "happiness", "knowledge", "sociability", "money"];
const fail = (message: string): never => {
  throw Error("イベント定義: " + message);
};
function object(v: unknown): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function effects(v: unknown) {
  if (v === undefined) return;
  if (
    !Array.isArray(v) ||
    !v.every(
      (e) => object(e) && stats.includes(e.stat) && Number.isFinite(e.delta),
    )
  )
    fail("効果が不正です");
}
function requirements(v: unknown) {
  if (v === undefined) return;
  if (!Array.isArray(v)) fail("条件が不正です");
  for (const r of v as any[]) {
    if (!object(r)) fail("条件が不正です");
    if (
      Object.keys(r).some(
        (k) =>
          ![
            "field",
            "min",
            "max",
            "trait",
            "wealth",
            "career",
            "education",
            "flag",
            "notFlag",
            "region",
            "jobId",
            "employed",
          ].includes(k),
      )
    )
      fail("未知の条件キー");
    optionalString(r, ["flag", "notFlag", "career", "education"]);
    if (r.trait !== undefined && !traits.includes(r.trait)) fail("未知の特性");
    if (
      r.wealth !== undefined &&
      !["struggling", "modest", "comfortable"].includes(r.wealth)
    )
      fail("未知の家庭経済");
    if (
      r.region !== undefined &&
      !["city", "rural", "coastal"].includes(r.region)
    )
      fail("未知の地域");
    if (r.jobId !== undefined && !JOBS.some((j) => j.id === r.jobId))
      fail("未知の職種");
    if (r.employed !== undefined && typeof r.employed !== "boolean")
      fail("就業条件が不正です");
    if (
      r.field &&
      !stats
        .concat(["schoolPerformance", "debt", "ageMonths", "friendCloseness"])
        .includes(r.field)
    )
      fail("未知の条件");
    for (const k of ["min", "max"])
      if (r[k] !== undefined && !Number.isFinite(r[k]))
        fail("条件値が不正です");
    if (r.min !== undefined && r.max !== undefined && r.min > r.max)
      fail("条件の範囲が逆です");
  }
}
export function validateEvents(value: unknown): EventDefinition[] {
  if (!Array.isArray(value) || !value.length || value.length > 10000)
    fail("イベント配列が必要です");
  const ids = new Set<string>();
  for (const e of value as any[]) {
    if (!object(e) || typeof e.id !== "string" || !e.id || ids.has(e.id))
      fail("IDの欠落・重複");
    ids.add(e.id);
    if (
      typeof e.text !== "string" ||
      !e.text ||
      !["growth", "social", "work", "health"].includes(e.category) ||
      !["log", "choice", "silent"].includes(e.presentation) ||
      !Number.isFinite(e.weight) ||
      e.weight < 0
    )
      fail(e.id + " の基本項目が不正です");
    for (const k of [
      "minAge",
      "maxAge",
      "cooldownMonths",
      "priority",
      "requiresFriendCloseness",
    ])
      if (e[k] !== undefined && (!Number.isFinite(e[k]) || e[k] < 0))
        fail(e.id + " の範囲が不正です");
    if (e.minAge !== undefined && e.maxAge !== undefined && e.minAge > e.maxAge)
      fail(e.id + " の年齢範囲が逆です");
    optionalString(e, ["setFlag"]);
    if (e.usesFriendName !== undefined && typeof e.usesFriendName !== "boolean")
      fail("人物名の設定が不正です");
    effects(e.effects);
    requirements(e.requires);
    if (
      e.presentation === "choice" &&
      (!Array.isArray(e.choices) || !e.choices.length)
    )
      fail(e.id + " に選択肢が必要です");
    if (e.choices !== undefined) {
      if (!Array.isArray(e.choices)) fail("選択肢が不正です");
      for (const c of e.choices) {
        if (
          !object(c) ||
          typeof c.label !== "string" ||
          !c.label ||
          !Array.isArray(c.effects)
        )
          fail("選択肢が不正です");
        optionalString(c, [
          "setFlag",
          "successFlag",
          "failureFlag",
          "successText",
          "failureText",
        ]);
        for (const key of ["university", "leaveSchool", "restructureDebt"])
          if (c[key] !== undefined && typeof c[key] !== "boolean")
            fail("選択肢の設定が不正です");
        if (
          c.club !== undefined &&
          !["none", "arts", "sports", "science"].includes(c.club)
        )
          fail("未知の部活動");
        if (
          c.studyPath !== undefined &&
          !["job", "vocational", "university"].includes(c.studyPath)
        )
          fail("未知の進路");
        if (
          c.career !== undefined &&
          ![
            "none",
            "parttime",
            "office",
            "technical",
            "creative",
            "service",
          ].includes(c.career)
        )
          fail("未知の職業");
        if (c.jobId !== undefined && !JOBS.some((j) => j.id === c.jobId))
          fail("未知の職種");
        if (
          c.lifeAction !== undefined &&
          !["date", "marry", "child"].includes(c.lifeAction)
        )
          fail("未知の人生の決断");
        for (const key of ["relationshipDelta", "successChance"])
          if (c[key] !== undefined && !Number.isFinite(c[key]))
            fail("選択肢の数値が不正です");
        effects(c.effects);
        effects(c.successEffects);
        effects(c.failureEffects);
        requirements(c.requires);
        if (c.roll) {
          if (c.roll.trait !== undefined && !traits.includes(c.roll.trait))
            fail("判定の特性が不正です");
          if (
            !object(c.roll) ||
            !Number.isFinite(c.roll.base) ||
            (c.roll.stat && !stats.includes(c.roll.stat))
          )
            fail("成功率が不正です");
          for (const k of [
            "statFactor",
            "gradeFactor",
            "traitBonus",
            "wealthBonus",
          ])
            if (c.roll[k] !== undefined && !Number.isFinite(c.roll[k]))
              fail("成功率係数が不正です");
        }
        if (c.delayed) {
          if (
            !object(c.delayed) ||
            !Number.isInteger(c.delayed.months) ||
            c.delayed.months < 1 ||
            typeof c.delayed.text !== "string"
          )
            fail("遅延効果が不正です");
          if (!Array.isArray(c.delayed.effects)) fail("遅延効果が不正です");
          optionalString(c.delayed, ["flag"]);
          effects(c.delayed.effects);
        }
      }
    }
  }
  return value as EventDefinition[];
}
