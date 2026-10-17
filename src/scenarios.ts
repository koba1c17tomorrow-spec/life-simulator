import type { GameState } from "./engine";
import { cloneState } from "./cloneState";
import { remainingHours, chargeTime } from "./timeBudget";
import { practiceHours, type Skill } from "./capabilities";
import { createRandomStreams, drawFromStream } from "./randomStreams";
import { recordWorldEvent } from "./worldHistory";
import { record } from "./journal";
export type SceneRequirement = {
  minAge?: number;
  money?: number;
  health?: number;
  skill?: { id: Skill; min: number };
  stat?: { id: "knowledge" | "sociability"; min: number };
  relation?: number;
  item?: string;
  magic?: number;
};
export type SceneResult = {
  next?: string;
  end?: "completed" | "failed" | "withdrawn";
  text: string;
  money?: number;
  health?: number;
  relation?: number;
  item?: string;
};
export type SceneChoice = {
  id: string;
  label: string;
  hours: number;
  cost?: number;
  requires?: SceneRequirement;
  skill?: Skill;
  difficulty?: number;
  success: SceneResult;
  failure?: SceneResult;
};
export type ScenarioDefinition = {
  id: string;
  title: string;
  worlds: string[];
  minAge: number;
  temporaryItems?: string[];
  start: string;
  scenes: Record<string, { text: string; choices: SceneChoice[] }>;
};
export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: "town-errand",
    title: "町の用事を手伝う",
    worlds: ["modern", "coastal"],
    minAge: 72,
    start: "plan",
    scenes: {
      plan: {
        text: "身近な人から、町の用事を頼まれた。無理のない範囲で段取りを考える。",
        choices: [
          {
            id: "prepare",
            label: "段取りを整理する",
            hours: 4,
            skill: "learning",
            success: {
              next: "visit",
              text: "確認することを整理した。",
              item: "errand-note",
            },
          },
          {
            id: "leave",
            label: "今回は引き受けない",
            hours: 0,
            success: { end: "withdrawn", text: "今月は自分の生活を優先した。" },
          },
        ],
      },
      visit: {
        text: "窓口で用件を伝える。控えがあれば手順を確かめられる。",
        choices: [
          {
            id: "explain",
            label: "控えを見ながら説明する",
            hours: 8,
            requires: { item: "errand-note", health: 20 },
            skill: "communication",
            difficulty: 45,
            success: {
              end: "completed",
              text: "用事を終え、静かないつもの生活へ戻った。",
              relation: 1,
            },
            failure: {
              end: "failed",
              text: "手続きが合わず、今回は出直すことになった。",
            },
          },
          {
            id: "withdraw",
            label: "用事を中断して戻る",
            hours: 0,
            success: {
              end: "withdrawn",
              text: "無理をせず、用事を取りやめた。",
            },
          },
        ],
      },
    },
  },
];
SCENARIOS.push(
  {
    id: "work-and-home",
    title: "仕事と家の用事",
    worlds: ["modern", "coastal"],
    minAge: 216,
    start: "arrange",
    scenes: {
      arrange: {
        text: "仕事の手伝いと家の用事が重なった。今月できる範囲を考える。",
        choices: [
          {
            id: "consult",
            label: "家族と予定を相談する",
            hours: 4,
            requires: { relation: 20 },
            skill: "communication",
            success: {
              next: "task",
              text: "引き受ける範囲を相談した。",
              relation: 1,
              item: "agreed-plan",
            },
          },
          {
            id: "alone",
            label: "自分で予定を整理する",
            hours: 4,
            skill: "learning",
            success: {
              next: "task",
              text: "無理のない範囲を決めた。",
              item: "personal-plan",
            },
          },
        ],
      },
      task: {
        text: "予定を踏まえ、仕事を引き受けるか決める。",
        choices: [
          {
            id: "shared",
            label: "相談した範囲だけ手伝う",
            hours: 8,
            cost: 100,
            requires: { item: "agreed-plan", health: 20 },
            skill: "professional",
            difficulty: 45,
            success: {
              end: "completed",
              text: "小さな手伝いを終え、家にも時間を残せた。",
              money: 250,
              relation: 1,
            },
            failure: {
              end: "failed",
              text: "手直しが必要になったが、無理を増やさず終えた。",
            },
          },
          {
            id: "work",
            label: "自分の予定で取り組む",
            hours: 16,
            cost: 100,
            requires: { health: 35 },
            skill: "professional",
            difficulty: 55,
            success: {
              end: "completed",
              text: "仕事を終えた。少し疲れたが、日常へ戻った。",
              money: 300,
              health: -1,
            },
            failure: {
              end: "failed",
              text: "予定どおりには進まず、今回は見送った。",
              health: -1,
            },
          },
          {
            id: "home",
            label: "今回は家の用事を優先する",
            hours: 4,
            success: {
              end: "withdrawn",
              text: "仕事を見送り、家の用事を済ませた。",
              health: 1,
            },
          },
        ],
      },
    },
  },
  {
    id: "guild-order",
    temporaryItems: ["borrowed-tools"],
    title: "工房の小さな依頼",
    worlds: ["fantasy"],
    minAge: 96,
    start: "plan",
    scenes: {
      plan: {
        text: "町の工房で、暮らしの道具を直す小さな依頼を見つけた。",
        choices: [
          {
            id: "tools",
            label: "道具と手順を確かめる",
            hours: 4,
            cost: 2,
            skill: "learning",
            success: {
              next: "repair",
              text: "道具を借り、手順を確かめた。",
              item: "borrowed-tools",
            },
          },
          {
            id: "leave",
            label: "依頼を引き受けない",
            hours: 0,
            success: {
              end: "withdrawn",
              text: "今回は普段の暮らしを続けることにした。",
            },
          },
        ],
      },
      repair: {
        text: "借りた道具で修理する。生活魔法を学んでいれば別の方法も選べる。",
        choices: [
          {
            id: "craft",
            label: "手仕事で修理する",
            hours: 12,
            requires: { item: "borrowed-tools", health: 20 },
            skill: "professional",
            difficulty: 45,
            success: {
              end: "completed",
              text: "暮らしの道具を直し、礼を受け取った。",
              money: 12,
            },
            failure: {
              end: "failed",
              text: "修理はうまくいかず、工房に返した。",
            },
          },
          {
            id: "magic",
            label: "生活魔法を使って修理する",
            hours: 8,
            requires: { item: "borrowed-tools", magic: 1, health: 20 },
            skill: "learning",
            difficulty: 40,
            success: {
              end: "completed",
              text: "学んだ魔法で修理を助け、礼を受け取った。",
              money: 12,
            },
            failure: {
              end: "failed",
              text: "今回は魔法がうまく働かず、工房に戻した。",
            },
          },
          {
            id: "return",
            label: "無理をせず道具を返す",
            hours: 0,
            success: { end: "withdrawn", text: "道具を返して日常へ戻った。" },
          },
        ],
      },
    },
  },
);
export type ScenarioRun = {
  id: number;
  definitionId: string;
  sceneId: string;
  status:
    | "running"
    | "waiting-month"
    | "completed"
    | "failed"
    | "withdrawn"
    | "interrupted";
  startedMonth: number;
  endedMonth?: number;
  step: number;
  randomState: number;
  targetId?: string;
  deferredChoice?: string;
  history: {
    month: number;
    sceneId: string;
    choiceId: string;
    hours: number;
    cost: number;
    success: boolean;
    text: string;
  }[];
};
export type ScenarioState = {
  version: 1;
  nextId: number;
  active: ScenarioRun | null;
  archive?: ScenarioRun[];
  lastStarted: Record<string, number>;
  inventory: Record<string, number>;
};
export function scenarioActive(s: Pick<GameState, "scenarios">): boolean {
  return (
    s.scenarios?.active?.status === "running" ||
    s.scenarios?.active?.status === "waiting-month"
  );
}
export function scenarioDefinition(s: GameState) {
  return SCENARIOS.find((d) => d.id === s.scenarios?.active?.definitionId);
}
function requirementReason(
  s: GameState,
  r: SceneRequirement | undefined,
  targetId?: string,
): string {
  if (!r) return "";
  if (r.minAge !== undefined && s.month < r.minAge)
    return "年齢条件を満たしていません";
  if (r.money !== undefined && s.stats.money < r.money)
    return "所持金が不足しています";
  if (r.health !== undefined && s.stats.health < r.health)
    return "体調が実行条件を満たしていません";
  if (r.skill && (s.capabilities?.skills[r.skill.id] ?? 0) < r.skill.min)
    return "技能が実行条件を満たしていません";
  if (r.stat && s.stats[r.stat.id] < r.stat.min)
    return "能力が実行条件を満たしていません";
  if (
    r.relation !== undefined &&
    (!targetId ||
      (s.relations.find((r) => r.id === targetId)?.closeness ?? 0) < r.relation)
  )
    return "確認できる関係が条件を満たしていません";
  if (r.magic !== undefined && (s.fantasy?.magic ?? 0) < r.magic)
    return "生活魔法の習熟が必要です";
  if (r.item && !((s.scenarios?.inventory[r.item] ?? 0) > 0))
    return "必要な持ち物がありません";
  return "";
}
export function scenarioStartReason(
  s: GameState,
  id: string,
  targetId?: string,
): string {
  const d = SCENARIOS.find((d) => d.id === id);
  if (!d || !d.worlds.includes(s.worldId)) return "この世界では利用できません";
  if (
    s.finished ||
    s.pending ||
    s.monthStarted ||
    s.queue.length ||
    scenarioActive(s)
  )
    return "現在の進行を終えてから開始できます";
  if (s.month < d.minAge || s.stats.health < 20)
    return "年齢または体調が開始条件を満たしていません";
  if (s.month - (s.scenarios?.lastStarted[id] ?? -9999) < 12)
    return "同じシナリオは12か月空けてください";
  if (targetId && !s.people.some((p) => p.id === targetId && p.alive))
    return "相手と会うことができません";
  return "";
}
export function startScenario(
  original: GameState,
  id: string,
  targetId?: string,
): GameState {
  if (scenarioStartReason(original, id, targetId)) return original;
  const s = cloneState(original),
    d = SCENARIOS.find((d) => d.id === id)!;
  s.scenarios ??= {
    version: 1,
    nextId: 1,
    active: null,
    lastStarted: {},
    inventory: {},
  };
  if (s.scenarios.active) (s.scenarios.archive ??= []).push(s.scenarios.active);
  s.scenarios.active = {
    id: s.scenarios.nextId++,
    definitionId: id,
    sceneId: d.start,
    status: "running",
    startedMonth: s.month,
    step: 0,
    randomState: createRandomStreams(s.seed).states.events,
    history: [],
    ...(targetId ? { targetId } : {}),
  };
  s.scenarios.lastStarted[id] = s.month;
  record(s, "【シナリオ】" + d.title + "を始めた。");
  return s;
}
export function scenarioChoices(s: GameState) {
  const run = s.scenarios?.active,
    d = scenarioDefinition(s);
  if (!run || !d || run.status !== "running") return [];
  return d.scenes[run.sceneId].choices.map((c) => ({
    choice: c,
    reason:
      s.finished || s.pending
        ? "通常の選択を先に終えてください"
        : requirementReason(s, c.requires, run.targetId) ||
          (s.stats.money < (c.cost ?? 0) ? "費用が足りません" : ""),
  }));
}
export function finishScenario(
  s: GameState,
  status: ScenarioRun["status"],
  text: string,
): void {
  const run = s.scenarios?.active;
  if (!run || !scenarioActive(s)) return;
  for (const item of scenarioDefinition(s)?.temporaryItems ?? [])
    delete s.scenarios!.inventory[item];
  run.status = status;
  run.endedMonth = s.month;
  delete run.deferredChoice;
  const e = recordWorldEvent(s, {
    month: s.month,
    kind: "pc.scenario",
    personIds: ["player", ...(run.targetId ? [run.targetId] : [])],
    visibility: "participants",
    pcKnowledge: { month: s.month, source: "direct" },
    data: { scenarioId: run.definitionId, runId: run.id, status, text },
  });
  record(s, "【シナリオ結果】" + text, e.id);
}
export function chooseScenario(
  original: GameState,
  id: string,
  expectedStep: number,
  expectedRunId = original.scenarios?.active?.id,
): GameState {
  const current = original.scenarios?.active;
  if (
    !current ||
    current.status !== "running" ||
    current.step !== expectedStep ||
    current.id !== expectedRunId ||
    original.pending ||
    original.finished
  )
    return original;
  const entry = scenarioChoices(original).find((c) => c.choice.id === id);
  if (!entry || entry.reason) return original;
  const s = cloneState(original),
    run = s.scenarios!.active!,
    c = entry.choice;
  if (c.hours > remainingHours(s)) {
    run.status = "waiting-month";
    run.deferredChoice = id;
    return s;
  }
  if (c.hours > 0)
    chargeTime(s, "シーン:" + run.definitionId + ":" + run.sceneId, c.hours);
  s.stats.money -= c.cost ?? 0;
  let success = true;
  if (c.difficulty !== undefined) {
    const streams = createRandomStreams(0);
    streams.states.events = run.randomState;
    const draw = drawFromStream(streams, "events");
    run.randomState = streams.states.events;
    const score =
      (s.stats.knowledge + s.stats.sociability) / 4 +
      (c.skill ? (s.capabilities?.skills[c.skill] ?? 0) * 0.5 : 0);
    success = draw * 100 + score >= c.difficulty;
  }
  const result = success ? c.success : (c.failure ?? c.success);
  if (c.skill) practiceHours(s, c.skill, c.hours);
  s.stats.money = Math.max(0, s.stats.money + (result.money ?? 0));
  s.stats.health = Math.max(
    0,
    Math.min(100, s.stats.health + (result.health ?? 0)),
  );
  if (result.item)
    s.scenarios!.inventory[result.item] =
      (s.scenarios!.inventory[result.item] ?? 0) + 1;
  if (result.relation && run.targetId) {
    const r = s.relations.find((r) => r.id === run.targetId);
    if (r)
      r.closeness = Math.max(0, Math.min(100, r.closeness + result.relation));
  }
  run.history.push({
    month: s.month,
    sceneId: run.sceneId,
    choiceId: id,
    hours: c.hours,
    cost: c.cost ?? 0,
    success,
    text: result.text,
  });
  run.step++;
  if (result.end) finishScenario(s, result.end, result.text);
  else if (result.next) run.sceneId = result.next;
  return s;
}
export function autoScenario(original: GameState): GameState {
  let s = original;
  for (let i = 0; i < 16; i++) {
    const run = s.scenarios?.active;
    if (!run || run.status !== "running") break;
    const entry = scenarioChoices(s).find((c) => !c.reason);
    if (!entry) return s;
    const next = chooseScenario(s, entry.choice.id, run.step, run.id);
    if (next === s) break;
    s = next;
  }
  return s;
}
export function withdrawScenario(original: GameState): GameState {
  if (!scenarioActive(original) || original.pending) return original;
  const s = cloneState(original);
  finishScenario(s, "withdrawn", "途中で取りやめ、日常の生活へ戻った。");
  return s;
}
export function resumeScenarioMonth(s: GameState): void {
  const run = s.scenarios?.active;
  if (run?.status === "waiting-month") {
    if (
      s.finished ||
      s.stats.health < 20 ||
      (run.targetId && !s.people.some((p) => p.id === run.targetId && p.alive))
    )
      finishScenario(
        s,
        "interrupted",
        "体調や人生の変化により、続けられなくなった。",
      );
    else {
      run.status = "running";
      delete run.deferredChoice;
    }
  }
}
export function validateScenarios(s: GameState): void {
  const state = s.scenarios;
  if (state === undefined) return;
  const month = (n: number) => Number.isInteger(n) && n >= 0 && n <= s.month;
  if (
    !state ||
    state.version !== 1 ||
    !Number.isSafeInteger(state.nextId) ||
    state.nextId < 1 ||
    !state.lastStarted ||
    typeof state.lastStarted !== "object" ||
    Array.isArray(state.lastStarted) ||
    !state.inventory ||
    typeof state.inventory !== "object" ||
    Array.isArray(state.inventory) ||
    (state.archive !== undefined && !Array.isArray(state.archive)) ||
    Object.values(state.inventory).some((n) => !Number.isInteger(n) || n < 0) ||
    Object.entries(state.lastStarted).some(
      ([id, m]) => !SCENARIOS.some((d) => d.id === id) || !month(m),
    )
  )
    throw Error("シナリオ保存が不正です");
  const runs = [
    ...(state.archive ?? []),
    ...(state.active ? [state.active] : []),
  ];
  if (state.active === undefined) throw Error("現在のシナリオ状態が不正です");
  let previousId = 0;
  for (const r of runs) {
    const d = SCENARIOS.find((d) => d.id === r?.definitionId);
    if (
      !r ||
      !d ||
      !d.worlds.includes(s.worldId) ||
      !Object.hasOwn(d.scenes, r.sceneId) ||
      !Number.isSafeInteger(r.id) ||
      r.id <= previousId ||
      r.id >= state.nextId ||
      ![
        "running",
        "waiting-month",
        "completed",
        "failed",
        "withdrawn",
        "interrupted",
      ].includes(r.status) ||
      !month(r.startedMonth) ||
      !Number.isInteger(r.step) ||
      r.step < 0 ||
      !Array.isArray(r.history) ||
      r.step !== r.history.length ||
      r.history.length > 16 ||
      !Number.isInteger(r.randomState) ||
      r.randomState < 0 ||
      r.randomState > 0xffffffff ||
      (r.targetId && !s.people.some((p) => p.id === r.targetId)) ||
      (r.endedMonth !== undefined &&
        (!month(r.endedMonth) || r.endedMonth < r.startedMonth)) ||
      (r !== state.active &&
        (r.status === "running" || r.status === "waiting-month")) ||
      (r.status === "running" && (s.pending || s.finished)) ||
      (r.status !== "running" &&
        r.status !== "waiting-month" &&
        r.endedMonth === undefined)
    )
      throw Error("シーン進行が不正です");
    previousId = r.id;
    let previous = r.startedMonth;
    for (const h of r.history) {
      const c = d.scenes[h.sceneId]?.choices.find((c) => c.id === h.choiceId);
      if (
        !c ||
        !month(h.month) ||
        h.month < previous ||
        h.hours !== c.hours ||
        h.cost !== (c.cost ?? 0) ||
        typeof h.success !== "boolean" ||
        typeof h.text !== "string"
      )
        throw Error("シーン選択履歴が不正です");
      previous = h.month;
    }
  }
}
