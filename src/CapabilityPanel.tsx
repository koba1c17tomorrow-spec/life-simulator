import type { GameState } from "./engine";
import { skillNames, visibleTraits, type Skill } from "./capabilities";
import { traitNames } from "./traits";
export function CapabilityPanel({ game }: { game: GameState }) {
  return (
    <section aria-label="人物能力の4層">
      <h3>人物能力の4層</h3>
      <p>
        資質：
        {visibleTraits(game)
          .map((t) => traitNames[t])
          .join("・") || "活動を通じて判明します"}
      </p>
      <p>
        基礎能力：知識 {game.stats.knowledge.toFixed(1)} ／ 社交性{" "}
        {game.stats.sociability.toFixed(1)}
      </p>
      <p>
        専門技能：
        {(Object.keys(skillNames) as Skill[])
          .map(
            (k) =>
              `${skillNames[k]} ${game.capabilities ? game.capabilities.skills[k].toFixed(1) : "未記録"}`,
          )
          .join(" ／ ")}
      </p>
      {(!game.capabilities || game.capabilities.legacyBaseline) && (
        <p>技能は導入後の観測指標です。過去の熟練度は不明です。</p>
      )}
      <p>
        経験・資格：就業 {game.workExperience}か月 ／ 学位{" "}
        {game.degree ?? "なし"} ／ 専門資格{" "}
        {game.flags.qualified ? "取得済み" : "未取得"} ／ 評判 未記録
      </p>
    </section>
  );
}
