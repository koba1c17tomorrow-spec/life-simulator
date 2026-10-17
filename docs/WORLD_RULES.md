# P5-2 世界ルールと共通エンジン

worldRules.tsはengine/UI/storage/networkをimportしない純粋な世界データ。contentの世界リストはレジストリから作り、世界IDを共有する。ルールはeducation（開始/成人/制度名）、economy（通貨/生活費/扶養）、species（種族/寿命）、careers（職業/所得/時間）、magic、socialProfile、eventsFile、scenariosを持つ。共通側は人物ID/関係/知識/保存v1/乱数/720時間/場面状態機械を提供する。

modern/coastalはengine:'legacy'のまま。教育の細分・入試・JOBS/昇進/経済・PC/NPCの健康係数は既存経路を維持し、このバッチで全係数を注入へ置換しない。レジストリのlegacy monthlyCost:0/childAllowance:0/careers:{}は「無料・無職」のルールではなく未移行の印で、既存economy.ts/careers.tsが正本。種族humanの寿命上限1200、学校開始72、成人216は既存制度の記述。worldRulesを読むだけでは乱数を消費しない。

P5-3ではfantasyだけ別の月次方針モジュールへ分岐し、共通の人物関係/能力成長/社会/シーン/保存を利用する。既存engine全体を複製せず、ファンタジーの教育/就労/生活費/寿命処理を小さなworld moduleで実装する。公開worlds/ID/manifest.json→events.jsonのサブパス読込を維持し、追加JSONは既存PWA globで事前キャッシュする。実行時の世界ルール変更/セーブの世界強制変換はしない。

移行は任意の世界固有状態から開始し、存在しない過去を補完しない。世界別のコンテンツやルール版を将来更新する際はSAVE_MIGRATIONの版ポリシーに従う。旧worldIdの意味や外側v1を変更しない。未移行のlegacyハードコード（入試/恋愛年齢/NPC成人/退職等）は将来の局所置換対象として残す。NPC実遅延は対象外。

検証: tests/worldRules.test.ts（ID/順序/通貨/旧経路/未知ID/設定不変/旧世界の決定性）。既存seedの完全な比較と公開/保存/PWAは最終バッチ検証へ記録する。

## P5-3 の接続

fantasyのルールはsrc/fantasyRules.jsonへ分離し、公開rules.jsonと一致を検査。教育/職業/通貨/種族寿命/魔法/社会/イベント/シナリオをfantasy.tsから使用する。共通側engineはworldId分岐で同モジュールへ委譲し、旧2世界はそのまま。legacyの未移行係数をfantasyへ無条件流用せず、未対応の円建て購入/PC結婚・求人APIを無効にする。共有NPC行動の年齢閾値など残る制約はFANTASY_PROTOTYPEへ明示する。
