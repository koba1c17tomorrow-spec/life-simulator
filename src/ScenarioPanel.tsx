import type { GameState } from "./engine";
import {
  SCENARIOS,
  scenarioActive,
  scenarioDefinition,
  scenarioStartReason,
  startScenario,
  scenarioChoices,
  chooseScenario,
  autoScenario,
  withdrawScenario,
} from "./scenarios";
import { currencyLabel } from "./worldRules";
export function ScenarioPanel({
  game,
  change,
  onMonth,
  blocked,
}: {
  game: GameState;
  change: (f: (s: GameState) => GameState) => void;
  onMonth: () => void;
  blocked: boolean;
}) {
  const run = game.scenarios?.active,
    d = scenarioDefinition(game);
  const target = game.people.find(
    (p) => p.alive && game.relations.some((r) => r.id === p.id),
  )?.id;
  return (
    <details className="scenario-panel">
      <summary>シナリオ（任意の活動）</summary>
      <p className="hint">
        始めると月次を一時停止します。選択の時間と費用は普段の生活と共有します。
      </p>
      {SCENARIOS.filter((d) => d.worlds.includes(game.worldId)).map((d) => {
        const reason = scenarioStartReason(game, d.id, target);
        return (
          <div key={d.id}>
            <button
              disabled={blocked || !!reason}
              onClick={() => change((s) => startScenario(s, d.id, target))}
            >
              {d.title}を始める
            </button>
            {reason && <span className="hint"> {reason}</span>}
          </div>
        );
      })}
      {run && d && (
        <section aria-label="進行中のシナリオ">
          <h3>{d.title}</h3>
          <p>
            {
              {
                running: "選択待ち",
                "waiting-month": "時間不足・次の月を待っています",
                completed: "完了",
                failed: "今回は失敗",
                withdrawn: "撤退",
                interrupted: "中断",
              }[run.status]
            }
          </p>
          {run.status === "running" && (
            <>
              <p>{d.scenes[run.sceneId].text}</p>
              {scenarioChoices(game).map(({ choice: c, reason }) => (
                <div key={c.id}>
                  <button
                    disabled={blocked || !!reason}
                    onClick={() =>
                      change((s) => chooseScenario(s, c.id, run.step, run.id))
                    }
                  >
                    {c.label}
                  </button>
                  <span>
                    {" "}
                    {c.hours}時間 / {c.cost ?? 0}
                    {currencyLabel(game.worldId)} {reason}
                  </span>
                </div>
              ))}
              <button disabled={blocked} onClick={() => change(autoScenario)}>
                シナリオを自動で進める
              </button>
            </>
          )}
          {run.status === "waiting-month" && (
            <button disabled={blocked || !!game.pending} onClick={onMonth}>
              シナリオの次月へ
            </button>
          )}
          {scenarioActive(game) && (
            <button
              disabled={blocked || !!game.pending}
              onClick={() => change(withdrawScenario)}
            >
              シナリオを取りやめる
            </button>
          )}
          {run.history.map((h, i) => (
            <p key={i}>
              {h.month}か月目：{h.text}（{h.hours}時間）
            </p>
          ))}
        </section>
      )}
    </details>
  );
}
