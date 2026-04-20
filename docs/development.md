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
- 標準ルールの凡例表示・個別チェックボックスによる有効/無効切り替え
- 標準ルールの一括選択 / 一括解除
- カスタムルールの追加 / 削除 / 有効化
- Jira タブ URL から課題キー抽出
- 整理後にグループを折りたたむオプション（`collapseGroups` 設定）
- すべてのグループを解除する（`ungroupAllTabs`）

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
- サービス判定（Jira / GitHub / Slack / Notion / Google / ChatGPT / Qiita / Zenn / Amazon / YouTube）
- 重複タブ削除
- タブ並び替えとグループ化
- グループの一括解除（`ungroupAllTabs`）
- ルール定義の整合性（名前の重複なし・Chrome 許可色のみ使用）

## Chrome での確認手順

1. `chrome://extensions/` を開く
2. 対象拡張の更新ボタンを押す
3. popup を開く
4. `重複タブを削除` と `ドメインごとに整理` を確認する
5. `全ウィンドウを対象にする` の保存を確認する
6. `整理後にグループを折りたたむ` を ON にして整理し、グループが折りたたまれることを確認する
7. 標準ルールの `すべて解除` → `ドメインごとに整理` が正常に動作することを確認する（グループ化なしで並び替えのみ実行される）
8. `グループをすべて解除` を押し、すべてのタブグループが解除されることを確認する
9. カスタムルールの追加 / 削除 / 有効化を確認する

## 変更時の注意点

- ルールを変える場合は CommonJS 版と ESM 版の両方を更新する
- popup で `import` を使うファイルは `type="module"` で読み込む必要がある
- `chrome://` と `chrome-extension://` は Chrome API 操作の対象外として扱っている
- グループ化処理では、ルール名と一致するタイトルの既存グループだけを解除して再作成する。手動で作ったグループ（タイトルがルール名と一致しないもの）には触れない
- popup で `chrome.storage` を使うため、`manifest.json` に `storage` 権限が必要
- カスタム URL パターンは保存時と読込時の両方で正規表現として検証している
- 標準ルールをすべて解除した状態でも整理ボタンは正常動作する（グループ化なし・タブ並び替えのみ）
- `sortAndGroupTabs` の第 4 引数 `{ collapsed }` でグループの折りたたみ状態を制御できる

## 改善余地

- `GROUP_RULES` の定義重複をビルドや生成で解消する
- popup UI のスクリーンショットを README に追加する
- Jira API と連携して親課題やエピック名から自動でルール生成する
