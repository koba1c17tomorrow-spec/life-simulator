import { it, expect } from "vitest";
import modern from "../public/worlds/modern/events.json";
import coastal from "../public/worlds/coastal/events.json";
import {
  newGame,
  advanceMonth,
  autoResolve,
  normalizeGameState,
  type Priority,
} from "../src/engine";
import { validateEvents } from "../src/content";
const worlds = [validateEvents(modern), validateEvents(coastal)];
it("100 seeded complete lives stay finite, age appropriately and never block in random mode", async () => {
  const results: {
    seed: number;
    age: number;
    choices: number;
    net: number;
    children: number;
    workingAt40: boolean;
    healthAt40: number;
    knowledgeAt6: number;
  }[] = [];
  const policies: Priority[] = [
    "relationships",
    "wellness",
    "learning",
    "hobby",
    "rest",
  ];
  for (let seed = 1; seed <= 100; seed++) {
    const events = worlds[seed % 2];
    let s = newGame(seed * 7919, {}, seed % 2 ? "coastal" : "modern");
    s.autoChoices = true;
    s.priority = policies[seed % 5];
    let steps = 0,
      choices = 0,
      knowledgeAt6 = 0,
      workingAt40 = false,
      healthAt40 = 0;
    while (!s.finished && steps++ < 1250) {
      const n = advanceMonth(s, events);
      if (n.pending) choices++;
      s = autoResolve(n, events);
      if (s.pending) throw Error(`seed ${seed}: blocked at ${s.month}`);
      if (
        !Object.values(s.stats).every(Number.isFinite) ||
        ![
          s.debt,
          s.savings,
          s.investments,
          s.monthlyIncome,
          s.monthlyExpenses,
        ].every((x) => Number.isFinite(x) && x >= 0)
      )
        throw Error(`seed ${seed}: invalid finances`);
      if (
        s.children > 4 ||
        s.people.some((p) => s.month - p.birthMonth < 0) ||
        s.relations.some(
          (r) =>
            r.closeness < 0 ||
            r.closeness > 100 ||
            r.trust < 0 ||
            r.trust > 100,
        )
      )
        throw Error(`seed ${seed}: invalid family state`);
      if (s.month === 72) knowledgeAt6 = s.stats.knowledge;
      if (s.month === 480) {
        workingAt40 = s.career !== "none";
        healthAt40 = s.stats.health;
        s = normalizeGameState(JSON.parse(JSON.stringify(s)));
      }
    }
    expect(s.finished, `seed ${seed} must complete`).toBe(true);
    expect(s.month).toBeLessThanOrEqual(1200);
    expect(s.deathCause).toBeTruthy();
    expect(knowledgeAt6).toBeLessThan(30);
    expect(choices).toBeLessThan(170);
    await new Promise((resolve) => setTimeout(resolve, 0));
    results.push({
      seed,
      age: s.month / 12,
      choices,
      net: Math.round(s.stats.money + s.savings + s.investments - s.debt),
      children: s.children,
      workingAt40,
      healthAt40,
      knowledgeAt6,
    });
  }
  const average = (
    key: "age" | "net" | "choices" | "knowledgeAt6" | "healthAt40",
  ) => results.reduce((n, r) => n + r[key], 0) / results.length;
  const summary = {
    lives: results.length,
    minAge: Math.min(...results.map((r) => r.age)),
    averageAge: average("age"),
    maxAge: Math.max(...results.map((r) => r.age)),
    averageChoices: average("choices"),
    maxKnowledgeAt6: Math.max(...results.map((r) => r.knowledgeAt6)),
    workingAt40: results.filter((r) => r.workingAt40).length,
    averageHealthAt40: average("healthAt40"),
    averageFinalNetAssets: average("net"),
    parents: results.filter((r) => r.children > 0).length,
  };
  console.log("LONG_SIMULATION", JSON.stringify(summary));
  expect(summary.minAge).toBeGreaterThan(60);
  expect(summary.workingAt40).toBeGreaterThan(60);
  expect(summary.averageHealthAt40).toBeGreaterThan(30);
  expect(summary.averageHealthAt40).toBeLessThan(90);
  expect(summary.parents).toBeGreaterThan(5);
}, 180000);
