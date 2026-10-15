# 人生の記録 — v1.3 開発版

月単位で人生を進める日本語ブラウザゲーム。React・TypeScript・Vite製で、プレイ中のAIや外部APIは不要です。

## Windowsで起動

1. Node.jsのLTS版をインストール
2. GitHubの「Code → Download ZIP」でダウンロードして解凍
3. **package.json があるフォルダ**でPowerShellを開く
4. 次を実行

```powershell
npm install
npm run dev
```

5. 表示されたURL（通常 http://127.0.0.1:5173/ ）を開く。停止は Ctrl+C。

`package.json` が見つからない場合はフォルダ階層を確認してください。`vite` が認識されない場合は同じフォルダで `npm install` を実行してください。

## 遊び方・実装機能

- 月単位の自動進行、速度調整、停止、人生ログ、ブラウザ内自動セーブ
- 主人公の性別・性的指向は新しい人生の開始時にランダムまたは手動設定
- NPCの性格・性別・性的指向・親密度・信頼度、交流、恋愛、結婚、家族
- 学校・進学・就職・転職・昇進・失業
- 出生時にランダム生成される1〜3個の特性（学習・健康・交流への影響）
- 同年代平均を50とした相対ステータス、月ごとの自然減少、就労による健康への負荷
- 年収目安とステータス依存の採用確率、乱数による合否判定
- NPCの自律的な就職・失業・転居（初期実装）
- 収入・生活費・借金・返済
- 選択肢なしの幸運・不運イベント。選択イベントは原則3か月以上の間隔
- 選択肢の効果プレビューと一時収納
- JSON形式のイベント定義

セーブはブラウザのlocalStorageに保存されます。ブラウザデータを削除すると失われます。性的指向のランダム生成確率と恋愛相性判定はゲーム用の暫定モデルで、現実の統計を厳密に再現したものではありません。

## 開発とテスト

```powershell
npm test
npm run build
```

主要コード：`src/engine.ts`（進行・イベント）、`src/social.ts`（NPC）、`src/identity.ts`（属性）、`src/progression.ts`（学校・仕事・家計）、`src/main.tsx`（画面）、`public/worlds/modern/events.json`（イベント）。

**現状：v1.3のコードはGitHubに反映済みですが、最新状態のビルド・ブラウザ動作検証は未実施です。**

今後の優先順位は [ROADMAP.md](ROADMAP.md) を参照。起動方法は [SETUP.md](SETUP.md)、更新履歴は [FEEDBACK_V1_1.md](FEEDBACK_V1_1.md)。

初期構想と残件：[INITIAL_VISION_AUDIT.md](INITIAL_VISION_AUDIT.md)
