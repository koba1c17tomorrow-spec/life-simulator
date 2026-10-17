import { useState } from "react";
import type { GameState } from "./engine";
import {
  actionCost,
  actionHours,
  budgetFor,
  planFocus,
  remainingHours,
  type ActionKind,
  type Intensity,
} from "./timeBudget";
const names = { study: "勉強", work: "単発仕事", rest: "休息" };
export function FocusControls({
  game,
  change,
  locked,
}: {
  game: GameState;
  change: (update: (s: GameState) => GameState) => void;
  locked: boolean;
}) {
  const [kind, setKind] = useState<ActionKind>(game.focusPlan?.kind ?? "rest");
  const [intensity, setIntensity] = useState<Intensity>(
    game.focusPlan?.intensity ?? 1,
  );
  const b = budgetFor(game);
  return (
    <section aria-label="生活時間と重点行動">
      <h3>時間配分と重点行動</h3>
      <p>今月の残り時間：{remainingHours(game)} / 720時間</p>
      <details>
        <summary>確保済みの生活時間</summary>
        <p>
          {Object.entries(b.allocations)
            .map(([k, v]) => `${k} ${v}時間`)
            .join(" ／ ")}
        </p>
        {b.overload > 0 && (
          <p>義務の超過要求 {b.overload}時間。自由行動の余裕がありません。</p>
        )}
      </details>
      <label htmlFor="focus-kind">次の月の重点行動</label>
      <select
        id="focus-kind"
        value={kind}
        disabled={locked}
        onChange={(e) => setKind(e.target.value as ActionKind)}
      >
        {(Object.keys(names) as ActionKind[]).map((k) => (
          <option key={k} value={k}>
            {names[k]}
          </option>
        ))}
      </select>
      <label htmlFor="focus-intensity">重点行動の強度</label>
      <select
        id="focus-intensity"
        value={intensity}
        disabled={locked}
        onChange={(e) => setIntensity(Number(e.target.value) as Intensity)}
      >
        <option value={1}>低</option>
        <option value={2}>中</option>
        <option value={3}>高</option>
      </select>
      <p>
        必要時間 {actionHours(intensity)}時間 ／ 費用{" "}
        {game.fantasy && kind === "study"
          ? intensity - 1
          : actionCost(kind, intensity)}
        {game.fantasy ? "銀貨" : "円"}。
        {kind === "rest"
          ? "技能は成長しません。"
          : `学習・仕事は休息や交流と競合し、${intensity === 1 ? "幸福が減ります" : "幸福が減り疲労が増します"}。`}
      </p>
      <button
        disabled={locked || game.monthStarted}
        onClick={() => change((s) => planFocus(s, kind, intensity))}
      >
        次の月の計画を設定
      </button>
      <p className="hint">
        1回分の計画です。選択イベントの解決後、健康・資金・義務を確認して実行します。今月の即時自主行動は低強度です。交流と重点行動は同じ月1枠、購入は別枠で2時間です。
      </p>
      {game.focusPlan && (
        <p role="status">
          計画 {game.focusPlan.month}月：{names[game.focusPlan.kind]} ／{" "}
          {
            { planned: "予定", executed: "実行済み", blocked: "実行できず" }[
              game.focusPlan.status
            ]
          }{" "}
          ／ 実行 {game.focusPlan.actualHours}時間 {game.focusPlan.reason}
        </p>
      )}
    </section>
  );
}
