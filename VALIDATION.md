# 検証記録 — 2026-10-16

対象：v2.0.0-beta.1。Node.js 24.19.0 / npm 11.9.0 / Linux / Chromium。

## 結果

| チェック | 実行結果 |
|---|---|
| `npm install`（初回）・`npm ci`（ロックから再導入） | 成功 |
| `npm test` | 17ファイル・89テスト成功、失敗/スキップ0。100シードの長期テストを含む |
| `npm run build` | TypeScript型チェック・本番ビルド成功 |
| `CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:browser` | PC 1280×900 / モバイル390×844、各5ケース、計10成功 |
| 本番生成物をVite previewで起動 | 上記2画面幅で進行・再読込保存・海辺ワールド切替成功、ページ/コンソールエラー0 |
| JSON検証 | 現代59件・海辺60件、ID重複・不正効果・不正条件・無効manifestの拒否を確認 |
| セーブ | 旧フィールド補完、旧方針変換、3スロット独立性、JSON往復、途中保存後の再現性、不正データ拒否・自動上書き停止 |
| ログ | 1500件のローリング上限に達した後と再読込後もID重複なし |

ブラウザの5ケース：表示/進行/保存/各タブの画面幅、購入/貯蓄/スロット復元/書出し、重要決断の停止/フォーカス循環/Escape/再表示、ワールド作成/不正インポート保護/エンディング、破損自動保存の保持。全ケースでページ例外とconsole.errorを検査。既存のfavicon 404も修正した。

## 最終100シードの実測

シード `7919 × 1..100`。5種類の生活方針と2ワールドを交互に使用。ランダム選択モードで各人生を終了まで進め、40歳時点で保存往復して続行。購入や投資の自動実行はしない。

| 観測 | 結果 |
|---|---:|
| 完走 | 100 / 100 |
| 選択待ちによる停止・非有限数・負の金融残高・不正な関係値 | 0 |
| 寿命（最小 / 平均 / 最大） | 77.5 / 92.51 / 100歳 |
| 人生あたりの選択イベント | 平均82.47回 |
| 6歳時点の知識 | 最大21.807 / 100 |
| 40歳時点の就労 | 99 / 100 |
| 40歳時点の平均健康 | 71.03 / 100 |
| 子どもを迎えた人生 | 79 / 100 |
| 最終純金融資産の平均 | 63,030,312円 |

初回検証では健康が40歳でほぼ100に張り付き、子どもを迎える人生が5/100だった。年齢水準への回復・衰退、日常イベントの小さい効果、重要な家族判断の頻度を調整して再実行した。昇給率と税社会保険・生活費も調整した。親の資質を参照する出生特性生成を追加した後、上記の最終100シードで再検証した。

## 判定の範囲

- 同一操作列の再現性は別の既存テストと、海辺ワールド300か月の保存/再開比較で確認。100シードをそれぞれ二重再生した検査ではない。
- 100シードと単体テストはゲームルールの不変条件を検査するもので、全乱数・全イベント順序の証明ではない。
- 税制・金融・進学・家族形成は簡易モデル。人数や年収を現実の統計に合わせたものではない。定額生活費で裁量支出を一切しない自動プレイでは資産が蓄積しやすい。資産分布とプレイヤーの選択体験は次の重点確認項目。
- 主人公の子どもは個体として成長する。NPC側の子どもは家庭人数、出生時の兄弟姉妹は出生条件として扱う。無限世代を個体ごとに計算するモデルではない。
- 大学と専門学校はゲーム上の進路。学校ごとの複雑な入試制度や実在の奨学金・税制度は再現していない。
- UIをPC/モバイルのChromiumで確認。Firefox/WebKit・実機・スクリーンリーダーの包括検証、全人生の手動プレイは未実施。
- GitHubへの反映とクラウド環境の公開は別。環境設定のドラフト保存だけでは新しい環境スナップショットの公開完了にはならない。

## GitHub Pages / PWA対応（2026-10-16）

- Vite base `/life-simulator/` でビルド。manifest・favicon・Appleアイコン・アプリJS/CSS・両ワールドJSONの公開パスを確認。
- `npm test`：18ファイル・91件成功（100シード長期検証を含む）。新たに2ワールドのサブパスURL回帰テストを追加。
- `npm run build`：型チェック・本番ビルド・Workboxサービスワーカー生成成功。依存関係は更新済みロックから `npm ci` で再導入。
- 既存 `test:browser`：PC/モバイルのChromium 10ケース成功。
- ビルド済みサイトに対する `test:pages -- --project android-chrome`：Android Chrome相当のタッチ操作・各タブの幅、ホーム画面用manifest/PNGアイコン、JSONとスロットの往復、再読込保存、オフライン再起動とワールド切替、新SWの待機と保存後の更新、破損セーブ保護の計5ケース成功。
- 次回デプロイのSWをテスト専用サーバーから配信して実際のworker更新を確認。`dist/` 自体を変更せず、公開物へテスト用エンドポイントは含めない。
- GitHub Actionsはmain更新時に検証済みdistを公開。PRは検証だけ。CIではChromium/WebKitを導入し、iPhone相当のWebKitでも公開物のUI・データ・保存・オフラインを検証する構成。worker更新の内部状態確認2ケースはChromium限定で、WebKitでは明示的にスキップ。
- このクラウド環境ではWebKit配布先 `cdn.playwright.dev` / `playwright.download.prss.microsoft.com` が403 `Domain forbidden` のため、ローカルWebKit実行は未実施。iPhone実機での検証も未実施。CIでのWebKit結果はGitHub Actionsで確認する必要がある。
- GitHub Pages APIへのアクセスもForbiddenだったため、既存のPages設定やリモート公開完了はここでは確認できない。初回のSource設定と確認/再実行手順はREADMEに記載した。GitHubへのpush成功と実際の公開成功は区別する。

## WebKitオフライン再読み込み失敗の調査と修正（2026-10-16）

失敗実行：[38896385555](https://github.com/koba1c17tomorrow-spec/life-simulator/actions/runs/38896385555)、対象90f0815。旧Playwright 1.58.2の `iphone-safari` で `setOffline(true)` → `reload()` が `WebKit encountered an internal error` となり、公開前のブラウザ検証で停止した。

原因の根拠：Playwright公式の [issue #42775](https://github.com/microsoft/playwright/issues/42775) は、アプリやフレームワークを使わず、Service Workerが固定のHTML Responseを返すだけでも同じ失敗を再現している。Chromiumでは成功し、WebKitでは自動化のofflineフラグがworkerの応答まで遮断していた。macOS上でも再現されたもので、実機Safariの通信断不具合と同一視しない。[修正PR #42894](https://github.com/microsoft/playwright/pull/42894) が取り込まれた安定版1.64.1へ更新した。

PWAのアプリ実装・キャッシュ戦略・セーブ形式は変更しない。既存の両エンジンのoffline/reload/保存/ワールド切替テストを残し、リトライや新しいskipを追加していない。切断前にworkerのscope/制御/activated状態とHTML・JS/CSS・両ワールドの実キャッシュを確認する。未キャッシュの別ブラウザコンテキストは同じURLでoffline読込が失敗する負の対照を置き、キャッシュ済み側はstatus 200かつService Worker由来の応答であることも検査する。

ローカル検証：`npm test` 91件成功（100人生を含む）、本番ビルド成功、1.64.1のChromiumでPages/PWA5件成功。公開先検証スクリプトはローカルの本番サブパスで全リソースの検査成功と、別コミットの識別子を拒否することを確認。WebKit配布CDNと公式コンテナの取得はクラウドの通信制限で不可のため、matching WebKitはGitHub ActionsのUbuntu runnerで導入・実行する。

CIは再試行0回で実行し、レポートと失敗時トレース/スクリーンショットを7日保存する。公開後は `dist/deployment.json` のSHAが今回のコミットと一致し、HTML・JS/CSS・manifest・アイコン・両ワールド・SWが公開URLから取得できた場合だけdeployジョブを成功にする。CDNへの公開反映待ちだけ最大12回まで確認する。この反映待ちはテスト失敗を再試行で隠す処理ではない。確定したリモート実行結果は [Actions](https://github.com/koba1c17tomorrow-spec/life-simulator/actions/workflows/pages.yml) から確認できる。

実機Safariの追加受入手順：プレイ用データをJSONで保管した上で、公開URLをSafariで開き、オフライン準備完了と月次進行・保存・スロットを確認する。ホーム画面アプリへ必要ならJSONを移行し、機内モードかつWi-Fiオフでアプリを終了・再起動し、保存年齢・世界・スロット復元・別世界の開始と進行を確認する。再接続後の保存・更新も確認する。これはPlaywrightのiPhone相当WebKit検証とは別で、今回の自動テストを実機試験済みとは記録しない。

## 夜間バッチ P0-3 → P1-1 → P1-2（2026-10-17 JST）

起点main `57193e7dcb4730b7ebcfc61b383051f2a352c853`、ブランチ `feat/v3-overnight-p0-3-p1-1-p1-2`。Node24.19.0/npm11.9.0、Linux、Playwright1.64.1、システムChromium154。従来の記録は上に保存する。

| タスク/検証 | 結果 |
|---|---|
| P0-3 `npm test` / `npm run build` | 21ファイル143件成功、ビルド成功。入力検査調整後に新規10件とビルドも再確認 |
| P1-1 `npm test` / `npm run build` | 22ファイル152件成功、ビルド成功。後処理guard調整後に死亡/関係14件とビルドを再確認 |
| P1-1 表示のブラウザ試験 | modern/coastal×PC/モバイル4件成功。12月経過・再読込で固定/不明表示を検証。初回は通常の選択待ちで止まったため、表示試験の状態を明示的にランダム選択モードへ設定して再実行 |
| P1-2/最終 `npm test` / `npm run build` | 23ファイル161件成功、ビルド成功。P0-1/P0-2のテスト・fixtureは変更なし |
| 最終 `npm run test:long` | 100/100人生完走、1件成功（約126秒）。全テストとは別途実行 |
| 最終 `CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:browser` | 22件成功（従来14+故人4+知識境界4） |
| 最終 `CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:pages` | Chromium5件成功。WebKit3件は本体不在で起動失敗、既存更新2件はskip。全体成功とはしない |
| WebKit導入 | 書込可能なworkspaceへ導入試行、配布CDN/mirrorが403 Domain forbidden。実機Safari/iPhone/Android、ホーム画面やOS再起動は未検証 |

Pagesの最初の最終試行では、同時起動した別Playwright suiteが共通test-resultsを掃除し、traceファイルのENOENTが発生した。これはアプリ操作のassert失敗とは別。両suiteが終了後、設定を変えずPages単独で再実行し上表のChromium5件を確認した。skip/retryの追加・テスト削除で回避していない。

100人生の既存統計はP0-3/P1-1/P1-2の全テスト実行で一致（最低77.5歳/平均92.514歳/最高100歳、40歳就労99/100、純資産平均63,030,311.56円）。乱数方式の全面適用を保留したため、既存の単一seedの消費とバランス係数は維持。一方、新しい構造化記録・死亡月・公開マーカーは保存に追加されるので旧版との状態オブジェクトの全フィールド一致を主張しない。

内部履歴を保持するため100人生の試験時間はP1-2で約136秒となった。現行の180秒上限は変更せず通過したが、保存サイズと履歴複製の処理量は今後の課題。記録を黙って切り捨てていない。

旧保存の故人の死亡月は捏造せず不明表示。旧PCログを削除せず、過去の公開済み知識を新たに推定しない。新しいNPC事実の公開境界だけを構造化している。詳細は [RANDOM_AND_HISTORY](docs/RANDOM_AND_HISTORY.md)、[KNOWLEDGE_BOUNDARY](docs/KNOWLEDGE_BOUNDARY.md)、[SAVE_MIGRATION](docs/SAVE_MIGRATION.md)。mainへはマージせず、P1-3以降には着手しない。
