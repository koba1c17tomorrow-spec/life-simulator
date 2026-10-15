# 起動と検証

Node.js 24 LTSで、チェックアウト内の `package.json` がある場所から実行します。

```bash
npm ci
npm test
npm run build
npm run dev
```

Windows PowerShellでも同じコマンドを使えます。`npm ci` はコミット済みのロックファイルから導入します。依存関係を更新する開発作業では `npm install` を使い、ロックファイルの差分も確認してください。

ブラウザ検証は初回に `npx playwright install chromium`、その後 `npm run test:browser`。LinuxのシステムChromiumを使う場合は `CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:browser`。

外部API、秘密情報、データベースは不要です。ワールドJSONを読み込むため、HTMLを直接開かずViteまたはHTTPサーバーを使ってください。本番配信は `npm run build` の生成物 `dist/` を静的ホスティングへ配置します。

詳細：[README.md](README.md) / [VALIDATION.md](VALIDATION.md)。
