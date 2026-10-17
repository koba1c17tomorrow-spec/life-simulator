import type { GameState } from "./engine";
import { socialPresentation, newsReason } from "./socialPresentation";
export function SocialPanel({
  game,
  onRead,
  blocked = false,
}: {
  game: GameState;
  onRead: () => void;
  blocked?: boolean;
}) {
  const view = socialPresentation(game),
    reason = newsReason(game);
  return (
    <details className="social-panel">
      <summary>社会の様子・知らせ</summary>
      <p className="hint">
        {view.observedMonth === null
          ? "社会の様子はまだ確認していません。"
          : `${view.observedMonth}か月目に確認した概況です。現在の内部状態を示すものではありません。`}
      </p>
      <button disabled={blocked || !!reason} onClick={onRead}>
        知らせを確認（2時間）
      </button>
      {reason && <p className="hint">{reason}</p>}
      <dl>
        {view.axes.map((a) => (
          <div key={a.key}>
            <dt>{a.label}</dt>
            <dd>{a.state}</dd>
          </div>
        ))}
      </dl>
      {view.events.length === 0 ? (
        <p>確認した社会の知らせはありません。</p>
      ) : (
        view.events.map((e) => (
          <article key={e.id} className="entry">
            <p>
              発生：{e.occurredMonth}か月目 ／ 知った時：{e.learnedMonth}か月目
            </p>
            <p>{e.text}</p>
            <p>{e.changes.join("、")}</p>
            <p className="hint">{e.explanation}</p>
          </article>
        ))
      )}
    </details>
  );
}
