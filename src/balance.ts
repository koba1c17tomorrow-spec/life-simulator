export type RelativeStat = "health" | "happiness" | "knowledge" | "sociability";
export function ageAverage(month: number, key: RelativeStat): number {
  const age = month / 12;
  if (key === "knowledge")
    return Math.max(
      18,
      18 + Math.min(age, 22) * 1.6 - Math.max(0, age - 60) * 0.3,
    );
  if (key === "health") return Math.max(25, 82 - Math.max(0, age - 25) * 0.7);
  if (key === "happiness") return 58;
  return Math.max(
    25,
    35 + Math.min(age, 25) * 0.9 - Math.max(0, age - 65) * 0.4,
  );
}
export function relativeScore(
  value: number,
  month: number,
  key: RelativeStat,
): number {
  return Math.max(
    0,
    Math.min(100, Math.round(50 + value - ageAverage(month, key))),
  );
}
export function naturalGrowth(
  month: number,
  career: string,
): Record<RelativeStat, number> {
  const age = month / 12,
    working = career !== "none" && age >= 18 && age < 65;
  return {
    health:
      age < 18
        ? 0.005
        : age < 45
          ? working
            ? -0.025
            : 0.005
          : age < 65
            ? -0.045
            : -0.1,
    happiness: (58 - 60) * 0.002,
    knowledge:
      age < 3
        ? 0.035
        : age < 6
          ? 0.07
          : age < 18
            ? 0.13
            : age < 23
              ? 0.1
              : age < 60
                ? -0.008
                : -0.025,
    sociability:
      age < 6 ? 0.025 : age < 25 ? 0.065 : age < 65 ? -0.008 : -0.025,
  };
}
export function monthlyDrift(
  month: number,
  career: string,
  priority: string,
): Record<RelativeStat, number> {
  const growth = naturalGrowth(month, career);
  const focus =
    priority === "study"
      ? "learning"
      : priority === "social"
        ? "relationships"
        : priority === "health"
          ? "wellness"
          : priority;
  const target =
    focus === "learning"
      ? "knowledge"
      : focus === "relationships"
        ? "sociability"
        : focus === "wellness"
          ? "health"
          : "happiness";
  // A floor makes care useful during stagnation/decline, without reversing old-age decline.
  growth[target] += Math.max(Math.abs(growth[target]), 0.02) * 0.1;
  if (focus === "learning") growth.happiness -= 0.004;
  return growth;
}

/** Existing 0..100 scale: repeated gains above the observed school-age band taper. */
export function abilityGain(current: number, delta: number): number {
  return delta > 0 && current > 60
    ? delta * Math.max(0, (100 - current) / 40)
    : delta;
}
