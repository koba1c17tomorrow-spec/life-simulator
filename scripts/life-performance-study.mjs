// Match the 100-life regression's seeds, worlds, policies and age-40 save round trip.
// Output complete-state hashes after every monthly operation and normalization.
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
const output = process.argv[2];
if (!output)
  throw Error("Usage: node scripts/life-performance-study.mjs output.json");
const server = await createServer({
  server: { middlewareMode: true },
  logLevel: "error",
});
try {
  const { newGame, advanceMonth, autoResolve, normalizeGameState } =
    await server.ssrLoadModule("/src/engine.ts");
  const { validateEvents } = await server.ssrLoadModule("/src/content.ts");
  const worlds = ["modern", "coastal"].map((w) =>
    validateEvents(
      JSON.parse(readFileSync(`public/worlds/${w}/events.json`, "utf8")),
    ),
  );
  const policies = ["relationships", "wellness", "learning", "hobby", "rest"];
  const lives = [];
  for (let seed = 1; seed <= 100; seed++) {
    const hash = createHash("sha256");
    let s = newGame(seed * 7919, {}, seed % 2 ? "coastal" : "modern");
    s.autoChoices = true;
    s.priority = policies[seed % 5];
    let simulationMs = 0,
      steps = 0;
    while (!s.finished && steps++ < 1250) {
      const start = performance.now();
      s = autoResolve(advanceMonth(s, worlds[seed % 2]), worlds[seed % 2]);
      if (s.month === 480)
        s = normalizeGameState(JSON.parse(JSON.stringify(s)));
      simulationMs += performance.now() - start;
      hash.update(JSON.stringify(s));
    }
    if (!s.finished || s.pending) throw Error(`Blocked seed ${seed}`);
    lives.push({
      seed: seed * 7919,
      world: s.worldId,
      months: s.month,
      simulationMs,
      hash: hash.digest("hex"),
    });
  }
  writeFileSync(
    output,
    JSON.stringify(
      {
        node: process.version,
        cpu: cpus()[0].model,
        lives,
        simulationMs: lives.reduce((a, l) => a + l.simulationMs, 0),
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await server.close();
}
