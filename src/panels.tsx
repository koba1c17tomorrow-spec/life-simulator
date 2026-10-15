import { useState } from "react";
import type { GameState } from "./engine";
import {
  PURCHASES,
  purchaseReason,
  spend,
  transfer,
  changeLiving,
  restructure,
} from "./economy";
export type PanelProps = {
  game: GameState;
  setGame: (updater: (s: GameState) => GameState) => void;
};
export function EconomyPanel({ game: s, setGame }: PanelProps) {
  const [amount, setAmount] = useState(10000);
  return (
    <div className="summary">
      <h3>家計と資産</h3>
      <p>
        月収 {s.monthlyIncome.toLocaleString()}円 ／ 月支出{" "}
        {s.monthlyExpenses.toLocaleString()}円
      </p>
      <dl>
        {Object.entries(s.expenseBreakdown).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v.toLocaleString()}円</dd>
          </div>
        ))}
      </dl>
      <p>
        所持金 {s.stats.money.toLocaleString()}円 ／ 貯蓄{" "}
        {s.savings.toLocaleString()}円 ／ 投資 {s.investments.toLocaleString()}
        円 ／ 借金 {s.debt.toLocaleString()}円
      </p>
      <p>
        住居：{{ family: "実家", rent: "賃貸", owned: "持家" }[s.housing]}
        。投資には元本割れがあります。生活費や金融制度はゲーム用の簡易モデルです。
      </p>
      <label>
        生活水準{" "}
        <select
          value={s.living}
          onChange={(e) =>
            setGame((s) =>
              changeLiving(s, e.target.value as GameState["living"]),
            )
          }
        >
          <option value="basic">質素</option>
          <option value="standard">標準</option>
          <option value="comfortable">ゆとり</option>
        </select>
      </label>
      <h3>金融</h3>
      <label>
        金額（円）{" "}
        <input
          type="number"
          min="1"
          step="1000"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </label>
      <div className="career-grid">
        {(["save", "withdraw", "invest", "sell", "repay"] as const).map(
          (kind) => (
            <button
              key={kind}
              disabled={
                s.month < 216 ||
                !!s.pending ||
                s.finished ||
                amount <= 0 ||
                !Number.isSafeInteger(amount) ||
                (kind === "withdraw"
                  ? s.savings
                  : kind === "sell"
                    ? s.investments
                    : s.stats.money) < amount ||
                (kind === "repay" && s.debt < amount)
              }
              onClick={() => setGame((s) => transfer(s, kind, amount))}
            >
              {
                {
                  save: "貯蓄",
                  withdraw: "引出",
                  invest: "投資",
                  sell: "売却",
                  repay: "借金返済",
                }[kind]
              }
            </button>
          ),
        )}
      </div>
      <button
        disabled={
          s.debt < 3000000 || s.restructured || s.finished || !!s.pending
        }
        onClick={() => {
          if (
            window.confirm(
              "資産を返済に充て債務を整理します。7年間投資に制約が付きます。実行しますか？",
            )
          )
            setGame(restructure);
        }}
      >
        債務整理
      </button>
      <h3>お金を使う</h3>
      <p>
        購入は月1回。年齢・買い替え間隔・所持金による制限があります。効果は累積せず、支援の有効期間を更新します。
      </p>
      {[...new Set(PURCHASES.map((p) => p.category))].map((category) => (
        <section key={category}>
          <h4>{category}</h4>
          <div className="shop-grid">
            {PURCHASES.filter((p) => p.category === category).map((p) => {
              const reason = purchaseReason(s, p);
              return (
                <article className="shop-item" key={p.id}>
                  <strong>
                    {p.name} · {p.price.toLocaleString()}円
                  </strong>
                  <p>{p.description}</p>
                  <button
                    disabled={!!reason}
                    aria-label={p.name + "を購入"}
                    onClick={() => setGame((s) => spend(s, p.id))}
                  >
                    購入
                  </button>
                  <small>{reason || "購入できます"}</small>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function RetrospectivePanel({ game: s }: Pick<PanelProps, "game">) {
  return (
    <div className="summary">
      <h3>{s.finished ? "人生の振り返り" : "これまでの歩み"}</h3>
      <p>
        {Math.floor(s.month / 12)}年{s.month % 12}か月の物語。
        {s.finished
          ? `死因：${s.deathCause ?? "旧セーブでは未記録"}`
          : "人生は続いています。"}
      </p>
      <p>
        職業経験 {s.workExperience}か月 ／ 子ども {s.children}人 ／ 親しい人{" "}
        {
          s.relations.filter(
            (r) =>
              r.closeness >= 60 &&
              s.people.some((p) => p.id === r.id && p.alive),
          ).length
        }
        人
      </p>
      <p>
        純資産{" "}
        {(s.stats.money + s.savings + s.investments - s.debt).toLocaleString()}
        円 ／ 介護 {s.caregivingMonths}か月
      </p>
      <p>
        {s.finished
          ? s.children > 0
            ? "家族を育てた日々が、次の世代へつながっていく。"
            : s.workExperience > 240
              ? "積み重ねた仕事は、誰かの暮らしを支えてきた。"
              : "出会いと選択の一つひとつが、かけがえのない人生になった。"
          : "節目は年表に残り、人生の終わりに振り返れます。"}
      </p>
      <h4>実績</h4>
      <p>{s.achievements.join(" ／ ") || "これから見つかります"}</p>
      <h4>人生年表</h4>
      <ol className="timeline">
        {s.timeline.map((e, i) => (
          <li key={i}>
            <strong>
              {Math.floor(e.month / 12)}歳{e.month % 12}か月
            </strong>{" "}
            {e.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

import {
  describeSlot,
  saveSlot,
  loadSlot,
  exportSave,
  importSave,
} from "./saves";
export function SavePanel({
  game: s,
  onRestore,
  onError,
}: {
  game: GameState;
  onRestore: (s: GameState) => void;
  onError: (message: string) => void;
}) {
  const [revision, refresh] = useState(0);
  const attempt = (f: () => void) => {
    try {
      f();
      onError("");
      refresh(revision + 1);
    } catch (e) {
      onError(e instanceof Error ? e.message : "保存に失敗しました");
    }
  };
  return (
    <div className="summary">
      <h3>セーブ管理</h3>
      <p>
        現在の人生は自動保存されます。スロットは別の保管場所です。ブラウザデータを削除すると失われるため、JSONでの書き出しも利用してください。
      </p>
      {[1, 2, 3].map((slot) => (
        <section key={slot}>
          <h4>スロット {slot}</h4>
          <p>{describeSlot(localStorage, slot)}</p>
          <button
            onClick={() =>
              attempt(() => {
                if (
                  !localStorage.getItem("life-sim-modern-v1-slot-" + slot) ||
                  window.confirm(
                    "スロット " + slot + " を現在の人生で上書きしますか？",
                  )
                )
                  saveSlot(localStorage, slot, s);
              })
            }
          >
            スロット {slot} に保存
          </button>{" "}
          <button
            onClick={() =>
              attempt(() => {
                const next = loadSlot(localStorage, slot);
                if (
                  window.confirm(
                    "現在の人生をスロット " +
                      slot +
                      " の内容に置き換えますか？",
                  )
                )
                  onRestore(next);
              })
            }
          >
            スロット {slot} を読込
          </button>
        </section>
      ))}
      <h4>バックアップ</h4>
      <button
        onClick={() =>
          attempt(() => {
            const url = URL.createObjectURL(
              new Blob([exportSave(s)], { type: "application/json" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = `life-${s.worldId}-${s.month}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          })
        }
      >
        JSONを書き出す
      </button>
      <p>
        <label>
          JSONから読み込む{" "}
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 5000000)
                  throw Error("セーブファイルが大きすぎます");
                const next = importSave(await file.text());
                if (
                  window.confirm("現在の人生をファイルの内容に置き換えますか？")
                ) {
                  onRestore(next);
                  onError("");
                }
              } catch (e) {
                onError(
                  e instanceof Error ? e.message : "読み込みに失敗しました",
                );
              }
            }}
          />
        </label>
      </p>
      <p>
        出生シード：{s.birthSeed ?? "旧データのため不明"} ／ 現在の乱数状態：
        {s.seed}
      </p>
    </div>
  );
}
