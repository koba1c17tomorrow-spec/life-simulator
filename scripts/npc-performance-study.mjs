import { createServer } from "vite";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpus, platform, arch } from "node:os";
import { performance } from "node:perf_hooks";
const output = process.argv[2];
if (!output)
  throw Error("Usage: node scripts/npc-performance-study.mjs output.json");
const paths = readdirSync("src")
  .filter((p) => /\.tsx?$/.test(p))
  .map((p) => "src/" + p)
  .concat("scripts/npc-performance-study.mjs");
const canonical = (v) =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
const hash = (v) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(v)))
    .digest("hex");
const fingerprint = (s) => {
  const { npcTiers, ...rest } = s;
  return hash(rest);
};
const stats = (xs) => {
  const a = [...xs].sort((a, b) => a - b);
  const q = (p) => {
    const i = (a.length - 1) * p;
    return a[Math.floor(i)] + (a[Math.ceil(i)] - a[Math.floor(i)]) * (i % 1);
  };
  return {
    n: a.length,
    min: a[0],
    median: q(0.5),
    p90: q(0.9),
    max: a.at(-1),
    mean: a.reduce((a, b) => a + b, 0) / a.length,
  };
};
const result = {
  sourceBase: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceHashes: Object.fromEntries(
    paths.map((p) => [
      p,
      createHash("sha256").update(readFileSync(p)).digest("hex"),
    ]),
  ),
  environment: {
    node: process.version,
    vite: JSON.parse(readFileSync("node_modules/vite/package.json", "utf8"))
      .version,
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    cpuCount: cpus().length,
  },
  plan: {
    seeds: [42, 7919, 20261016],
    populations: [20, 50, 100],
    months: 1200,
    modes: ["baseline-full", "observed-full"],
    scope:
      "NPC subsystem plus full state clone; excludes PC health/economy/events",
    repetition: 1,
    realLazyUpdates: false,
  },
  completed: false,
  rows: [],
};
const server = await createServer({ server: { middlewareMode: true } });
try {
  const e = await server.ssrLoadModule("/src/engine.ts"),
    social = await server.ssrLoadModule("/src/social.ts"),
    rel = await server.ssrLoadModule("/src/relationships.ts"),
    agency = await server.ssrLoadModule("/src/npcAgency.ts"),
    facts = await server.ssrLoadModule("/src/npcEvents.ts"),
    tiers = await server.ssrLoadModule("/src/npcTiers.ts"),
    time = await server.ssrLoadModule("/src/timeBudget.ts"),
    saves = await server.ssrLoadModule("/src/saves.ts");
  function initial(seed, count) {
    const s = e.newGame(seed);
    for (let i = 0; i < count - 2; i++) {
      const id = `bench-${String(i).padStart(3, "0")}`;
      s.people.push({
        id,
        name: `計測NPC${i}`,
        kind: "friend",
        birthMonth: -300,
        alive: true,
        gender: i % 2 ? "female" : "male",
        orientation: "bisexual",
        personality: ["kind", "quiet", "bold", "ambitious"][(i + seed) % 4],
        values: ["family", "career", "freedom"][(i + seed) % 3],
        occupation: "employed",
        health: 85,
        childCount: 0,
        movedAway: i % 2 === 0,
      });
      s.relations.push({ id, closeness: 10, trust: 10, lastContactMonth: -24 });
    }
    return s;
  }
  function tick(original, observe) {
    const s = structuredClone(original);
    s.month++;
    const random = () => {
      s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
      return s.seed / 4294967296;
    };
    const report = (text, fact) => facts.recordNpcFact(s, text, fact);
    agency.prepareNpcAgency(s);
    social.socialMonth(s, s.month, random, report);
    agency.prepareNpcAgency(s);
    const processed = s.people.filter((p) => p.alive).map((p) => p.id);
    rel.npcMonth(s, random, report);
    s.timeBudget = time.budgetFor(s);
    agency.npcAgencyMonth(s);
    if (observe) tiers.observeNpcTiers(s, processed);
    return s;
  }
  function contact(s) {
    const available = s.people.filter(
      (p) => p.alive && agency.npcReply(s, p.id, "talk").accepted,
    );
    const p =
      available.find((p) => tiers.classifyNpc(s, p) === "Dormant") ??
      available[0];
    if (!p) return null;
    const started = performance.now();
    const n = e.meetPerson(s, p.id, "talk");
    return {
      target: p.id,
      tier: tiers.classifyNpc(s, p),
      latencyMs: performance.now() - started,
      executed: n.lastActionMonth === s.month,
      catchUpMs: null,
      catchUpStatus: "not-enabled",
    };
  }
  function run(seed, count, observe) {
    let s = initial(seed, count);
    const times = [],
      samples = [];
    let recontact = null;
    for (let month = 1; month <= 1200; month++) {
      const started = performance.now();
      s = tick(s, observe);
      times.push(performance.now() - started);
      if ([1, 120, 600, 1200].includes(month)) {
        const text = saves.exportSave(s);
        const counts = { Active: 0, Dormant: 0, Archived: 0 };
        for (const p of s.people) counts[tiers.classifyNpc(s, p)]++;
        samples.push({
          month,
          population: s.people.length,
          tiers: counts,
          saveChars: text.length,
          saveBytes: Buffer.byteLength(text, "utf8"),
          events: s.worldHistory?.events.length ?? 0,
          edges: s.relationshipModel?.edges.length ?? 0,
        });
      }
      if (month === 600) recontact = contact(s);
    }
    const text = saves.exportSave(s);
    let resumeEqual = false,
      resumeError = null;
    try {
      resumeEqual =
        hash(saves.importSave(text)) === hash(JSON.parse(text).state);
      if (!resumeEqual) resumeError = "normalized-state-diff";
    } catch (error) {
      resumeError = error.message;
    }
    return {
      mode: observe ? "observed-full" : "baseline-full",
      totalMs: times.reduce((a, b) => a + b, 0),
      monthlyMs: stats(times),
      first120MonthlyMs: stats(times.slice(0, 120)),
      blocks120Ms: Array.from({ length: 10 }, (_, i) =>
        times.slice(i * 120, (i + 1) * 120).reduce((a, b) => a + b, 0),
      ),
      samples,
      recontact,
      saveChars: text.length,
      saveBytes: Buffer.byteLength(text, "utf8"),
      resumeEqual,
      resumeError,
      outcomeHash: fingerprint(s),
    };
  }
  for (const count of result.plan.populations)
    for (const seed of result.plan.seeds) {
      const baseline = run(seed, count, false),
        observed = run(seed, count, true);
      const row = {
        seed,
        count,
        baseline,
        observed,
        sameOutcome: baseline.outcomeHash === observed.outcomeHash,
      };
      result.rows.push(row);
      writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
      console.log(
        JSON.stringify({
          count,
          seed,
          baselineMs: baseline.totalMs,
          observedMs: observed.totalMs,
          saveBytes: observed.saveBytes,
          sameOutcome: row.sameOutcome,
          resumeEqual: observed.resumeEqual,
        }),
      );
      if (!row.sameOutcome)
        throw Error("Classification changed simulation outcomes");
    }
  result.completed = true;
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
} finally {
  await server.close();
}
