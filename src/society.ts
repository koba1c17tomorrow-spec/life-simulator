import type { GameState } from "./engine";
import { createRandomStreams, drawFromStream } from "./randomStreams";
export const SOCIAL_AXES = [
  "economy",
  "safety",
  "stability",
  "mobility",
  "publicHealth",
  "tolerance",
] as const;
export type SocialAxis = (typeof SOCIAL_AXES)[number];
export type Axes = Record<SocialAxis, number>;
export type Society = {
  version: 1;
  profile: "modern" | "coastal" | "fantasy";
  startMonth: number;
  lastUpdatedMonth: number;
  legacyBaseline: boolean;
  axes: Axes;
  randomState: number;
};
const profiles: Record<Society["profile"], number[]> = {
  modern: [50, 50, 50, 50, 50, 50],
  coastal: [48, 55, 50, 48, 52, 52],
  fantasy: [45, 40, 45, 35, 40, 35],
};
export function createSociety(
  world: string,
  month: number,
  seed: number,
  legacyBaseline: boolean,
): Society {
  const profile =
    world === "fantasy"
      ? "fantasy"
      : world === "coastal"
        ? "coastal"
        : "modern";
  return {
    version: 1,
    profile,
    startMonth: month,
    lastUpdatedMonth: month,
    legacyBaseline,
    axes: Object.fromEntries(
      SOCIAL_AXES.map((key, i) => [key, profiles[profile][i]]),
    ) as Axes,
    randomState: createRandomStreams(seed).states.worldSociety,
  };
}
/** Dedicated worldSociety continuation; never initializes or consumes legacy/NPC streams. */
export function societyDraw(s: Society): number {
  const streams = {
    version: 1 as const,
    states: {
      pcHealth: 0,
      npcRelations: 0,
      events: 0,
      worldSociety: s.randomState,
    },
  };
  const result = drawFromStream(streams, "worldSociety");
  s.randomState = streams.states.worldSociety;
  return result;
}
export const socialClamp = (n: number) => Math.max(0, Math.min(100, n));
export function societyMonth(s: GameState): void {
  if (!s.society) {
    s.society = createSociety(s.worldId, s.month, s.seed, true);
    return;
  }
  const society = s.society;
  if (society.lastUpdatedMonth >= s.month) return;
  // No synthetic catch-up for periods which were not simulated by this feature.
  for (const [i, key] of SOCIAL_AXES.entries())
    society.axes[key] = socialClamp(
      society.axes[key] +
        0.02 * (profiles[society.profile][i] - society.axes[key]) +
        (societyDraw(society) - 0.5) * 0.8,
    );
  society.lastUpdatedMonth = s.month;
}
/** Shared environment gate for PC invitations and NPC-to-NPC invitations. */
export function societyRestriction(
  s: Pick<GameState, "society">,
  intent: string,
): string | null {
  return intent === "spend" && s.society && s.society.axes.safety < 20
    ? "治安の悪化により外出して過ごす予定を立てられない"
    : null;
}
export function validateSociety(s: GameState): void {
  const v = s.society;
  if (v === undefined) return;
  if (
    !v ||
    v.version !== 1 ||
    !Object.hasOwn(profiles, v.profile) ||
    v.profile !==
      (s.worldId === "coastal"
        ? "coastal"
        : s.worldId === "fantasy"
          ? "fantasy"
          : "modern") ||
    !Number.isInteger(v.startMonth) ||
    v.startMonth < 0 ||
    v.startMonth > s.month ||
    !Number.isInteger(v.lastUpdatedMonth) ||
    v.lastUpdatedMonth < v.startMonth ||
    v.lastUpdatedMonth > s.month ||
    typeof v.legacyBaseline !== "boolean" ||
    !Number.isInteger(v.randomState) ||
    v.randomState < 0 ||
    v.randomState > 0xffffffff ||
    !v.axes ||
    Object.keys(v.axes).length !== 6 ||
    !SOCIAL_AXES.every(
      (k) => Number.isFinite(v.axes[k]) && v.axes[k] >= 0 && v.axes[k] <= 100,
    )
  )
    throw Error("社会状態が不正です");
}
