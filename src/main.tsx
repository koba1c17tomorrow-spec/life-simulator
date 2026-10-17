import { FocusControls } from "./FocusControls";
import { actionReason, remainingHours } from "./timeBudget";
import { CapabilityPanel } from "./CapabilityPanel";
import { visibleTraits } from "./capabilities";
import { PwaStatus } from "./PwaStatus";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  newGame,
  normalizeGameState,
  advanceMonth,
  autoResolve,
  choose,
  takeAction,
  meetPerson,
  separate,
  ageLabel,
  type GameState,
  type EventDefinition,
} from "./engine";
import { JOBS, jobOffers, offerChance } from "./careers";
import {
  admissionChance,
  wealthNames,
  educationNames,
  upbringingNames,
} from "./origins";
import { traitNames, traitDescriptions } from "./traits";
import { relativeScore, type RelativeStat } from "./balance";
import { rollChance, rollExplanation } from "./eventRules";
import { careerName, annualSalary } from "./progression";
import { relationLabel, personalityLabel, personAgeLabel } from "./social";
import {
  genderLabel,
  orientationLabel,
  type Gender,
  type Orientation,
} from "./identity";
import { setStudyPath } from "./education";
import { EconomyPanel, RetrospectivePanel, SavePanel } from "./panels";
import { SAVE } from "./saves";
import { WORLDS, loadWorld } from "./content";
import "./style.css";
function initialLoad() {
  try {
    const raw = localStorage.getItem(SAVE);
    return {
      state: raw ? normalizeGameState(JSON.parse(raw)) : newGame(),
      error: "",
      blocked: false,
    };
  } catch {
    return {
      state: newGame(),
      error:
        "保存データを読み込めません。元データは上書きせず保持しています。スロットかJSONから復元、または新しい人生を明示的に開始してください。",
      blocked: true,
    };
  }
}
function App() {
  const [initial] = useState(initialLoad);
  const [game, setGame] = useState(initial.state);
  const [error, setError] = useState(initial.error);
  const [saveBlocked, setSaveBlocked] = useState(initial.blocked);
  const [events, setEvents] = useState<EventDefinition[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const [tab, setTab] = useState("history");
  const [setupOpen, setSetupOpen] = useState(false);
  const [chosenGender, setChosenGender] = useState<Gender | "random">("random");
  const [chosenOrientation, setChosenOrientation] = useState<
    Orientation | "random"
  >("random");
  const [world, setWorld] = useState("modern");
  const [birthSeed, setBirthSeed] = useState("");
  const [choiceMinimized, setChoiceMinimized] = useState(false);
  const [loadError, setLoadError] = useState("");
  const resume = useRef(false);
  const historyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    setEvents([]);
    setLoadError("");
    const config = WORLDS.find((w) => w.id === game.worldId);
    if (!config) {
      setLoadError("ワールドが見つかりません");
      return;
    }
    loadWorld(config.id)
      .then((e) => {
        if (!cancelled) setEvents(e);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [game.worldId]);
  useEffect(() => {
    if (!saveBlocked)
      try {
        localStorage.setItem(SAVE, JSON.stringify(game));
      } catch {
        setError(
          "自動保存に失敗しました。JSONバックアップを保存してください。",
        );
      }
    if (game.pending && !game.autoChoices) {
      if (playing) resume.current = true;
      setPlaying(false);
    }
    if (game.finished) {
      resume.current = false;
      setPlaying(false);
    }
  }, [game, saveBlocked]);
  useEffect(() => {
    if (!game.pending) setChoiceMinimized(false);
  }, [game.pending?.eventId]);
  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = 0;
  }, [game.history[0]?.id]);
  useEffect(() => {
    if (
      !playing ||
      !events.length ||
      game.finished ||
      (game.pending && !game.autoChoices)
    )
      return;
    const timer = window.setInterval(
      () => setGame((s) => autoResolve(advanceMonth(s, events), events)),
      speed,
    );
    return () => clearInterval(timer);
  }, [playing, events, speed, game.pending, game.finished, game.autoChoices]);
  useEffect(() => {
    if (!setupOpen && (!game.pending || game.autoChoices || choiceMinimized))
      return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (setupOpen) setSetupOpen(false);
        else setChoiceMinimized(true);
      }
      if (e.key === "Tab") {
        const elements = focusable(),
          first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [setupOpen, game.pending?.eventId, game.autoChoices, choiceMinimized]);
  const restore = (state: GameState) => {
    setPlaying(false);
    resume.current = false;
    setChoiceMinimized(false);
    setSaveBlocked(false);
    setError("");
    setGame(state);
  };
  const stats = [
    ["health", "健康"],
    ["happiness", "幸福"],
    ["knowledge", "知識"],
    ["sociability", "社交性"],
    ["money", "所持金"],
  ] as const;
  const locked = !!game.pending || game.finished || saveBlocked;
  const educationNamesUI = {
    preschool: "幼少期",
    elementary: "小学校",
    middle: "中学校",
    high: "高校",
    university: "大学",
    vocational: "専門学校",
    working: game.retired ? "退職後" : "社会人",
  };
  return (
    <div className="shell">
      <header>
        <div>
          <div className="eyebrow">LIFE SIMULATION</div>
          <h1>人生の記録</h1>
          <p>
            {WORLDS.find((w) => w.id === game.worldId)?.name} —
            月単位の人生シミュレーション
          </p>
        </div>
        <button
          onClick={() => {
            setPlaying(false);
            setSetupOpen(true);
          }}
        >
          新しい人生
        </button>
      </header>
      <PwaStatus
        beforeUpdate={() => {
          if (saveBlocked) {
            setError(
              "元の保存データを保護しています。JSONかスロットから復元、または新しい人生を開始してから更新してください。",
            );
            return false;
          }
          try {
            localStorage.setItem(SAVE, JSON.stringify(game));
            setPlaying(false);
            return true;
          } catch {
            setError(
              "保存できなかったため更新を中止しました。JSONバックアップを保存してください。",
            );
            return false;
          }
        }}
      />
      {(error || loadError) && (
        <div className="notice" role="alert">
          {error || loadError}
        </div>
      )}
      <div className="layout">
        <aside className="panel sidebar">
          <div className="eyebrow">CURRENT LIFE</div>
          <div className="age">{ageLabel(game.month)}</div>
          <div className="hint">
            {genderLabel(game.identity.gender)} /{" "}
            {orientationLabel(game.identity.orientation)}
          </div>
          <div className="hint">
            特性：{visibleTraits(game).map((t) => traitNames[t]).join("・")}
          </div>
          <div className="muted" role="status">
            {game.finished
              ? "人生終了"
              : game.pending
                ? "選択待ち"
                : playing
                  ? "時間が進行中"
                  : "一時停止中"}
          </div>
          <div className="stats">
            {stats.map(([key, label]) => (
              <div className="stat" key={key}>
                <span>{label}</span>
                <strong>
                  {key === "money"
                    ? Math.round(game.stats[key]).toLocaleString() + " 円"
                    : relativeScore(
                        game.stats[key],
                        game.month,
                        key as RelativeStat,
                      ) + "/100（同年代比）"}
                </strong>
                {key !== "money" && (
                  <meter
                    min={0}
                    max={100}
                    value={relativeScore(game.stats[key], game.month, key)}
                    aria-label={label + " 同年代比"}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="divider" />
          <label htmlFor="priority">生活方針</label>
          <select
            id="priority"
            disabled={locked}
            value={game.priority}
            onChange={(e) =>
              setGame((s) => ({
                ...s,
                priority: e.target.value as GameState["priority"],
              }))
            }
          >
            <option value="relationships">家族・友人</option>
            <option value="wellness">健康管理</option>
            <option value="learning">自己研鑽</option>
            <option value="hobby">趣味</option>
            <option value="rest">休息</option>
          </select>
          <p className="hint">
            自然な成長・衰退へ約10%の小さな補正。関連する出来事や人間関係にも影響します。
          </p>
          <p className="hint">
            病気：{game.illness ?? "なし"} ／ ストレス {Math.round(game.stress)}
          </p>
          <label>
            <input
              type="checkbox"
              checked={game.autoChoices}
              disabled={game.finished || saveBlocked}
              onChange={(e) => {
                const enabled = e.target.checked;
                setGame((s) =>
                  autoResolve({ ...s, autoChoices: enabled }, events),
                );
              }}
            />{" "}
            ランダム選択モード
          </label>
          <p className="hint">重大な決断も自動で選びます。</p>
          <div className="divider" />
          <FocusControls game={game} change={setGame} locked={locked} />
          <div className="eyebrow">自主行動（月1回）</div>
          <div className="action-grid">
            {(["study", "work", "rest"] as const).map((kind) => (
              <button
                key={kind}
                title={actionReason(game, kind)}
                disabled={locked || !!actionReason(game, kind)}
                onClick={() => setGame((s) => takeAction(s, kind))}
              >
                {{ study: "勉強", work: "仕事", rest: "休息" }[kind]}
              </button>
            ))}
          </div>
          {(["study", "work", "rest"] as const).map(kind => actionReason(game, kind) && <p className="hint" key={kind}>{{ study: "勉強", work: "仕事", rest: "休息" }[kind]}：{actionReason(game, kind)}</p>)}
        </aside>
        <main className="panel feed">
          <div className="feedhead">
            <div>
              <div className="eyebrow">CHRONICLE</div>
              <h2>{game.finished ? "人生の結末" : "人生の出来事"}</h2>
            </div>
            <nav className="tabs" aria-label="人生の情報">
              {[
                ["history", "記録"],
                ["status", "概要"],
                ["people", "人物"],
                ["career", "進路・仕事"],
                ["economy", "家計・支出"],
                ["timeline", "年表・振り返り"],
                ["saves", "セーブ"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={tab === id ? "active" : ""}
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
          {tab === "history" ? (
            <>
              <div className="entries" ref={historyRef}>
                {game.finished && (
                  <p className="ending">
                    {game.deathCause ?? "人生の終わり"}
                    。年表・振り返りから、歩んできた物語をご覧ください。
                  </p>
                )}
                {game.history.map((entry, i) => (
                  <article
                    className={"entry " + (i === 0 ? "latest" : "")}
                    key={entry.id}
                  >
                    <div className="entry-age">
                      {ageLabel(entry.month)}{" "}
                      {i === 0 && <span className="new">最新</span>}
                    </div>
                    <div>{entry.text}</div>
                  </article>
                ))}
              </div>
            </>
          ) : null}
          {tab === "economy" && <EconomyPanel game={game} setGame={setGame} />}
          {tab === "timeline" && <RetrospectivePanel game={game} />}
          {tab === "saves" && (
            <SavePanel game={game} onRestore={restore} onError={setError} />
          )}
          {tab === "status" && (
            <div className="summary">
              <CapabilityPanel game={game} />
              <h3>出生条件と個性</h3>
              <p>
                家庭：{wealthNames[game.origin.wealth]} ／{" "}
                {upbringingNames[game.origin.upbringing]}
              </p>
              <p>
                親の学歴：{educationNames[game.origin.parentEducation]} ／
                職業：{game.origin.parentOccupation}
              </p>
              <p>
                きょうだい：{game.origin.siblings}人 ／ 地域：
                {
                  { city: "都市", rural: "地方", coastal: "沿岸" }[
                    game.origin.region
                  ]
                }
              </p>
              {visibleTraits(game).map((t) => (
                <p key={t}>
                  <strong>{traitNames[t]}</strong>：{traitDescriptions[t]}
                </p>
              ))}
              <p>
                親の資質：
                {game.origin.parentTraits
                  .map((ts) => ts.map((t) => traitNames[t]).join("・"))
                  .join(" ／ ")}
                。資質は親の影響と偶然から決まり、育つ環境との組み合わせで作用します。
              </p>
              <p>
                幼少期の自信：{game.childhoodConfidence.toFixed(1)} ／ 介護経験{" "}
                {game.caregivingMonths}か月
              </p>
              <p>実績：{game.achievements.join("・") || "これから"}</p>
              <p>
                記録 {game.history.length}件 ／ 年表 {game.timeline.length}件
              </p>
            </div>
          )}
          {tab === "people" && (
            <div className="summary">
              <h3>人間関係</h3>
              <p>
                会わない日々に疎遠になったり、遠くの友人と再会することもあります。
              </p>
              <div className="people-list">
                {game.people.map((person) => {
                  const r = game.relations.find((r) => r.id === person.id);
                  return (
                    <article className="person" key={person.id}>
                      <div>
                        <strong>{person.name}</strong> ·{" "}
                        {person.kind === "family"
                          ? "家族"
                          : person.kind === "teacher"
                            ? "教師"
                            : "友人"}
                        <div className="hint">
                          {personAgeLabel(person, game.month)}
                          ／{" "}
                          {person.alive
                            ? (person.occupation ?? "未就学")
                            : "故人"}
                          {person.movedAway ? " ／ 遠方" : ""}
                          {person.illness ? " ／ 療養中" : ""}
                        </div>
                        <div className="hint">
                          {personalityLabel(person)} ／{" "}
                          {person.values === "career"
                            ? "仕事を大切に"
                            : person.values === "freedom"
                              ? "自由を大切に"
                              : "家族を大切に"}{" "}
                          ／ {person.education ?? "在学中"}
                        </div>
                        <div className="hint">
                          親密度 {Math.round(r?.closeness ?? 0)} ／ 信頼度{" "}
                          {Math.round(r?.trust ?? 0)} ·{" "}
                          {r ? relationLabel(r) : "知人"}{" "}
                          {game.spouseId === person.id
                            ? "配偶者"
                            : game.partnerId === person.id
                              ? "交際中"
                              : ""}
                        </div>
                        <div className="hint">
                          配偶者：
                          {game.spouseId === person.id
                            ? "あなた"
                            : (game.people.find((p) => p.id === person.spouseId)
                                ?.name ?? "なし")}{" "}
                          ／ 子ども {person.childCount ?? 0}人
                        </div>
                      </div>
                      <div className="person-actions">
                        <button
                          disabled={
                            locked ||
                            !person.alive ||
                            game.lastActionMonth === game.month || remainingHours(game) < 8
                          }
                          onClick={() =>
                            setGame((s) => meetPerson(s, person.id, "spend"))
                          }
                        >
                          一緒に過ごす
                        </button>
                        <button
                          disabled={
                            locked ||
                            !person.alive ||
                            game.lastActionMonth === game.month || remainingHours(game) < 8
                          }
                          onClick={() =>
                            setGame((s) => meetPerson(s, person.id, "talk"))
                          }
                        >
                          相談する
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {remainingHours(game) < 8 && <p>交流には8時間必要です。残り時間が不足しています。</p>}
              <h4>人物同士のつながり</h4>
              {game.npcLinks.map((l, i) => (
                <p key={i}>
                  {game.people.find((p) => p.id === l.a)?.name} と{" "}
                  {game.people.find((p) => p.id === l.b)?.name}：
                  {l.kind === "married"
                    ? "結婚"
                    : l.kind === "dating"
                      ? "交際"
                      : l.kind === "conflict"
                        ? "対立"
                        : "友人"}
                </p>
              ))}
            </div>
          )}
          {tab === "career" && (
            <div className="summary">
              <h3>教育と仕事</h3>
              <p>
                現在：{educationNamesUI[game.education]} ／ 学歴：
                {game.degree ?? "未修了"}
                {game.dropout ? "（中退経験）" : ""}
              </p>
              <p>
                成績 {Math.round(game.origin.schoolPerformance)} ／
                大学合格見込み{" "}
                {admissionChance(
                  game.origin,
                  game.stats.knowledge,
                  game.traits,
                )}
                %
              </p>
              <p>
                部活：
                {
                  {
                    none: "なし",
                    arts: "文化芸術",
                    sports: "運動",
                    science: "科学",
                  }[game.club]
                }{" "}
                ／ 奨学金：{game.scholarship ? "給付あり" : "なし"}
              </p>
              <p>
                進路は15〜18歳に変更できます。大学は合否判定、専門学校は2年間の学習と費用が必要です。
              </p>
              <div className="career-grid">
                {(["university", "vocational", "job"] as const).map((path) => (
                  <button
                    key={path}
                    disabled={locked || game.month < 180 || game.month >= 216}
                    aria-pressed={game.studyPath === path}
                    onClick={() => setGame((s) => setStudyPath(s, path))}
                  >
                    {
                      {
                        university: "大学",
                        vocational: "専門学校",
                        job: "就職",
                      }[path]
                    }
                  </button>
                ))}
              </div>
              <h3>キャリア</h3>
              <p>
                {game.retired
                  ? "退職・年金生活"
                  : (JOBS.find((j) => j.id === game.jobId)?.name ??
                    careerName(game.career))}{" "}
                ／ 昇進 {game.careerLevel}段階 ／ 職業経験 {game.workExperience}
                か月
              </p>
              <p>
                年収目安{" "}
                {game.retired
                  ? "年金"
                  : Math.round(
                      (JOBS.find((j) => j.id === game.jobId)?.salary ??
                        annualSalary(game.career)) *
                        (1 + game.careerLevel * 0.1),
                    ).toLocaleString() + "円"}
              </p>
              <p>求人は適性・学歴・資格・経験に応じた選択イベントです。</p>
              {!game.retired &&
                game.month >= 192 &&
                jobOffers(game).map((job) => (
                  <p key={job.id}>
                    {job.name}：年収 {job.salary.toLocaleString()}円 ／ 採用率{" "}
                    {offerChance(game, job)}%
                  </p>
                ))}
              <h3>家族</h3>
              <p>
                交際相手：
                {game.people.find((p) => p.id === game.partnerId)?.name ??
                  "なし"}{" "}
                ／ 配偶者：
                {game.people.find((p) => p.id === game.spouseId)?.name ??
                  "なし"}{" "}
                ／ 子ども {game.children}人
              </p>
              <p>
                交際・結婚・家族計画は選択イベントで決めます。関係を深め、将来について話す機会を待ちましょう。
              </p>
              <button
                disabled={locked || (!game.partnerId && !game.spouseId)}
                onClick={() => {
                  if (window.confirm("相手と別れ、新しい生活を始めますか？"))
                    setGame(separate);
                }}
              >
                別れる・離婚する
              </button>
            </div>
          )}
        </main>
      </div>
      <footer className="controls">
        <div className="control-left">
          <button
            className="primary"
            disabled={!events.length || locked}
            onClick={() => {
              resume.current = false;
              setPlaying((x) => !x);
            }}
          >
            {playing ? "⏸ 一時停止" : "▶ 再生"}
          </button>
          <button
            disabled={!events.length || locked || playing}
            onClick={() =>
              setGame((s) => autoResolve(advanceMonth(s, events), events))
            }
          >
            ＋1か月
          </button>
          <label>
            速度{" "}
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={1200}>ゆっくり</option>
              <option value={600}>標準</option>
              <option value={180}>速い</option>
              <option value={80}>超高速</option>
              <option value={30}>最速</option>
            </select>
          </label>
        </div>
        <span className="hint">このブラウザに自動保存</span>
      </footer>
      {setupOpen && (
        <div className="overlay">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-title"
          >
            <h2 id="setup-title">新しい人生の設定</h2>
            <label>
              ワールド
              <select value={world} onChange={(e) => setWorld(e.target.value)}>
                {WORLDS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              性別
              <select
                value={chosenGender}
                onChange={(e) =>
                  setChosenGender(e.target.value as Gender | "random")
                }
              >
                <option value="random">ランダム</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="nonbinary">ノンバイナリー</option>
              </select>
            </label>
            <label>
              性的指向
              <select
                value={chosenOrientation}
                onChange={(e) =>
                  setChosenOrientation(e.target.value as Orientation | "random")
                }
              >
                <option value="random">ランダム</option>
                <option value="heterosexual">異性愛</option>
                <option value="bisexual">両性愛</option>
                <option value="homosexual">同性愛</option>
                <option value="asexual">無性愛</option>
              </select>
            </label>
            <label>
              乱数シード（空欄でランダム）
              <input
                type="number"
                min="0"
                max="4294967295"
                step="1"
                value={birthSeed}
                onChange={(e) => setBirthSeed(e.target.value)}
              />
            </label>
            <p>
              同じシード・ワールド・属性設定と同じ選択で同じ人生を再現できます。現在の人生はスロットかJSONに保存しておくと安心です。
            </p>
            <div className="career-grid">
              <button onClick={() => setSetupOpen(false)}>キャンセル</button>
              <button
                className="primary"
                onClick={() => {
                  const seed =
                    birthSeed === ""
                      ? crypto.getRandomValues(new Uint32Array(1))[0]
                      : Number(birthSeed);
                  if (
                    !Number.isInteger(seed) ||
                    seed < 0 ||
                    seed > 4294967295
                  ) {
                    setError("シードは0〜4294967295の整数です");
                    return;
                  }
                  if (
                    window.confirm("現在の人生を置き換えて新しく始めますか？")
                  ) {
                    restore(
                      newGame(
                        seed,
                        {
                          gender: chosenGender,
                          orientation: chosenOrientation,
                        },
                        world,
                      ),
                    );
                    setSetupOpen(false);
                  }
                }}
              >
                新しい人生を始める
              </button>
            </div>
          </div>
        </div>
      )}
      {game.pending && !game.autoChoices && choiceMinimized && (
        <button
          className="pending-banner"
          onClick={() => setChoiceMinimized(false)}
        >
          未回答の選択肢があります — 開く ↑
        </button>
      )}
      {game.pending && !game.autoChoices && !choiceMinimized && (
        <div className="overlay">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="choice-title"
          >
            <div className="decision-head">
              <div className="eyebrow">DECISION / {ageLabel(game.month)}</div>
              <button onClick={() => setChoiceMinimized(true)}>
                一時的に閉じる ×
              </button>
            </div>
            <h2 id="choice-title">選択のとき</h2>
            <p>{game.pending.text}</p>
            <div className="choice-buttons">
              {game.pending.choices.map((c, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const shouldResume = resume.current;
                    resume.current = false;
                    setGame((s) => autoResolve(choose(s, i, events), events));
                    setChoiceMinimized(false);
                    if (shouldResume) setPlaying(true);
                  }}
                >
                  <span>{c.label} →</span>
                  <small className="effect-preview">
                    {[
                      ...(c.effects ?? []).map(
                        (e) =>
                          ({
                            health: "健康",
                            happiness: "幸福",
                            knowledge: "知識",
                            sociability: "社交性",
                            money: "所持金",
                          })[e.stat] + ` ${e.delta > 0 ? "+" : ""}${e.delta}`,
                      ),
                      ...(c.jobId
                        ? [
                            `採用率 ${c.successChance}%`,
                            `想定年収 ${JOBS.find((j) => j.id === c.jobId)?.salary.toLocaleString()}円`,
                          ]
                        : []),
                      ...(c.roll
                        ? [
                            `成功率 ${rollChance(game, c.roll)}%（${rollExplanation(game, c.roll)}）`,
                          ]
                        : []),
                      ...(c.relationshipDelta
                        ? [`親密度・信頼度 ${c.relationshipDelta}`]
                        : []),
                      ...(c.delayed
                        ? [`${c.delayed.months}か月後にも影響`]
                        : []),
                    ].join(" ／ ") || "人生の方向を決めます"}
                  </small>
                </button>
              ))}
            </div>
            <p className="hint">
              閉じても時間は停止したままです。未回答の通知から戻れます。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
