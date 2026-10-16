export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export type Knowledge = {
  month: number;
  source: "direct" | "public" | "reported";
  informantId?: string;
};
export type WorldEventInput = {
  month: number;
  kind: string;
  personIds: string[];
  data: Record<string, JsonValue>;
  visibility: "private" | "participants" | "public";
  pcKnowledge?: Knowledge;
};
export type WorldEvent = WorldEventInput & { id: string };
export type WorldHistory = { version: 1; nextId: number; events: WorldEvent[] };
export type HistoryOwner = { worldHistory?: WorldHistory };
export function recordWorldEvent(
  owner: HistoryOwner,
  input: WorldEventInput,
): WorldEvent {
  const history = (owner.worldHistory ??= {
    version: 1,
    nextId: 1,
    events: [],
  });
  if (
    !Number.isSafeInteger(history.nextId) ||
    history.nextId >= Number.MAX_SAFE_INTEGER
  )
    throw Error("世界履歴の識別子が上限です");
  const event = { ...structuredClone(input), id: `world-${history.nextId++}` };
  history.events.push(event);
  return event;
}
function object(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function json(v: unknown, depth = 0): boolean {
  if (depth > 20) return false;
  if (v === null || typeof v === "string" || typeof v === "boolean")
    return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (Array.isArray(v)) return v.every((x) => json(x, depth + 1));
  return (
    object(v) &&
    Object.entries(v).every(
      ([key, x]) =>
        !["__proto__", "constructor", "prototype"].includes(key) &&
        json(x, depth + 1),
    )
  );
}
export function validateWorldHistory(value: unknown, month: number): void {
  if (value === undefined) return;
  if (
    !object(value) ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.nextId) ||
    Number(value.nextId) < 1 ||
    !Array.isArray(value.events)
  )
    throw Error("世界履歴が不正です");
  const ids = new Set<string>();
  let previous = 0;
  for (const e of value.events) {
    if (
      !object(e) ||
      typeof e.id !== "string" ||
      !/^world-[1-9][0-9]*$/.test(e.id) ||
      ids.has(e.id) ||
      !Number.isInteger(e.month) ||
      Number(e.month) < 0 ||
      Number(e.month) > month ||
      typeof e.kind !== "string" ||
      !e.kind ||
      !Array.isArray(e.personIds) ||
      !e.personIds.every((id) => typeof id === "string" && id.length > 0) ||
      typeof e.visibility !== "string" ||
      !["private", "participants", "public"].includes(e.visibility) ||
      !object(e.data) ||
      !json(e.data)
    )
      throw Error("世界の出来事が不正です");
    const serial = Number(e.id.slice(6));
    if (
      !Number.isSafeInteger(serial) ||
      serial <= previous ||
      serial >= Number(value.nextId)
    )
      throw Error("世界履歴の順序が不正です");
    previous = serial;
    ids.add(e.id);
    if (e.pcKnowledge !== undefined) {
      const k = e.pcKnowledge;
      if (
        !object(k) ||
        !Number.isInteger(k.month) ||
        Number(k.month) < Number(e.month) ||
        Number(k.month) > month ||
        typeof k.source !== "string" ||
        !["direct", "public", "reported"].includes(k.source) ||
        (k.informantId !== undefined &&
          (typeof k.informantId !== "string" || !k.informantId))
      )
        throw Error("出来事の知識情報が不正です");
    }
  }
}
