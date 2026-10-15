# 人生の記録 v0.3 — 起動手順

1. Node.js の LTS 版をインストールします。
2. GitHub の緑色の Code → Download ZIP からリポジトリをダウンロードして解凍します。
3. package.json のあるフォルダで PowerShell を開きます（エクスプローラーのアドレス欄に powershell と入力）。
4. `npm install` を実行します（初回のみ）。
5. `npm run dev` を実行し、表示された http://127.0.0.1:5173/ などのURLをブラウザで開きます。
6. 終了は PowerShell で Ctrl+C。

`npm test` でテスト、`npm run build` でビルド確認ができます。

## 現状

月次進行、最新順の人生ログ、選択イベント停止・再開、外部JSONイベント、簡易ステータス、自主行動、ローカル保存を実装。NPC、職業、ワールド切替、複雑な条件式は未実装です。死亡は仮に90歳または健康0としています。
