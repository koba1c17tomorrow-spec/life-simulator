export const STREAM_NAMES = [
  "pcHealth",
  "npcRelations",
  "events",
  "worldSociety",
] as const;
export type StreamName = (typeof STREAM_NAMES)[number];
export type RandomStreams = { version: 1; states: Record<StreamName, number> };
const uint32 = (n: unknown): n is number =>
  Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 0xffffffff;

// FNV-1a over an explicit UTF-16 name, then the existing uint32 LCG.
// This foundation is opt-in; it does not replace legacy GameState.seed.
export function createRandomStreams(seed: number): RandomStreams {
  if (!uint32(seed)) throw Error("ストリーム初期シードが不正です");
  const states = {} as Record<StreamName, number>;
  for (const name of STREAM_NAMES) {
    let hash = (2166136261 ^ seed) >>> 0;
    for (let i = 0; i < name.length; i++)
      hash = Math.imul(hash ^ name.charCodeAt(i), 16777619) >>> 0;
    states[name] = hash;
  }
  return { version: 1, states };
}
export function drawFromStream(
  streams: RandomStreams,
  name: StreamName,
): number {
  const next = (Math.imul(1664525, streams.states[name]) + 1013904223) >>> 0;
  streams.states[name] = next;
  return next / 4294967296;
}
export function validateRandomStreams(value: unknown): void {
  if (value === undefined) return;
  const v = value as RandomStreams | null;
  if (
    !v ||
    v.version !== 1 ||
    !v.states ||
    Array.isArray(v.states) ||
    Object.keys(v.states).length !== STREAM_NAMES.length ||
    !STREAM_NAMES.every((name) => uint32(v.states[name]))
  )
    throw Error("乱数ストリーム状態が不正です");
}
