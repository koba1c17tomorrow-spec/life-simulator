// Compare complete existing world states before/after Phase 5; no fields excluded.
// Usage: node scripts/world-regression-study.mjs output.json [source-root]
import { createServer } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { cpus } from "node:os";
const root = resolve(process.argv[3] ?? ".");
if (!process.argv[2]) throw Error("output.json required");
const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true },
  logLevel: "error",
});
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical(v[k])]),
    );
  return v;
}

try {
  const { newGame, advanceMonth, autoResolve, normalizeGameState } =
    await server.ssrLoadModule("/src/engine.ts");
  const { validateEvents } = await server.ssrLoadModule("/src/content.ts");
  const worlds = ["modern", "coastal"].map((w) =>
    validateEvents(
      JSON.parse(
        readFileSync(resolve(root, `public/worlds/${w}/events.json`), "utf8"),
      ),
    ),
  );
  const policies = ["relationships", "wellness", "learning", "hobby", "rest"];
  const lives = [];
  for (let i = 1; i <= 10; i++) {
    let s = newGame(i * 7919, {}, i % 2 ? "coastal" : "modern");
    s.autoChoices = true;
    s.priority = policies[i % 5];
    const hash = createHash("sha256");
    let simulationMs = 0,
      steps = 0;
    while (!s.finished && steps++ < 1250) {
      const t = performance.now();
      s = autoResolve(advanceMonth(s, worlds[i % 2]), worlds[i % 2]);
      if (s.month === 480)
        s = normalizeGameState(JSON.parse(JSON.stringify(s)));
      simulationMs += performance.now() - t;
      hash.update(JSON.stringify(canonical(s)));
    }
    if (!s.finished) throw Error("Blocked life");
    lives.push({
      seed: i * 7919,
      world: s.worldId,
      months: s.month,
      simulationMs,
      hash: hash.digest("hex"),
    });
  }
  writeFileSync(
    process.argv[2],
    JSON.stringify(
      {
        node: process.version,
        cpu: cpus()[0].model,
        lives,
        simulationMs: lives.reduce((n, l) => n + l.simulationMs, 0),
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await server.close();
}
