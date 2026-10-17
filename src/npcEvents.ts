import type { GameState } from "./engine";
import { record } from "./journal";
import {
  recordWorldEvent,
  type JsonValue,
  type WorldEvent,
  type WorldEventInput,
} from "./worldHistory";
export type NpcFact = Pick<
  WorldEventInput,
  "kind" | "personIds" | "data" | "visibility"
>;
export type NpcReporter = (text: string, fact: NpcFact) => void;
export function npcFact(
  kind: string,
  personIds: string[],
  data: Record<string, JsonValue> = {},
  visibility: NpcFact["visibility"] = "private",
): NpcFact {
  return { kind, personIds, data, visibility };
}
function deathNoticeAllowed(s: GameState, event: WorldEvent): boolean {
  return (
    event.kind === "npc.death" &&
    (event.data.pcPartner === true ||
      event.personIds.some((id) =>
        s.people.some(
          (p) => p.id === id && p.kind === "family" && !p.movedAway,
        ),
      ))
  );
}
/** Explicit knowledge transition; no filtering or guessing from prose. */
export function learnWorldEvent(
  s: GameState,
  id: string,
  source: "direct" | "public" | "reported",
  informantId?: string,
): boolean {
  const event = s.worldHistory?.events.find((e) => e.id === id);
  if (
    !event ||
    event.pcKnowledge ||
    event.month > s.month ||
    typeof event.data.text !== "string"
  )
    return false;
  const allowed =
    source === "direct"
      ? event.visibility === "participants" &&
        event.personIds.includes("player")
      : source === "public"
        ? event.visibility === "public"
        : informantId !== undefined
          ? event.data.disclosable !== false && event.personIds.includes(informantId) &&
            s.people.some((p) => p.id === informantId && p.alive)
          : deathNoticeAllowed(s, event);
  if (!allowed) return false;
  event.pcKnowledge = {
    month: s.month,
    source,
    ...(informantId ? { informantId } : {}),
  };
  const text =
    source === "direct"
      ? event.data.text
      : `【知らせ】${event.data.text}${event.month === s.month ? "" : `（出来事: ${event.month}か月目）`}`;
  record(s, text, event.id);
  return true;
}
export function recordNpcFact(
  s: GameState,
  text: string,
  fact: NpcFact,
): WorldEvent {
  const event = recordWorldEvent(s, {
    ...fact,
    month: s.month,
    data: { ...fact.data, text },
  });
  if (fact.visibility === "public") learnWorldEvent(s, event.id, "public");
  else if (fact.visibility === "participants")
    learnWorldEvent(s, event.id, "direct");
  else if (deathNoticeAllowed(s, event))
    learnWorldEvent(s, event.id, "reported");
  return event;
}
export function shareWorldEvents(s: GameState, informantId: string): void {
  for (const event of s.worldHistory?.events ?? []) {
    if (event.personIds.includes(informantId))
      learnWorldEvent(s, event.id, "reported", informantId);
  }
}
