export type Trait =
  | "quickLearner"
  | "resilient"
  | "outgoing"
  | "frail"
  | "creative"
  | "careful";
export const traitNames: Record<Trait, string> = {
  quickLearner: "飲み込みが早い",
  resilient: "粘り強い",
  outgoing: "社交的",
  frail: "病弱",
  creative: "創造的",
  careful: "慎重",
};
export const traitDescriptions: Record<Trait, string> = {
  quickLearner: "勉強の効果が高い",
  resilient: "仕事による疲労が軽い",
  outgoing: "交流で親密度が上がりやすい",
  frail: "健康が下がりやすい",
  creative: "創作系の仕事に向いている",
  careful: "浪費を抑えやすい",
};
/** A small familial bias, without treating game traits as real genetics. */
export function randomTraits(
  random: () => number,
  inherited: Trait[] = [],
): Trait[] {
  const pool = Object.keys(traitNames) as Trait[];
  const count = 1 + Math.min(2, Math.floor(random() * 3));
  const result: Trait[] = [];
  for (let i = 0; i < count; i++) {
    const family = pool.filter((t) => inherited.includes(t));
    const candidates = family.length && random() < 0.3 ? family : pool;
    const trait =
      candidates[
        Math.min(
          candidates.length - 1,
          Math.floor(random() * candidates.length),
        )
      ];
    result.push(trait);
    pool.splice(pool.indexOf(trait), 1);
  }
  return result;
}
export function traitMonthlyEffects(traits: Trait[], working: boolean) {
  return {
    health:
      (traits.includes("frail") ? -0.012 : 0) +
      (working && traits.includes("resilient") ? 0.008 : 0),
    knowledge: traits.includes("quickLearner") ? 0.006 : 0,
    sociability: traits.includes("outgoing") ? 0.004 : 0,
  };
}
