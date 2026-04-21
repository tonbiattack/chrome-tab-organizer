# Development Notes

このドキュメントは、ローカルでこの Chrome 拡張を修正するときの前提をまとめたものです。

## 前提

- Manifest V3 の Chrome 拡張です
- popup UI から処理を実行します
- コアロジックはテストしやすいように UI から分離しています
- popup 設定とカスタムルールは `chrome.storage.local` に保存します

## 実装の分割

### `src/tab-organizer.js`

- CommonJS 形式
- Jest テストから `require()` して使います
- 重複削除とグループ化のコアロジックを持ちます

### `src/tab-organizer.browser.js`

- ESM 形式
- `popup.js` から `import` して使います
- popup でそのまま読み込めるよう、ブラウザ向けに分けています

### `popup.js`

- popup の初期化・設定の読み込みと保存（`chrome.storage.local`）
- 現在ウィンドウのタブ数表示（全ウィンドウ対象時はウィンドウ数も表示）
- 実行結果のステータスメッセージ表示
- `chrome.commands` の現在のショートカット表示
- ショートカットからの重複削除 / グループ化 / 管理グループ解除
- 標準ルールの凡例表示・個別チェックボックスによる有効/無効切り替え
- 標準ルールの一括選択 / 一括解除
- カスタムルールの追加 / 編集 / 削除 / 有効化
- カスタムルールの import / export
- Jira タブ URL から課題キー抽出
- Google ドキュメント URL から Doc ID 抽出
- Jira 課題キー / Google Doc ID / URL パターンを複合条件として 1 ルールにまとめる
- 整理後にグループを折りたたむオプション（`collapseGroups` 設定）
- 拡張が管理するグループだけを解除する（`ungroupAllTabs`）

## テスト

通常:

```bash
npm test
```

カバレッジ:

```bash
npm run test:coverage
```

既存テストでは次を確認しています。

- URL 正規化
- サービス判定（Confluence / Jira / GitHub / Slack / Notion / Gemini / Google / ChatGPT / Qiita / Zenn / Amazon / YouTube）
- 重複タブ削除
- タブ並び替えとグループ化
- グループの一括解除（`ungroupAllTabs`）
- popup 純粋ロジック（設定復元、カスタムルール優先順位、Jira / Google Doc 抽出、import / export）
- ルール定義の整合性（名前の重複なし・Chrome 許可色のみ使用）

## Chrome での確認手順

1. `chrome://extensions/` を開く
2. 対象拡張の更新ボタンを押す
3. popup を開く
4. `重複タブを削除` と `ドメインごとに整理` を確認する
5. `全ウィンドウを対象にする` の保存を確認する
6. `整理後にグループを折りたたむ` を ON にして整理し、グループが折りたたまれることを確認する
7. 標準ルールの `すべて解除` → `ドメインごとに整理` が正常に動作することを確認する（グループ化なしで並び替えのみ実行される）
8. `グループをすべて解除` を押し、ルール名と一致するグループだけが解除され、手動グループは残ることを確認する
9. カスタムルールの追加 / 編集 / 削除 / 有効化を確認する
10. カスタムルールのエクスポートとインポートを確認する

## 変更時の注意点

- 標準ルール定義は `src/group-rules.json` を単一ソースとし、CommonJS 版と ESM 版でそこから `RegExp` を組み立てる
- popup で `import` を使うファイルは `type="module"` で読み込む必要がある
- `chrome://` と `chrome-extension://` は Chrome API 操作の対象外として扱っている
- グループ化処理では、ルール名と一致するタイトルの既存グループだけを解除して再作成する。手動で作ったグループ（タイトルがルール名と一致しないもの）には触れない
- `ungroupAllTabs` も同じ判定を使い、ルール名と一致するタイトルのグループだけを解除する
- popup で `chrome.storage` を使うため、`manifest.json` に `storage` 権限が必要
- ショートカット表示は `chrome.commands.getAll()` を使う。未割り当てなら `manifest.json` の既定キーを表示する
- カスタム URL パターンは保存時と読込時の両方で正規表現として検証している
- カスタムルールの import / export は JSON 形式で行い、対象はカスタムルールのみ
- 標準ルールをすべて解除した状態でも整理ボタンは正常動作する（グループ化なし・タブ並び替えのみ）
- `sortAndGroupTabs` の第 4 引数 `{ collapsed }` でグループの折りたたみ状態を制御できる
- タイトル一致ベースのため、手動グループでもルール名と同名なら管理対象として扱われる

## 改善余地

- popup UI のスクリーンショットを README に追加する
- Jira API と連携して親課題やエピック名から自動でルール生成する
