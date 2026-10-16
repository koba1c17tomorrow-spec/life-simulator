import type { GameState } from "./engine";
import type { Person, Relation } from "./social";
import { ownEntry } from "./npcKnowledgeView";
export type NpcTier = "Active" | "Dormant" | "Archived";
export type NpcTiers = {
  version: 1;
  updates: "full";
  observedSinceMonth: number;
  lastObservedMonth: number;
  entries: Record<string, { tier: NpcTier; lastDetailedMonth: number | null }>;
};
export function classifyNpc(
  s: GameState,
  p: Person,
  r = s.relations.find((r) => r.id === p.id),
): NpcTier {
  if (!p.alive) return "Archived";
  if (
    s.partnerId === p.id ||
    s.spouseId === p.id ||
    (!p.movedAway && (p.kind === "family" || (r?.closeness ?? 0) >= 50)) ||
    (r && s.month - r.lastContactMonth <= 6)
  )
    return "Active";
  return "Dormant";
}
/** Observes a completed full-update boundary. No lazy replay is enabled. */
export function observeNpcTiers(
  s: GameState,
  detailedIds: readonly string[] = [],
): void {
  const n = (s.npcTiers ??= {
    version: 1,
    updates: "full",
    observedSinceMonth: s.month,
    lastObservedMonth: s.month,
    entries: {},
  });
  const detailed = new Set(detailedIds),
    relations = new Map<string, Relation>(s.relations.map((r) => [r.id, r]));
  for (const p of s.people) {
    if (["__proto__", "prototype", "constructor", "player"].includes(p.id))
      throw Error("NPCに予約識別子は使えません");
    const old = ownEntry(n.entries, p.id);
    n.entries[p.id] = {
      ...old,
      tier: classifyNpc(s, p, relations.get(p.id)),
      lastDetailedMonth:
        old?.tier === "Archived"
          ? old.lastDetailedMonth
          : detailed.has(p.id)
            ? s.month
            : (old?.lastDetailedMonth ?? null),
    };
  }
  n.lastObservedMonth = s.month;
}
export function validateNpcTiers(s: GameState): void {
  const n = s.npcTiers;
  if (n === undefined) return;
  const month = (x: number) => Number.isInteger(x) && x >= 0 && x <= s.month;
  if (
    !n ||
    n.version !== 1 ||
    n.updates !== "full" ||
    !month(n.observedSinceMonth) ||
    !month(n.lastObservedMonth) ||
    n.lastObservedMonth < n.observedSinceMonth ||
    !n.entries ||
    typeof n.entries !== "object" ||
    Array.isArray(n.entries)
  )
    throw Error("NPC更新段階が不正です");
  for (const [id, v] of Object.entries(n.entries))
    if (
      !s.people.some((p) => p.id === id) ||
      !v ||
      !["Active", "Dormant", "Archived"].includes(v.tier) ||
      (v.lastDetailedMonth !== null &&
        (!month(v.lastDetailedMonth) ||
          v.lastDetailedMonth < n.observedSinceMonth)) ||
      (v.tier === "Archived" && s.people.find((p) => p.id === id)?.alive)
    )
      throw Error("NPC更新時刻・参照が不正です");
}
