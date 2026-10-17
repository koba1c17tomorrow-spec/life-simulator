# P4-1 社会状態

単一社会の任意拡張 `society.version:1`。6軸はすべて0..100、高いほど生活上良好。economy=雇用・所得環境、safety=外出の安全、stability=政治制度の安定、mobility=教育/職業の機会、publicHealth=公衆衛生、tolerance=異なる属性への寛容性。これは統計へ較正した指標ではない。

初期値（上記順）はmodern [50,50,50,50,50,50]、coastal [48,55,50,48,52,52]、fantasy [45,40,45,35,40,35]。50を中立とする暫定設定。fantasyは社会モジュールの設定だけで、プレイ可能なワールド追加ではない。現行コンテンツはmodern/coastalのみ。寿命・貨幣・職業などの世界ルール実装はP5へ残す。

月1回、各軸に `0.02*(初期値-現在値)+(draw-0.5)*0.8` を加え0..100にclamp。緩やかな平均回帰と小変動で、毎月の劇的事件を強制しない。worldSociety名から生成した独立LCGの現在値をsociety.randomStateへ保存する。既存randomStreamsの初期化時点やNPC/旧seedの消費を変更しない。社会内の更新/イベントはこの1本を共有し、保存再開で継続する。

新規ゲームは月0で初期化。旧保存は読込時に補完しない。次の未開始月に現在seedから導入し、startMonth/legacyBaselineを保存。その月より前の社会・事件・PC知識は推定しない。pending途中は開始し直さない。lastUpdatedMonthで同月再適用を防ぐ。キー/3スロット/formatVersion/state.versionは維持。不正な拡張は拒否し、元保存保護は既存経路を利用。

接続は段階的に行う。職業/所得=economy、教育/昇進=mobility、健康=publicHealth、交流/移動=safety/stability/toleranceを共通環境として参照できる。P4-1では倍率を適用しない。P4-2で社会へのショックとPC/NPC共通の危険時の外出制約を接続し、既存の収入/成長/病気の係数を一括変更しない。人物による社会貢献はP4-2の履歴依存イベントで小さく表現する。

検証: tests/society.test.ts（新規・旧fixture、範囲、平均回帰、同月冪等、保存再開、旧ゲーム状態/seedの維持、拒否入力）。
