# P0-1 現行セーブfixture

`current-v1-club-pending.json` は起点main `397f30b`（v2.0.0-beta.1）の実際の `newGame` → `advanceMonth` → `exportSave` から生成した約10KBのJSON。手編集による省略・架空の旧形式・移行フィールドの追加はしていない。

- 初期シード：`20261016`
- ワールド：`modern`
- 初期属性：`{ gender: "female", orientation: "bisexual" }`
- 操作：イベント配列 `[]` を用いて出生から144回 `advanceMonth`。自動選択・自主行動なし。
- 保存地点：144月、実際の学校の `club-plan` 選択待ち、`monthStarted: true`。
- 形式：`format: "life-simulator"`、`formatVersion: 1`、`state.version: 1`。`state` 部分は実際の自動保存に使われる形でもある。

目的は既存データの読み込み、選択待ちの保持、JSON往復と再開の互換性。将来エンジンの乱数消費が変わっても、この保存済みデータを新しい出目に合わせて作り直さない。既存の移行テストは新しい状態からフィールドを削除して正規化を試すもので、過去リリースから採取した保存ファイルとは区別する。

## 起点mainでの生成手順

リポジトリ直下で依存導入後に実行する。ViteのSSRローダーで既存TypeScriptを読み込み、ゲームソースやビルド成果物を変更しない。以下は生成来歴であり、通常のテスト実行では再生成しない。

```bash
node --input-type=module <<'JS'
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
const server = await createServer({ server: { middlewareMode: true } });
try {
  const engine = await server.ssrLoadModule('/src/engine.ts');
  const saves = await server.ssrLoadModule('/src/saves.ts');
  let state = engine.newGame(20261016, {
    gender: 'female', orientation: 'bisexual',
  }, 'modern');
  for (let i = 0; i < 144; i++) {
    if (state.pending) throw Error('Unexpected earlier choice');
    state = engine.advanceMonth(state, []);
  }
  if (state.pending?.eventId !== 'club-plan') throw Error('Expected club-plan');
  writeFileSync('tests/fixtures/current-v1-club-pending.json', saves.exportSave(state) + '\n');
} finally {
  await server.close();
}
JS
```

操作列を使う追加テスト、既知問題、実行結果は [回帰基準](../../docs/REGRESSION_BASELINE.md) を参照する。

## P3-2の実状態（P3-3互換検証用）

`p3-2-coastal-observed.json` はP3-2コミット48ae9a8ad8baef18d66cfa03db180da29b5d270eの実エンジンから生成。seed7919、coastal、初期属性指定なし、autoChoices:true、events:[]で144月まで進行。143月終了時にrest/低強度を次月へ計画し、実際に実行した。各月advanceMonth→autoResolve、最後にexportSave。新しいNPC目標・方向別関係・独立NPCストリーム・確認済み情報を含み、npcTiersはまだ存在しない。手編集/架空の旧形式ではない。P0-1のfixtureはそのまま保持する。
