import type { GameState } from "./engine";
import {
  societyDraw,
  socialClamp,
  SOCIAL_AXES,
  type SocialAxis,
} from "./society";
import { recordWorldEvent, type WorldEvent } from "./worldHistory";
export type SocialEventKind = "random" | "conditional" | "history";
type Occurrence = { eventId: string; month: number };
export type SocietyEvents = {
  version: 1;
  startMonth: number;
  lastTick: number;
  lastEventMonth: number | null;
  latest: Record<string, Occurrence>;
  contribution?: Occurrence;
};
export type SocialEventDefinition = {
  id: string;
  kind: SocialEventKind;
  visibility: "public" | "private";
  cooldown: number;
  effects: Partial<Record<SocialAxis, number>>;
  text: string;
  fantasyText: string;
  reason: string;
};
export const SOCIAL_EVENTS: readonly SocialEventDefinition[] = [
  {
    id: "supply-delay",
    kind: "random",
    visibility: "public",
    cooldown: 36,
    effects: { economy: -2 },
    text: "物流が一時的に滞り、地域の商いが少し鈍った。",
    fantasyText: "街道の荷運びが滞り、市の商いが少し鈍った。",
    reason: "日常の供給の偶発的な乱れ",
  },
  {
    id: "sanitation",
    kind: "conditional",
    visibility: "public",
    cooldown: 36,
    effects: { publicHealth: 1 },
    text: "衛生状況を受け、地域で清掃と保健案内が行われた。",
    fantasyText: "衛生状況を受け、井戸と水路の清掃が行われた。",
    reason: "公衆衛生が48未満",
  },
  {
    id: "council-review",
    kind: "conditional",
    visibility: "private",
    cooldown: 36,
    effects: { stability: 0.5 },
    text: "内部会議で行政運営の調整が行われた。",
    fantasyText: "評議会の内部で統治の調整が行われた。",
    reason: "政治的安定が48未満",
  },
  {
    id: "supply-recovery",
    kind: "history",
    visibility: "public",
    cooldown: 36,
    effects: { economy: 1 },
    text: "先の物流の滞りから、取引が少しずつ回復した。",
    fantasyText: "先の荷運びの滞りから、市の取引が少しずつ回復した。",
    reason: "供給の乱れから3〜24か月、未回復",
  },
  {
    id: "community-result",
    kind: "history",
    visibility: "public",
    cooldown: 120,
    effects: { tolerance: 0.5, mobility: 0.5 },
    text: "継続的な居場所づくりが、小さな交流の機会につながった。",
    fantasyText: "継続的な集会所づくりが、小さな交流の機会につながった。",
    reason: "導入後の地域活動への参加選択から24か月以上",
  },
];
function prepare(s: GameState): SocietyEvents {
  return (s.societyEvents ??= {
    version: 1,
    startMonth: s.month,
    lastTick: s.month - 1,
    lastEventMonth: null,
    latest: {},
  });
}
export function noteSocietyChoice(s: GameState, e: WorldEvent): void {
  if (!s.society) return; // An old pending choice predates this feature boundary.
  if (
    e.kind === "pc.choice" &&
    e.data.eventId === "community_project" &&
    e.data.choiceIndex === 0
  )
    prepare(s).contribution = { eventId: e.id, month: e.month };
}
export function socialCandidates(
  s: GameState,
): { definition: SocialEventDefinition; causes: string[] }[] {
  const society = s.society,
    state = s.societyEvents;
  if (
    !society ||
    !state ||
    (state.lastEventMonth !== null && s.month - state.lastEventMonth < 12)
  )
    return [];
  return SOCIAL_EVENTS.flatMap((definition) => {
    const last = state.latest[definition.id];
    if (last && s.month - last.month < definition.cooldown) return [];
    let causes: string[] = [];
    if (definition.id === "sanitation" && society.axes.publicHealth >= 48)
      return [];
    if (definition.id === "council-review" && society.axes.stability >= 48)
      return [];
    if (definition.id === "supply-recovery") {
      const cause = state.latest["supply-delay"];
      if (
        !cause ||
        s.month - cause.month < 3 ||
        s.month - cause.month > 24 ||
        (last && last.month >= cause.month)
      )
        return [];
      causes = [cause.eventId];
    }
    if (definition.id === "community-result") {
      const cause = state.contribution;
      if (
        !cause ||
        s.month - cause.month < 24 ||
        (last && last.month >= cause.month) ||
        !s.flags.community
      )
        return [];
      causes = [cause.eventId];
    }
    return [{ definition, causes }];
  });
}
export function societyEventsMonth(s: GameState): void {
  if (!s.society) return;
  const state = prepare(s);
  if (state.lastTick >= s.month) return;
  state.lastTick = s.month;
  const candidates = socialCandidates(s);
  // No forced incident; a single attempt and at most one event per month.
  if (!candidates.length || societyDraw(s.society) >= 0.04) return;
  const { definition: d, causes } =
    candidates[Math.floor(societyDraw(s.society) * candidates.length)];
  const actual: Partial<Record<SocialAxis, number>> = {};
  for (const key of SOCIAL_AXES)
    if (d.effects[key] !== undefined) {
      const before = s.society.axes[key];
      s.society.axes[key] = socialClamp(before + d.effects[key]!);
      actual[key] = s.society.axes[key] - before;
    }
  const event = recordWorldEvent(s, {
    month: s.month,
    kind: "society." + d.id,
    personIds: [],
    visibility: d.visibility,
    data: {
      definitionId: d.id,
      category: d.kind,
      text: s.society.profile === "fantasy" ? d.fantasyText : d.text,
      reason: d.reason,
      causes,
      effects: actual,
    },
  });
  state.latest[d.id] = { eventId: event.id, month: s.month };
  state.lastEventMonth = s.month;
  // Publication is not observation. P4-3's explicit news action grants PC knowledge.
}
export function validateSocietyEvents(s: GameState): void {
  const v = s.societyEvents;
  if (v === undefined) return;
  const month = (n: number) => Number.isInteger(n) && n >= 0 && n <= s.month;
  const ids = new Map(s.worldHistory?.events.map((e) => [e.id, e]) ?? []);
  if (
    !s.society ||
    !v ||
    v.version !== 1 ||
    !month(v.startMonth) ||
    !month(v.lastTick) ||
    v.lastTick < v.startMonth - 1 ||
    (v.lastEventMonth !== null &&
      (!month(v.lastEventMonth) ||
        v.lastEventMonth < v.startMonth ||
        v.lastEventMonth > v.lastTick)) ||
    !v.latest ||
    typeof v.latest !== "object" ||
    Array.isArray(v.latest)
  )
    throw Error("社会イベント状態が不正です");
  for (const [id, o] of Object.entries(v.latest)) {
    const event = o && ids.get(o.eventId);
    if (
      !SOCIAL_EVENTS.some((d) => d.id === id) ||
      !o ||
      !month(o.month) ||
      o.month < v.startMonth ||
      o.month > v.lastTick ||
      !event ||
      event.month !== o.month ||
      event.kind !== "society." + id
    )
      throw Error("社会イベント参照が不正です");
  }
  if (v.contribution) {
    const e = ids.get(v.contribution.eventId);
    if (
      !month(v.contribution.month) ||
      !e ||
      e.month !== v.contribution.month ||
      e.kind !== "pc.choice" ||
      e.data.eventId !== "community_project" ||
      e.data.choiceIndex !== 0
    )
      throw Error("社会貢献の参照が不正です");
  }
}
