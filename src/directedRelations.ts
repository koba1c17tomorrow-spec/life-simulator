import type { GameState } from "./engine";
import type { SocialState, Person } from "./social";
export const emotionAxes = [
  "liking",
  "trust",
  "closeness",
  "respect",
  "attraction",
] as const;
export type Emotions = Record<(typeof emotionAxes)[number], number | null>;
export type DirectedEdge = Emotions & {
  from: string;
  to: string;
  sinceMonth: number;
  observed?: { month: number; attitude: string };
};
export type RelationshipModel = {
  version: 1;
  observedSinceMonth: number;
  edges: DirectedEdge[];
  lastInteraction?: {
    month: number;
    from: string;
    to: string;
    outcome: number;
  };
};
type Context = SocialState &
  Partial<Pick<GameState, "traits" | "priority" | "stats">>;
const empty = (): Emotions => ({
  liking: null,
  trust: null,
  closeness: null,
  respect: null,
  attraction: null,
});
export function feelings(s: SocialState, from: string, to: string): Emotions {
  const e = s.relationshipModel?.edges.find(
    (e) => e.from === from && e.to === to,
  );
  const result: Emotions = e
    ? {
        liking: e.liking,
        trust: e.trust,
        closeness: e.closeness,
        respect: e.respect,
        attraction: e.attraction,
      }
    : empty();
  if (from === "player") {
    const r = s.relations.find((r) => r.id === to);
    result.trust = r?.trust ?? null;
    result.closeness = r?.closeness ?? null;
  }
  return result;
}
function profile(s: Context, id: string): Partial<Person> {
  if (id !== "player") return s.people.find((p) => p.id === id) ?? {};
  return {
    personality: s.traits?.includes("outgoing")
      ? "bold"
      : s.traits?.includes("careful")
        ? "quiet"
        : "kind",
    values:
      s.priority === "relationships"
        ? "family"
        : s.priority === "learning"
          ? "career"
          : undefined,
    health: s.stats?.health ?? 85,
  };
}
function sign(n: number): number {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}
function compatibility(
  s: Context,
  owner: string,
  other: string,
  mode: "talk" | "spend",
): number {
  const a = profile(s, owner),
    b = profile(s, other);
  let score = 1;
  if ((a.personality ?? "kind") === "kind") score++;
  if (a.personality === "quiet") score += mode === "talk" ? 1 : -1;
  if (a.personality === "bold" && mode === "spend") score++;
  if (a.values && b.values) score += a.values === b.values ? 1 : -1;
  if ((a.health ?? 85) < 35 || a.illness) score -= 3;
  if ((feelings(s, owner, other).liking ?? 50) < 30) score -= 2;
  return sign(score);
}
function edge(
  s: SocialState,
  month: number,
  from: string,
  to: string,
): DirectedEdge {
  s.relationshipModel ??= { version: 1, observedSinceMonth: month, edges: [] };
  let e = s.relationshipModel.edges.find((e) => e.from === from && e.to === to);
  if (!e) {
    e = { from, to, sinceMonth: month, ...empty() };
    s.relationshipModel.edges.push(e);
  }
  return e;
}
function add(
  e: DirectedEdge,
  key: (typeof emotionAxes)[number],
  delta: number,
): void {
  e[key] = Math.max(0, Math.min(100, (e[key] ?? 50) + delta));
}
export function interact(
  s: Context,
  month: number,
  from: string,
  to: string,
  mode: "talk" | "spend" = "spend",
): { outcome: number; attitude: string } | null {
  if (
    from === to ||
    ![from, to].every(
      (id) => id === "player" || s.people.some((p) => p.id === id && p.alive),
    )
  )
    return null;
  const a = edge(s, month, from, to),
    b = edge(s, month, to, from);
  const forward = compatibility(s, from, to, mode),
    reverse = compatibility(s, to, from, mode);
  for (const [e, delta] of [
    [a, forward],
    [b, reverse],
  ] as const) {
    add(e, "liking", delta * 3);
    add(e, "respect", delta);
    if (e.from !== "player") {
      add(e, "trust", delta * (mode === "talk" ? 4 : 2));
      add(e, "closeness", delta * (mode === "spend" ? 4 : 2));
    }
  }
  if (from === "player" || to === "player") {
    const id = from === "player" ? to : from;
    const r = s.relations.find((r) => r.id === id);
    const response = from === "player" ? reverse : forward;
    if (r) {
      r.closeness = Math.max(
        0,
        Math.min(100, r.closeness + response * (mode === "spend" ? 7 : 2)),
      );
      r.trust = Math.max(
        0,
        Math.min(100, r.trust + response * (mode === "talk" ? 6 : 2)),
      );
      r.lastContactMonth = month;
    }
    const incoming = from === "player" ? b : a;
    incoming.observed = {
      month,
      attitude:
        response > 0
          ? "会話や同席に応じ、穏やかに過ごした"
          : response < 0
            ? "意見が合わず、距離を置く様子があった"
            : "挨拶は交わしたが、会話はあまり続かなかった",
    };
  }
  s.relationshipModel!.lastInteraction = { month, from, to, outcome: reverse };
  return {
    outcome: reverse,
    attitude:
      reverse > 0
        ? "親しく過ごした。"
        : reverse < 0
          ? "意見が食い違い、距離を感じた。"
          : "挨拶を交わしたが、大きな変化はなかった。",
  };
}
export function registerInterest(s: SocialState, month: number, from: string, to: string, delta: number): void {
  if ([from,to].every(id => id === "player" || s.people.some(p => p.id === id && p.alive))) add(edge(s,month,from,to),"attraction",delta);
}
export function observedAttitude(s: SocialState, id: string): string {
  return (
    s.relationshipModel?.edges.find((e) => e.from === id && e.to === "player")
      ?.observed?.attitude ?? "まだ応対を観測していない"
  );
}
export function validateRelationshipModel(s: GameState): void {
  const m = s.relationshipModel;
  if (m === undefined) return;
  const validMonth = (n: number) =>
    Number.isInteger(n) && n >= 0 && n <= s.month;
  const ids = new Set(["player", ...s.people.map((p) => p.id)]),
    pairs = new Set<string>();
  if (
    !m ||
    m.version !== 1 ||
    !validMonth(m.observedSinceMonth) ||
    !Array.isArray(m.edges)
  )
    throw Error("方向別関係が不正です");
  for (const e of m.edges) {
    const key = JSON.stringify([e?.from, e?.to]);
    if (
      !e ||
      !ids.has(e.from) ||
      !ids.has(e.to) ||
      e.from === e.to ||
      pairs.has(key) ||
      !validMonth(e.sinceMonth) ||
      e.sinceMonth < m.observedSinceMonth ||
      !emotionAxes.every(
        (k) =>
          e[k] === null ||
          (Number.isFinite(e[k]) && e[k]! >= 0 && e[k]! <= 100),
      ) ||
      (e.from === "player" && (e.trust !== null || e.closeness !== null)) ||
      (e.observed !== undefined &&
        (!e.observed ||
          !validMonth(e.observed.month) ||
          typeof e.observed.attitude !== "string"))
    )
      throw Error("関係軸または人物参照が不正です");
    pairs.add(key);
  }
  const i = m.lastInteraction;
  if (
    i !== undefined &&
    (!i ||
      !validMonth(i.month) ||
      !ids.has(i.from) ||
      !ids.has(i.to) ||
      i.from === i.to ||
      ![-1, 0, 1].includes(i.outcome))
  )
    throw Error("交流記録が不正です");
}
