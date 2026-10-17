// Run with Node after npm ci; Vite only loads the existing TypeScript engine.
import { createServer } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const out = process.argv[2];
if (!out) throw Error("Usage: node scripts/balance-study.mjs output.json");
const server = await createServer({ server: { middlewareMode: true } });
try {
  const { newGame, advanceMonth, autoResolve } =
    await server.ssrLoadModule("/src/engine.ts");
  const policies = ["relationships", "wellness", "learning", "hobby", "rest"];
  const byWealth = { struggling: [], modest: [], comfortable: [] };
  for (let i = 1; i <= 100; i++) {
    const seed = i * 7919;
    const w = newGame(seed).origin.wealth;
    if (byWealth[w].length < 2) byWealth[w].push(seed);
  }
  const seeds = Object.values(byWealth)
    .flat()
    .sort((a, b) => a - b);
  const events = {
    modern: JSON.parse(
      readFileSync("public/worlds/modern/events.json", "utf8"),
    ),
    coastal: JSON.parse(
      readFileSync("public/worlds/coastal/events.json", "utf8"),
    ),
  };
  const net = (s) => s.stats.money + s.savings + s.investments - s.debt;
  const snapshot = (s) => ({
    month: s.month,
    knowledge: s.stats.knowledge,
    sociability: s.stats.sociability,
    health: s.stats.health,
    income: s.monthlyIncome,
    net: net(s),
    level: s.careerLevel,
    career: s.career,
    education: s.degree,
  });
  const lives = [];
  for (const seed of seeds)
    for (const world of ["modern", "coastal"])
      for (const policy of policies) {
        let s = newGame(seed, {}, world);
        s.autoChoices = true;
        s.priority = policy;
        const row = {
          seed,
          world,
          policy,
          wealth: s.origin.wealth,
          traits: s.traits,
          snapshots: {},
          unemployedMonths: 0,
          jobStarts: 0,
          promotions: 0,
          university: false,
          vocational: false,
          maxLevel: 0,
        };
        for (let step = 0; step < 1250 && !s.finished; step++) {
          const old = s;
          s = autoResolve(advanceMonth(s, events[world]), events[world]);
          if (s.pending) throw Error("Blocked " + seed);
          if (
            s.month >= 216 &&
            s.month < 780 &&
            s.career === "none" &&
            !["university", "vocational"].includes(s.education)
          )
            row.unemployedMonths++;
          if (old.career === "none" && s.career !== "none") row.jobStarts++;
          if (s.careerLevel > old.careerLevel)
            row.promotions += s.careerLevel - old.careerLevel;
          row.maxLevel = Math.max(row.maxLevel, s.careerLevel);
          row.university ||= s.education === "university";
          row.vocational ||= s.education === "vocational";
          if ([72, 216, 480, 780].includes(s.month))
            row.snapshots[s.month] = snapshot(s);
        }
        if (!s.finished) throw Error("Did not finish " + seed);
        Object.assign(row, { age: s.month / 12, finalNet: net(s) });
        lives.push(row);
        if (lives.length % 10 === 0)
          console.log("Observed lives", lives.length);
      }
  const recovery = [];
  for (const seed of seeds)
    for (const world of ["modern", "coastal"])
      for (const mode of ["low-income", "unemployed"]) {
        let s = newGame(seed, {}, world);
        Object.assign(s, {
          month: 300,
          education: "working",
          career: mode === "low-income" ? "parttime" : "none",
          autoChoices: true,
          lifetimeWork: 12,
        });
        s.stats.money = 20000;
        s.debt = 500000;
        s.living = "basic";
        let rehired = null,
          unemployedMonths = 0;
        for (let m = 0; m < 180 && !s.finished; m++) {
          s = autoResolve(advanceMonth(s, events[world]), events[world]);
          if (s.career === "none") unemployedMonths++;
          else if (rehired === null) rehired = s.month;
        }
        recovery.push({
          seed,
          world,
          mode,
          rehired,
          unemployedMonths,
          ...snapshot(s),
        });
      }
  const distribution = (values) => {
    const a = values.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return { n: 0 };
    const q = (p) => {
      const x = (a.length - 1) * p;
      return a[Math.floor(x)] + (a[Math.ceil(x)] - a[Math.floor(x)]) * (x % 1);
    };
    return {
      n: a.length,
      min: a[0],
      p10: q(0.1),
      p25: q(0.25),
      p50: q(0.5),
      p75: q(0.75),
      p90: q(0.9),
      max: a.at(-1),
      mean: a.reduce((x, y) => x + y, 0) / a.length,
    };
  };
  const summarize = (rows) => ({
    n: rows.length,
    finalNet: distribution(rows.map((r) => r.finalNet)),
    age: distribution(rows.map((r) => r.age)),
    promotions: distribution(rows.map((r) => r.promotions)),
    maxLevel: distribution(rows.map((r) => r.maxLevel)),
    unemployedMonths: distribution(rows.map((r) => r.unemployedMonths)),
    university: rows.filter((r) => r.university).length,
    vocational: rows.filter((r) => r.vocational).length,
    ages: Object.fromEntries(
      [72, 216, 480, 780].map((age) => [
        age,
        Object.fromEntries(
          ["knowledge", "sociability", "health", "income", "net", "level"].map(
            (k) => [
              k,
              distribution(
                rows.flatMap((r) =>
                  r.snapshots[age] ? [r.snapshots[age][k]] : [],
                ),
              ),
            ],
          ),
        ),
      ]),
    ),
  });
  const summary = {
    all: summarize(lives),
    wealth: Object.fromEntries(
      Object.keys(byWealth).map((w) => [
        w,
        summarize(lives.filter((r) => r.wealth === w)),
      ]),
    ),
    policy: Object.fromEntries(
      policies.map((p) => [p, summarize(lives.filter((r) => r.policy === p))]),
    ),
    world: Object.fromEntries(
      ["modern", "coastal"].map((w) => [
        w,
        summarize(lives.filter((r) => r.world === w)),
      ]),
    ),
  };
  const result = {
    runtimePatch: execFileSync("git", ["diff", "HEAD", "--", "src"], {
      encoding: "utf8",
    }),
    source: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    plan: {
      seeds,
      policies,
      worlds: ["modern", "coastal"],
      sampling:
        "first two seeds per birth-wealth stratum among 7919 * 1..100; fully crossed",
      actions:
        "random event choices; no purchases/investment/voluntary actions",
      ageMonths: [72, 216, 480, 780],
      recovery:
        "synthetic age-25 state: cash 20000, debt 500000, basic living, lifetimeWork 12; 180 months",
    },
    summary,
    lives,
    recovery,
  };
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log("Wrote", out, "lives", lives.length, "recovery", recovery.length);
} finally {
  await server.close();
}
