# P0-1 現行挙動の回帰基準

対象：v2.0.0-beta.1。起点はPR #1マージ後のmain **`397f30b`**。ブランチは `test/p0-1-regression-baseline`。2026-10-16に現行コード・全テスト群・設定・Actionsを確認した。

この文書は現行の保証範囲と不足の棚卸しであり、[v3設計](GAME_DESIGN.md)の実装完了宣言ではない。ゲーム機能・バランス・UI・保存形式・依存・CI・公開設定は変更しない。P0-2には着手しない。

## テスト構成と実行範囲

| 種別 | 設定と実行 | 現行範囲・注意点 |
|---|---|---|
| 単体/統合 | `vitest.config.ts`、`npm test` | `tests/**/*.test.ts`。既存18ファイル91件から、P0-1で1ファイル追加・既存1ファイル補強。長期100人生も含む |
| 長期 | `npm run test:long` | `tests/longSimulation.test.ts`だけ再実行。seed=`7919×1..100`、modern/coastal交互、5方針、ランダム決断。40歳で正規化往復。購入/投資/手動選択を網羅しない |
| 開発UI | `playwright.config.ts`、`npm run test:browser` | devサーバー5173、Chromium、1280×900と390×844各5ケース。`reuseExistingServer:true`。UIセーブfixtureはViteのsrc importを使用するため本番成果物試験とは別 |
| 本番Pages/PWA | `playwright.pages.config.ts`、ビルド後 `npm run test:pages` | preview4173、再利用不可、Android Chrome相当/iPhone相当WebKit。2 worker、retry 0。各3基本ケース+Chromium用更新2ケース。HTMLレポートと失敗時trace/screenshot |
| Actions | `.github/workflows/pages.yml` | main push/PR/workflow_dispatch。Node24、npm ci→test→build→両エンジン導入→test:pages。PRは公開なし。mainでは公開後にSHA/アセット/世界データのHTTP確認。`test:browser`はCIで未実行、`test:long`はnpm testに内包。ワークフローは今回変更しない |

既存の `pages-tests/update.spec.ts` は更新内部状態の検査2ケースをWebKitで明示skipする。P0-1でskipの追加・削除・拡大はしない。iPhone相当WebKitの通常操作・保存・オフライン3ケースは対象に残す。

## 領域別の対応表

| 領域 | テストファイル | 現行保証範囲（実行成功した環境に限る） | 未検証範囲 | 既知問題・今後の対応 |
|---|---|---|---|---|
| 月次進行・月境界 | `tests/engine.test.ts`、`progression.test.ts`、`education.test.ts`、`health.test.ts`、**`regressionBaseline.test.ts`** | 1月増加、就学/卒業/退職、収支。追加で11→12→13月、終了後の停止、選択待ちを挟む同月の状態保持 | 全年齢・全職種・全決断をまたぐ状態組合せ、将来の時間予算 | 時間の統一モデルはP2-2、シーン時間はP5-1。成長/収支の分布はP1-3/P6-1 |
| イベント選択・保留・結果 | `engine.test.ts`、`eventRules.test.ts`、`feedback.test.ts`、`contentSaves.test.ts`、`lifeEvents.test.ts`、`health.test.ts`、**`regressionBaseline.test.ts`** | 条件/優先順位/選択間隔、pending停止、選択効果、人生決断の受諾、遅延効果。追加でpending+queue保存、残イベントの一回適用、同月の月次系非再実行、無pendingでchooseの無効果、翌月遅延効果 | 全JSON選択肢の成功/失敗分岐、全イベント間の相互作用 | `feedback.test.ts` の「once per 3 months」という旧タイトルは現行の12月間隔を証明しない（直後の抑制のみ）。12月間隔はcontentSavesと現行実装を参照。因果/情報公開はP1-2/P4-2/P4-3 |
| 自主行動の制限 | `engine.test.ts`、`social.test.ts`、`economy.test.ts`、**`regressionBaseline.test.ts`** | 月1回、翌月再可、就労/学習の年齢条件、購入制限。追加でstudy/rest/contactが同じlastActionMonthを使い、保存再開でも二重実行不可、pending/finishedで拒否 | 全購入/行動の組合せ、将来の強度・時間配分 | 現行の購入枠はlastSpendMonthで自主行動枠と別。v3統合時間予算はP2-2。交流必ず好転はK4/P3-1 |
| シード再現性 | `engine.test.ts`、`traits.test.ts`、`origins.test.ts`、`eventRules.test.ts`、`contentSaves.test.ts`、**`regressionBaseline.test.ts`** | 初期属性・出生条件、月次、判定、自動海辺300月。追加で2 seed×両世界の160月、手動選択/自主行動/交流と保存再開を逐次比較 | 別ルール版・別コンテンツ版間、全seed、全分岐、将来のストリーム分割 | 操作履歴の製品内保存/再生は未実装。今回のテスト用操作列はP0-3の設計を先取りしない |
| 成長・教育・就労・家計 | `balance.test.ts`、`v16.test.ts`、`economy.test.ts`、`education.test.ts`、`origins.test.ts`、`progression.test.ts`、`longSimulation.test.ts` | 年齢成長/衰退、求人/採用要因、教育分岐、税/資産移転/債務整理、100人生の有限性 | 世界/出生条件別の分位点、全職種・全購入・失業履歴、実際の努力量の比較 | K3→P1-3/P2-3/P6-1。現行の簡易モデルを統計的リアリティの達成としない |
| NPC生活・関係・死亡 | `social.test.ts`、`relationships.test.ts`、`lifeEvents.test.ts`、`progression.test.ts`、**`regressionBaseline.test.ts`** | 出会い/疎遠/再会、NPC同士の交際結婚/子ども、死別の参照解除、未成年/故人/家族の交際拒否。追加で故人のnpcMonth更新と交流拒否 | 故人の表示年齢固定、全関係参照、無限世代、遅延更新、PCの知識範囲 | K1死亡年齢→P1-1、K2記録混在→P1-2、K4対称/好転→P3-1〜3、保存参照→K5/P0-2 |
| 保存・JSON・3スロット | `migration.test.ts`、`contentSaves.test.ts`、**`regressionBaseline.test.ts`**、`browser-tests/game.spec.ts`、`pages-tests/pages.spec.ts`/`update.spec.ts` | 正規化/旧フィールド補完/破損拒否、ブラウザの破損保存保護、JSON/UI往復。追加で実形式fixture、raw state、pending復帰、3枠すべて/上書き独立/不正slot拒否、保存キー/formatVersion保護 | 実際の過去リリースから採取した旧保存一式、全破損パターン、容量超過/権限拒否/競合タブ、全参照整合性 | 標準の未来version/envelopeは拒否。範囲外関係/無効参照/混合envelopeの不足K5〜7→P0-2。推定不能値を新たに生成しない |
| modern/coastal読込 | `contentSaves.test.ts`、**`pagesPaths.test.ts`**、`longSimulation.test.ts`、`pages-tests/pages.spec.ts` | 両JSON検証、実際の両manifestを使うfetch URL検証へ補強。追加で未知world、manifest HTTP/ID不一致、events HTTP/HTML拒否。本番HTTPで両世界取得・世界切替 | サーバー応答の全異常、全イベントの実プレイ、世界制度分離 | 単一制度の2コンテンツであり、世界別ルールはP5-2。イベント分岐はP4-2 |
| Pagesサブパス | `pagesPaths.test.ts`、**`pages-tests/pages.spec.ts`**、既存`scripts/verify-pages.mjs` | `/life-simulator/`下の世界JSON/manifest、アイコン/PNG寸法。追加でHTML参照のJS/CSS/favicon URL・HTTP成功・MIME・空でないbody、world idとeventsの安全なfilename | 別repo名/独自ドメイン、全ネットワーク障害、今回ブランチの公開後検査（非デプロイ） | base変更なし。将来もP5-2/P6-3で維持。ビルドだけを公開成功とみなさない |
| PWAキャッシュ/オフライン/更新 | `pages-tests/pages.spec.ts`、`update.spec.ts`、`update-site.ts` | worker制御/scope/activatedと実キャッシュ、未キャッシュ負の対照、offline reloadのSW応答、保存保持/進行/世界切替、更新待機と保存後反映、破損セーブ保護 | OSによる終了/再起動・保存領域整理、Safariホーム画面実機、WebKit更新内部検査、保存失敗の全経路 | Playwright1.64.1の既存回避方針を維持。自動WebKitと実機は別。環境制約と結果は下記。P6-3で総合確認 |

太字は今回追加/補強したテスト。既存テストを削除・skip・期待値緩和していない。

## 追加した再現可能な操作列

`tests/regressionBaseline.test.ts` はseed **42 / 20261016**、world **modern / coastal**、初期属性 **female / bisexual** の4ケースを実行する。

各ケースで出生から160回、次を行う。

1. ループ番号mod4に従い `rest` → 母へ`talk` → `study` → 父と`spend` を繰り返す。就学前のstudyは現行の年齢制限に従う。
2. `advanceMonth` を1回実行する。
3. pendingがあれば、累積選択回数mod選択肢数のindexで `choose`。pendingがなくなるまで繰り返す。実データの出来事と144月のclub-planを含む。

同じ操作を出生から独立に再実行する系と、pending/自主行動/交流直後に `exportSave`→`importSave` する系を持ち、**各操作後の全状態**を比較する。選択と成功した学習・交流を実際に通ったことも検査する。失敗メッセージにはseed/world/初期属性/実行済み操作列をJSONで出す。

乱数状態や分岐を保存済みの最終数値へ固定せず、同一ルール上の実行同士を比較する。将来の乱数ストリーム分割では、この同一入力の再現契約を維持しつつ内部表現に合わせてテストを更新できる。具体的な出目・NPC人数・就職結果のgolden snapshotは設けない。

選択中断のテストは実セーブfixtureの完了済み月を基礎に、テスト専用のchoice→log queueを置く。pending中の再advance、保存復元、choose、再choose、翌月の遅延効果を分け、月次の乱数/収支/人物/学校成績が同月中に再適用されないことを確認する。テスト用のイベントは製品JSONや保存仕様の追加ではない。

## 実形式fixture

[fixture来歴と生成手順](../tests/fixtures/README.md)を参照。`current-v1-club-pending.json` は起点コードから無編集で書き出した144月・部活選択待ちの約10KB。`formatVersion:1` の外側と `state.version:1` を区別する。自動保存はenvelopeでなくstateそのもの。

既存の「old save」テストは現行newGameからフィールドを削除した合成データである。実在した過去の保存サンプルがあるとは記録しない。今回のfixtureも「旧版の推測形式」ではなく現行v2の実形式である。

## 既知問題（合格仕様として固定しない）

以下の受入条件は将来の修正時に満たすもの。P0-1では不具合が続くことを期待する通常テストは追加していない。既存の不具合に触れるテストも今回削除しない。

### K1 故人の年齢が現在月で増える — P1-1

`social.ts`のPersonには死亡年月がなく、`main.tsx`人物欄は `floor((game.month - person.birthMonth)/12)` をaliveにかかわらず表示する。死亡した人物が保存されている状態で12月進めて人物欄を開くと年齢が1増える。`npcMonth`自体の故人除外とは別問題。

将来の受入：死亡年月と出生年月による年齢固定、保存復元でも不変、不明な旧死亡月を捏造しない（AC-01/03）。今回の追加テストは既に死亡したNPCの生活更新・交流拒否だけを保証する。

### K2 PC人生ログとNPCの世界履歴が混在 — P1-2

`engine.ts`は `socialMonth`/`npcMonth` のcallbackを同じ `journal.record` へ渡す。PCの知識や距離による公開判定がない。`movedAway:true` のNPCでも死亡条件（100歳等）を満たして月次進行すると死別文がPCのhistoryへ入る。無関係なNPC間の就職/結婚なども同じ経路で記録される。

将来の受入：内部の事実とPCが知る通知を分離し、死亡月と知った月を区別する（AC-08）。テスト内で同一操作のhistoryを比較することは、NPCの全情報を公開する仕様の承認ではない。

### K3 成長・昇進・資産インフレ傾向 — P1-3

既存100シードは5方針で自動選択するが購入/投資を行わず、定額支出・継続就労・昇進によって資産が蓄積しやすい。従来記録の最終純資産平均は約6,303万円、40歳就労99/100。これは分位点・出生条件別・人が支出するプレイの分布を保証しない。

再現：`npm run test:long` の `LONG_SIMULATION` と `balance.ts`/`progression.ts`/`careers.ts`/`economy.ts` の成長・昇進・収支を照合する。現行の「最低寿命>60」等のassertはv3の突然死を禁止する設計ではない。

将来の受入：観測分布と根拠に基づき調整し、努力の意味と平凡/失敗の人生も保つ（AC-06/07/09）。今回は係数や既存しきい値を変更しない。

### K4 交流が必ず好転し、方向別4軸でない — P3-1/P3-2

`social.contact` は生存する相手のcloseness/trustへ正の値を加える。相性・状況による悪化/不変や相手からの拒否を扱う構造ではない。上限到達による変化なしは感情反応の仕様ではない。既存 `social.test.ts` の好転テストは現行限定。

将来の受入：方向別4軸+別の恋愛的魅力、改善/悪化/不変、拒否/解消（AC-05）。今回の交流枠・再現性テストは好転量を固定しない。

### K5 関係値の範囲検査不足 — P0-2（関係モデル改修はP3-1）

現行fixtureの `state.relations[0].trust = 150` としてJSONインポートすると受理される。正規化はfiniteを検査するが0〜100を検査しない。通常生成の長期テストで範囲内でも、入力検証の保証にはならない。

将来の受入：破損入力の保護と範囲の整合（AC-02/03/05）。拒否か明示移行かはP0-2で決め、今回は受理を正常仕様としてassertしない。

### K6 人物参照の検査不足 — P0-2/P3-2

fixtureの `state.relations[0].id = 'not-a-person'` としてもインポートが通る。参照先の存在・相互整合まで検査していない。

将来の受入：保存と人物参照の整合性、破損原本の保護（AC-03/05）。無効参照の正規化方針を今回は新設しない。

### K7 未来のenvelopeとraw stateを混ぜた形の識別不足 — P0-2

標準の `{ format:'life-simulator', formatVersion:99, state }` は拒否され、今回もテストする。一方、raw stateのフィールドも同じ最上位へ混ぜた `{ ...state, format:'life-simulator', formatVersion:99, state }` はraw v1として受理される。`importSave` は対応envelope以外をraw stateへ渡すため、全ての未来形式を厳密に拒否するわけではない。

将来の受入：実際のraw保存との互換性を保った形式識別と未来形式の保護（AC-03）。架空の旧形式としてサポートを追加せず、欠陥の記録とする。

K5〜7は今回、現行fixtureを複製して上記の各1か所を変更し、Vite SSRで読み込んだ実際の `importSave(JSON.stringify(value))` がthrowしないことを調査した。通常の拒否テストを緩めたり、受理を保証するテストを追加したりはしていない。

## 今回の実行結果と限界

実行環境：Linux、Node24.19.0 / npm11.9.0、Playwright1.64.1。結果は本ブランチのテスト・fixture変更を含む。コマンドに `CHROMIUM_EXECUTABLE` を指定した場合はシステム `/usr/bin/chromium` を使い、Playwright配布の同梱Chromiumとは区別する。

| コマンド | 結果 |
|---|---|
| `npm test` | **19ファイル・107件成功**、skip 0。追加16件（新ファイル11件+読込の異常系5件）、100人生を含む |
| `npm run build` | 成功。TypeScript/Vite/Workbox。ゲームJS/CSSの出力名は起点と同じ `index-B1sgq6pO.js` / `index-DCnG1VwN.css` |
| `npm run test:long` | **100/100人生完走、1件成功**（別途再実行、約70秒） |
| `CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:browser` | **10件成功**（PC5・モバイル5）、Chromium154.0.8037.57 |
| `CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:pages` | 全体は成功扱いにしない。**Chromium5件成功 / WebKit3件は本体不在でlaunch失敗 / 既存WebKit更新2件はskip**。アプリ試験中のWebKitエラーではない |
| `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright npx playwright install webkit` | 配布CDN/mirrorが403 `Domain forbidden`、WebKit27.2 / revision2370を導入できず。導入先は書込可能なworkspaceへ指定した |

最初のPages実行は前回の検証用previewが4173を占有して開始できなかった。コマンドを確認してその旧プロセスを終了し、同じ設定で再実行した結果が上表。設定のserver再利用やretryは変更していない。デフォルトのWebKit導入先 `/home/agent/.cache/ms-playwright` も存在しなかったため、書込可能な上記パスで再試行し、通信制限を確認した。

WebKitの更新2件の既存skip以外に新しいskipはない。WebKit本体を導入できるCI/環境では既存設定のまま全 `npm run test:pages` を実行する。今回のブランチpushだけでは、main push/PR起動のActionsは走らない。PR作成後のCI結果や公開結果をローカル成功から推定しない。

今回の長期観測は最低寿命77.5歳、平均92.51歳、最高100歳、最終純資産平均63,030,312円、40歳就労99/100。従来の記録と同じだが、将来版の固定目標にはしない。

WebKitの自動試験、iPhone実機Safari、Android実機のホーム画面・OS再起動・保存領域整理、Firefox、スクリーンリーダーの包括検証を、ローカルChromiumの成功で代替しない。PWAのキャッシュ/オフライン/更新の既存検証は維持し、実機確認はP6-3の残課題とする。

## 引継ぎ

P0-1の成果はテスト・実形式fixture・この対応表である。P0-2ではK5〜7を含む保存入力の課題、現在のversion/key/slotと移行の責務を設計する。P0-3では操作履歴と乱数の責務を設計する。P1-1〜3では上記既知問題を個別に修正する。**今回はP0-2へ着手せず、P0-1のレビュー・マージを待つ。**


## P0-2での追記（P0-1の観測記録は上に保存）

PR #2マージ後のmain `19104a6` を起点に、K5〜K7の限定的な入力検査を追加した。上の再現条件と実行記録はP0-1時点の履歴である。

- K5：closeness/trustの範囲外を拒否。clampせず、0/100と小数は受理。
- K6：relations.idがpeopleに存在しなければ拒否。故人への関係は維持。NPCの婚姻/親子/歴史的リンクの全体的な整合は未解決。
- K7：raw/envelopeを識別し、未来版・別形式・混合を拒否。直接のraw正規化も混合を通さない。

判断理由と保留事項は [SAVE_MIGRATION](SAVE_MIGRATION.md)、状態の責務は [STATE_ARCHITECTURE](STATE_ARCHITECTURE.md) を参照。`tests/saveMigration.test.ts` と `browser-tests/save-validation.spec.ts` で新しい拒否条件・既存互換性・原本保護を検証する。K1〜K4は未修正。P0-1のテストとfixtureは変更していない。

## 夜間バッチ P0-3 / P1-1 / P1-2追記

基点main 57193e7。K1は新規死亡月の保存と不明な旧死亡時年齢の表示で修正。K2は新しいNPC更新通知を構造化し、内部世界履歴とPC公開経路を分離して修正した。過去の混在ログは削除しない。K3のバランスおよびK4の関係モデルには着手しない。

乱数は互換性を優先して基盤のみ導入し、ゲームの単一seedを全面切替しない。追加のテストはrandomHistory/deceasedAge/npcKnowledge、ブラウザはdeceased/knowledge。P0-1/P0-2のテストと実fixtureを削除・skipせず維持する。個別実績はROADMAP_V3と最終のVALIDATION追記を参照。

## P1-3〜P2-2 更新（main 638762d起点）

P0-1時点の上表は当時の棚卸しとして保存する。現在は次の回帰を追加した。

| 領域 | 追加テスト・観測 | 現在の保証と残る範囲 |
|---|---|---|
| K3 暫定インフレ抑制 | inflation.test.ts、balance-study.mjs、BALANCE_P1_3.md | 同じ60人生と再起24ケースの変更前後比較。高能力の獲得逓減、上位昇進期間、既得値の保持。実社会較正/大標本は未完。最大資産は増加、失業開始の純資産正が12/12→11/12という副作用も記録 |
| 4層・保存 | capabilities.test.ts、browser-tests/capabilities.spec.ts | 旧fixture厳密一致、未知の過去技能の非捏造、技能成長/資質公開、月次一重観測、値域拒否、両世界で保存再開。NPC全面適用/成長判定の刷新はP3/P2-3 |
| 時間・強度・計画 | timeBudget.test.ts、browser-tests/timeBudget.spec.ts | 時間境界/資金/健康/購入競合、待機→選択→再開、予定と不実行、実行時間、死亡中断、両世界保存一致。旧途中月の消費済み詳細時間は未知。シーンはP5-1 |
| 既存保存・NPC・公開 | 既存の全回帰・ブラウザ・Pagesテストを維持 | キー/formatVersion/state.version/3スロット/pending/queue/scheduled、死亡時年齢と知識公開を維持。WebKit本体不在による未検証と実機Safari未実施はVALIDATIONに明記 |

K4の交流必ず好転する問題は今回変更せずP3-1へ残す。保存の未知参照や旧ログの伝播等、既存文書の未決事項も今回解消したことにしない。新旧ルールをまたぐ抽選結果一致は保証せず、同一ルール・初期条件・操作列の決定性を保護する。

## P2-3〜P3-3 積み重ねバッチ

P2-3は実時間/健康/疲労/環境を技能へ接続し、代表rollへ技能を一重適用。P3-1/P3-2でK4の新しい交流について方向別感情、悪化/不変、拒否、自律行動を導入した。旧relationsと故人の履歴は保持。通常画面はPCの気持ちと観測済み応対、確認済みの生活情報を分ける。テストはskillGrowth/directedRelations/npcAgency/npcTiers、ブラウザはdirectedRelations/npcAgencyを追加。P3-3は分類・時計・性能計測のみで、実遅延の受入は未完了。機能切替を無効とし、計測では分類の有無で状態が一致したことだけを保証する。

## Phase 4 追加回帰

社会6軸/旧保存境界はtests/society.test.ts、3系統/実効果/因果/独立乱数/旧pendingはtests/societyEvents.test.ts、未観測/私的情報/費用/既知原因/保存はtests/socialPresentation.test.ts。ブラウザはbrowser-tests/socialPresentation.spec.tsのmodern/coastal×PC/mobile。旧seedとの比較はscripts/social-regression-study.mjsとdocs/measurements/phase4-seed-regression.json。fantasyは社会プロファイル/文章の単体検証までで、プレイ可能ワールドではない。P3-3の実遅延、GUI再設計、実機Safariの未検証を解消したとは扱わない。

## Phase 5

tests/scenarios.test.tsは月次排他/条件/分岐/費用/報酬/0時間撤退/途中保存/次月pendingと遅延効果/過去run/再送拒否。tests/worldRules.test.tsは既存レジストリ/未知ID/設定不変/公開ルール一致、tests/fantasy.test.tsは非冒険就業/種族寿命/魔法/シーン/保存と3スロット/私的情報/未来版拒否。browser-tests/scenariosWorlds.spec.tsは実際の新規世界・種族選択/手動→再読込→自動完了、pages-tests/fantasy.spec.tsは本番オフラインで公開JSON3本と新規fantasy月進行。scripts/world-regression-study.mjsは既存10seedの全人生を一切の状態除外なしで月次hash比較する。実機/詳細世界制度/旧NPC年齢閾値は残課題として文書化する。
