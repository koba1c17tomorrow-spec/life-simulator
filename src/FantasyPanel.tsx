import type { GameState } from "./engine";
import { worldRules } from "./worldRules";
import { setFantasyRole, practiceMagic } from "./fantasy";
import { remainingHours } from "./timeBudget";
import { scenarioActive } from "./scenarios";
export function FantasyPanel({
  game: s,
  change,
  blocked = false,
}: {
  game: GameState;
  change: (f: (s: GameState) => GameState) => void;
  blocked?: boolean;
}) {
  if (!s.fantasy) return null;
  const f = s.fantasy,
    r = worldRules("fantasy"),
    locked = blocked || s.finished || !!s.pending || scenarioActive(s);
  return (
    <section aria-label="街と工房の暮らし">
      <h3>街と工房の暮らし</h3>
      <p>
        種族：{r.species[f.species].name} ／ 教育：
        {s.month < 72
          ? "家庭での暮らし"
          : s.month < 192
            ? "寺子屋・徒弟教育"
            : "成人後の暮らし"}
      </p>
      <p>
        生業：{r.careers[f.role].name} ／ 月収 {s.monthlyIncome}銀貨 ／ 月支出{" "}
        {s.monthlyExpenses}銀貨 ／ 借金 {s.debt}銀貨
      </p>
      <label>
        生業を選ぶ
        <select
          aria-label="ファンタジーの生業"
          disabled={locked || s.month < 192}
          value={f.role}
          onChange={(e) => change((s) => setFantasyRole(s, e.target.value))}
        >
          {Object.entries(r.careers).map(([id, j]) => (
            <option key={id} value={id}>
              {j.name}
            </option>
          ))}
        </select>
      </label>
      <p>成人から生業を選べます。戦闘や冒険を選ばなくても生活が進みます。</p>
      <p>
        生活魔法 {f.magic.toFixed(1)} ／ 練習 {f.magicHours}時間
      </p>
      <button
        disabled={
          locked ||
          s.month < 72 ||
          s.lastActionMonth === s.month ||
          s.stats.health < 20 ||
          remainingHours(s) < 8
        }
        onClick={() => change(practiceMagic)}
      >
        生活魔法を練習（8時間）
      </button>
    </section>
  );
}
