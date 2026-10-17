# P0-3 決定的乱数と構造化履歴

夜間バッチ起点：main `57193e7dcb4730b7ebcfc61b383051f2a352c853`。添付仕様で許可された「独立ストリームの基盤を先行し、ゲーム進行への全面適用を保留」を採用した。

## 乱数の互換性と責務

既存の進行中v1セーブも新規ゲームも、当面は従来の単一 `seed` で進める。出生時draw、健康/NPC/教育/経済へのcallback、selectEvents、chooseの判定、autoResolve等の乱数消費順を変更していない。Math.randomや実時刻は使用しない。新規ゲームだけの切替も今回しないため、同じ入力seedの過去のバランスを変更しない。

`randomStreams.ts` は独立した基盤で、`pcHealth`、`npcRelations`、`events`、`worldSociety` を明示的に持つ。初期化はuint32 seedと名前のFNV-1a（UTF-16 code unit、uint32演算）、更新は既存と同じLCG係数1664525/1013904223、出力はuint32/2^32。すべてを `version:1` の規則として扱う。

GameStateの任意フィールド `randomStreams` を使用すれば状態を保存・復元できるが、実際の月次ゲームはこのフィールドを消費しない。基盤の利用者が明示的に初期化・drawする。旧保存の現在seedから「過去の独立ストリーム」を復元したとは扱わない。今後全面適用する際はルール版・境界・旧方式継続を別途決定し、今回の基盤完了を全面適用済みと誤認しない。

## 内部履歴

`worldHistory.ts` の任意フィールド `worldHistory` はversion、nextId、eventsを持つ。イベントは単調増加の `world-N` ID、発生月、種類、人物ID列、構造化JSON data、visibility、任意のPC知識（知った月・direct/public/reported・任意の伝達者）を保持する。文章は必要ならdataの一要素であり、事実の種類/人物/時刻とは別である。

代表経路として `choose` の有効な選択を `pc.choice` で記録する。イベントID、選択index/label、関係人物を保存し、PCの直接経験として知識時刻を付ける。既存のPCログは維持し、新しい内部履歴を画面へ直接渡さない。無pending時のchooseや保存再開では再記録しない。

履歴は欠落時に空配列をロード補完せず、最初の新しい事実の発生時だけ作る。旧history/timelineを解析して未知の過去イベントやPC知識を捏造しない。自動の履歴切捨ては実装しない。一方で保存ファイルの既存5,000,000文字制限があり、長期の履歴圧縮・索引・保持方針は将来検討する。

## 保存境界と検証

保存キー/3スロット、formatVersion:1、state.version:1は維持。追加項目は任意で、それぞれ小形式のversionを検査する。未対応version、範囲外ストリーム、重複/逆行ID、未来のイベント/知識時刻、不正dataを拒否する。新規履歴の人物IDは歴史的参照であり、現在のpeople集合との一致を強制しない。

`tests/randomHistory.test.ts` はstream独立性、保存続行、旧fixture無変更、構造化データの複製、ID継続、実選択の一回記録、不正拡張拒否を検証する。P0-1/P0-2のテスト・fixtureは変更しない。P1-2で新しいNPC事実の記録と公開境界にこの基盤を利用する。

## P3-2の局所適用

新NPC判断だけnpcRelationsを消費する。既存ストリームは継続し、欠落時は初回使用時の現在seedから生成し、導入境界をnpcAgencyへ保存する。旧NPCの仕事/接触/交際形成判断をagencyへ移したため旧単一seedの消費順は過去版と異なるが、健康・イベント等を他ストリームへ全面移行しない。同一ルール/seed/操作列と保存再開は一致させる。文字列コード順の人物ID処理で環境依存localeを用いない。詳細はNPC_AGENCY.md。

## Phase 4 worldSocietyの局所適用

社会専用継続値はsociety.randomStateに保持し、既存のworldSociety名によるFNV初期化とLCGを再利用する。既存randomStreamsへ新たなdraw/初期化を加えないことでNPCストリームの導入境界も維持する。新規は出生seed、旧保存は次の未開始月の現在seedから導入。社会更新6draw、適格事件の試行1drawと成功時の候補選択1drawを共有する。同じ社会ルール/入力/保存再開で一致。新しい世界履歴の挿入によるworld-N番号差は意図した変化で、従来の人物判定は番号を乱数に使わない。

## Phase 5

シーンは開始時現在seedからevents名の局所LCGをrun.randomStateへ分離する。選択可能性/時間/費用を確認後に判定がある選択だけ1draw。自動は最初の実行可能な選択を進めるので選択順のための追加drawなし。通常人生のseed/既存ストリームを変更しない。fantasyは新世界専用の月次規則でs.seedを継続し、既存世界と同じ結果を主張しない。modern/coastalでシーンを開始しない10seedの全人生を、社会や履歴IDを除外せず毎月完全状態hashで比較した実測をVALIDATIONへ記録する。
