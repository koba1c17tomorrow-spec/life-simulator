import type { GameState } from "./engine";
import { cloneState } from "./cloneState";
import { budgetFor, chargeTime, remainingHours } from "./timeBudget";
import { learnWorldEvent } from "./npcEvents";
import { SOCIAL_AXES, type SocialAxis } from "./society";
export const SOCIAL_LABELS: Record<SocialAxis, string> = {
  economy: "経済状況",
  safety: "治安",
  stability: "政治的安定",
  mobility: "社会的流動性",
  publicHealth: "公衆衛生",
  tolerance: "寛容性",
};
export type SocietyKnowledge = {
  version: 1;
  observedMonth: number;
  bands: Record<SocialAxis, number>;
};
const BANDS = ["厳しい", "やや厳しい", "中程度", "比較的良好", "良好"];
export function newsReason(s: GameState): string {
  if (s.pending || s.finished) return "進行停止中は確認できません";
  if (!s.society) return "社会状態の観測開始前です";
  if (s.societyKnowledge?.observedMonth === s.month)
    return "今月は確認済みです";
  if (remainingHours(s) < 2) return "確認に必要な2時間がありません";
  return "";
}
/** Explicit observation, independent of simulation updates and view rendering. */
export function readSocialNews(original: GameState): GameState {
  if (newsReason(original)) return original;
  const s = cloneState(original);
  s.timeBudget = budgetFor(s);
  chargeTime(s, "社会の知らせを確認", 2);
  // Only publicly released events; an unpublished NPC/private society fact is never eligible.
  let count = 0;
  for (const e of s.worldHistory?.events ?? []) {
    if (count >= 8) break;
    if (
      e.kind.startsWith("society.") &&
      e.visibility === "public" &&
      !e.pcKnowledge &&
      e.month <= s.month &&
      learnWorldEvent(s, e.id, "public")
    )
      count++;
  }
  s.societyKnowledge = {
    version: 1,
    observedMonth: s.month,
    bands: Object.fromEntries(
      SOCIAL_AXES.map((k) => [
        k,
        Math.min(4, Math.floor(s.society!.axes[k] / 20)),
      ]),
    ) as Record<SocialAxis, number>,
  };
  return s;
}
/** UI consumes this projection, never the live axes, NPC actors or private facts. */
export function socialPresentation(s: GameState) {
  const knowledge = s.societyKnowledge;
  const known = new Map(
    (s.worldHistory?.events ?? [])
      .filter((e) => e.pcKnowledge)
      .map((e) => [e.id, e]),
  );
  const events = [...known.values()]
    .filter((e) => e.kind.startsWith("society.") && e.visibility === "public")
    .slice(-8)
    .reverse()
    .map((e) => {
      const causes = Array.isArray(e.data.causes)
        ? e.data.causes.filter((id): id is string => typeof id === "string")
        : [];
      const confirmed =
        causes.length > 0 && causes.every((id) => known.has(id));
      const actions = confirmed
        ? causes
            .map((id) => known.get(id)!)
            .filter((c) => c.kind === "pc.choice")
            .map((c) => String(c.data.choiceLabel ?? "以前の選択"))
        : [];
      const effects = e.data.effects;
      return {
        id: e.id,
        text:
          typeof e.data.text === "string"
            ? e.data.text
            : "社会の変化を知った。",
        occurredMonth: e.month,
        learnedMonth: e.pcKnowledge!.month,
        explanation: actions.length
          ? "以前の選択「" +
            actions.join("、") +
            "」が地域の変化の一因になった。"
          : confirmed
            ? "以前に知った出来事とのつながりが確認された。"
            : "詳しい因果関係は未確認です。",
        changes: SOCIAL_AXES.flatMap((k) => {
          const n =
            effects && typeof effects === "object" && !Array.isArray(effects)
              ? effects[k]
              : undefined;
          return typeof n === "number" && Number.isFinite(n) && n !== 0
            ? [`${SOCIAL_LABELS[k]} ${n > 0 ? "+" : ""}${n.toFixed(1)}`]
            : [];
        }),
      };
    });
  return {
    observedMonth: knowledge?.observedMonth ?? null,
    axes: SOCIAL_AXES.map((key) => ({
      key,
      label: SOCIAL_LABELS[key],
      state: knowledge ? BANDS[knowledge.bands[key]] : "未確認",
    })),
    events,
  };
}
export function validateSocietyKnowledge(s: GameState): void {
  const k = s.societyKnowledge;
  if (k === undefined) return;
  if (
    !s.society ||
    !k ||
    k.version !== 1 ||
    !Number.isInteger(k.observedMonth) ||
    k.observedMonth < s.society.startMonth ||
    k.observedMonth > s.month ||
    !k.bands ||
    Object.keys(k.bands).length !== 6 ||
    !SOCIAL_AXES.every(
      (a) => Number.isInteger(k.bands[a]) && k.bands[a] >= 0 && k.bands[a] <= 4,
    )
  )
    throw Error("社会の観測情報が不正です");
}
