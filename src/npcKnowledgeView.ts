import type { GameState } from "./engine";
import type { Person, SocialState } from "./social";
export type PublicProfile = {
  observedMonth: number;
  afterEventId: number;
} & Pick<Person, "alive"> &
  Partial<
    Pick<
      Person,
      | "occupation"
      | "illness"
      | "movedAway"
      | "spouseId"
      | "partnerId"
      | "childCount"
      | "deathMonth"
    >
  >;
export function capturePublicProfile(
  p: Person,
  month: number,
  afterEventId: number,
): PublicProfile {
  const fields = [
    "alive",
    "occupation",
    "illness",
    "movedAway",
    "spouseId",
    "partnerId",
    "childCount",
    "deathMonth",
  ] as const;
  return {
    observedMonth: month,
    afterEventId,
    ...Object.fromEntries(
      fields.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]),
    ),
  } as PublicProfile;
}
export function publicNpc(s: GameState, p: Person): Person {
  const known = s.npcAgency
    ? ownEntry(s.npcAgency.knownPeople, p.id)
    : undefined;
  if (!known) return p;
  const result = { ...p };
  for (const k of [
    "occupation",
    "illness",
    "movedAway",
    "spouseId",
    "partnerId",
    "childCount",
    "deathMonth",
  ] as const)
    delete result[k];
  const { observedMonth, afterEventId, ...profile } = known;
  Object.assign(result, profile);
  for (const e of s.worldHistory?.events ?? []) {
    if (
      !e.pcKnowledge ||
      e.month < observedMonth ||
      Number(e.id.slice(6)) < afterEventId ||
      !e.personIds.includes(p.id)
    )
      continue;
    if (
      e.kind === "npc.employment" &&
      ["student", "employed", "unemployed", "retired"].includes(
        String(e.data.occupation),
      )
    )
      result.occupation = e.data.occupation as Person["occupation"];
    if (e.kind === "npc.illness") result.illness = true;
    if (e.kind === "npc.recovery") result.illness = false;
    if (e.kind === "npc.move") result.movedAway = true;
    if (e.kind === "npc.reunion") result.movedAway = false;
    if (e.kind === "npc.death") {
      result.alive = false;
      if (typeof e.data.deathMonth === "number")
        result.deathMonth = e.data.deathMonth;
    }
    if (e.kind === "npc.marriage")
      result.spouseId = e.personIds.find((id) => id !== p.id) ?? null;
    if (e.kind === "npc.divorce" || e.kind === "npc.separation") {
      result.spouseId = null;
      result.partnerId = null;
    }
    if (e.kind === "npc.birth" && typeof e.data.childCount === "number")
      result.childCount = e.data.childCount;
  }
  const sharedChildren = s.people.filter(c=>c.parentIds?.includes("player")&&c.parentIds.includes(p.id)).length;
  if (sharedChildren > 0) result.childCount = Math.max(result.childCount ?? 0,sharedChildren);
  return result;
}
export function publicNpcLinks(s: GameState): SocialState["npcLinks"] {
  if (!s.npcAgency) return s.npcLinks;
  const links = structuredClone(s.npcAgency.knownLinks);
  for (const e of s.worldHistory?.events ?? []) {
    if (
      !e.pcKnowledge ||
      e.month < s.npcAgency.startMonth ||
      Number(e.id.slice(6)) < s.npcAgency.knownAfterEventId ||
      e.personIds.length !== 2 ||
      e.personIds.includes("player")
    )
      continue;
    const [a, b] = e.personIds;
    const kind =
      (
        {
          "npc.friends": "friends",
          "npc.conflict": "conflict",
          "npc.dating": "dating",
          "npc.marriage": "married",
        } as Record<string, string>
      )[e.kind] ??
      (e.kind === "npc.social" ? String(e.data.relationship) : undefined);
    if (!kind && !["npc.divorce", "npc.separation"].includes(e.kind)) continue;
    for (let i = links.length - 1; i >= 0; i--)
      if (
        (links[i].a === a && links[i].b === b) ||
        (links[i].a === b && links[i].b === a)
      )
        links.splice(i, 1);
    if (kind && ["friends", "conflict", "dating", "married"].includes(kind))
      links.push({ a, b, kind, since: e.month });
  }
  return links;
}

export function ownEntry<T>(
  entries: Record<string, T>,
  id: string,
): T | undefined {
  return Object.hasOwn(entries, id) ? entries[id] : undefined;
}
