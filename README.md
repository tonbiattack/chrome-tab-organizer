# Chrome Tab Organizer

重複タブの削除と、サービス単位のタブ整理をワンクリックで行う Chrome 拡張です。  
標準ルールによるグルーピングに加えて、popup からカスタムルールを追加し、Jira の課題キーや Google Doc ID 単位でも整理できます。

## できること

- 重複タブを削除する
- サービスごとにタブを並び替えてグループ化する
- popup からショートカットキーを確認する
- `全ウィンドウ対象` やルール有効状態を保存する
- popup からカスタムルールを追加・削除する
- Jira 課題キーや Google Doc ID を使って任意名のグループを作る
- カスタムルールを JSON でインポート / エクスポートする
- 開いているタブグループをすべて解除する

## 動作概要

### 1. 重複タブを削除

- 現在のウィンドウ内のタブを走査します
- 同じ URL は先に見つかった 1 件だけ残します
- URL 比較では `#hash` を無視します
- `chrome://` と `chrome-extension://` は対象外です

例:

- `https://example.com/page#top`
- `https://example.com/page#comments`

上記 2 件は同じページとして扱われ、片方だけ残ります。

### 2. ドメインごとに整理

- 現在のウィンドウ内の通常タブを対象にします
- ルールに一致したサービスごとにタブをまとめます
- 既存のタブグループがある場合は、いったんすべて解除して再構成します
- ルールに一致しないタブは末尾に残します

### 3. 設定の保存

- `全ウィンドウを対象にする` の状態を保存します
- 標準ルールの有効 / 無効を保存します
- popup で追加したカスタムルールを保存します

### 4. カスタムルール

- popup から `Jira課題キー` `Google Doc ID` `Jira課題キー + Google Doc ID` `URLパターン` のルールを追加できます
- カスタムルールには任意のグループ名と色を付けられます
- `現在のJiraタブから取得` で、開いている Jira タブ URL から課題キーを抽出できます
- `現在のGoogleドキュメントタブから取得` で、開いている Google ドキュメント URL から Doc ID を抽出できます
- カスタムルールは JSON ファイルでインポート / エクスポートできます

Jira の使い方の例:

1. 親課題やエピックに属する Jira タブを複数開く
2. popup の `現在のJiraタブから取得` を押す
3. `グループ名` に `親課題A` や `Sprint 42` など任意名を入れる
4. `カスタムルールを追加` を押す
5. `ドメインごとに整理` を実行する

Google ドキュメントの使い方の例:

1. 関連する Google ドキュメント、スプレッドシート、スライドを複数開く
2. popup の `現在のGoogleドキュメントタブから取得` を押す
3. `グループ名` に `設計資料` や `週次レポート` など任意名を入れる
4. `カスタムルールを追加` を押す
5. `ドメインごとに整理` を実行する

## グループルール

| サービス | 判定パターン | グループカラー |
| --- | --- | --- |
| Confluence | `confluence.*`, `*.atlassian.net/wiki` | シアン |
| Jira | `jira.*`, `*.atlassian.net` | 青 |
| GitHub | `github.com` | 紫 |
| Slack | `app.slack.com` | 黄 |
| Notion | `notion.so` | グレー |
| Gemini | `gemini.google.com` | シアン |
| Google | `google.com`, `docs.google.com`, `drive.google.com` | 緑 |
| ChatGPT | `chatgpt.com`, `chat.openai.com` | シアン |
| Qiita | `qiita.com` | 緑 |
| Zenn | `zenn.dev` | 青 |
| Amazon | `amazon.co.jp`, `amazon.com`, `amzn.to` | オレンジ |
| YouTube | `youtube.com`, `youtu.be` | 赤 |

ルールの追加・変更方法は [docs/customization.md](docs/customization.md) にまとめています。

## インストール

Chrome Web Store に公開しなくてもローカルで読み込めます。

1. このリポジトリを取得します

```bash
git clone https://github.com/tonbiattack/chrome-tab-organizer.git
cd chrome-tab-organizer
```

2. Chrome で `chrome://extensions/` を開きます
3. 右上の `デベロッパーモード` を ON にします
4. `パッケージ化されていない拡張機能を読み込む` をクリックします
5. このリポジトリのフォルダを選択します
6. ツールバーから `Tab Organizer` を開きます

### 更新手順

ソースを変更したあとに `chrome://extensions/` でこの拡張の更新ボタンを押すと反映されます。

## 使い方

1. 整理したいタブが入っているウィンドウを開きます
2. ツールバーから `Tab Organizer` を開きます
3. 必要に応じて次のどちらかを実行します

- `重複タブを削除`
- `ドメインごとに整理`

popup では次も操作できます。

- `全ウィンドウを対象にする` の切り替え
- `重複タブを削除` `ドメインごとに整理` `グループをすべて解除` のショートカット表示
- 標準ルールの有効 / 無効
- Jira 課題キー / Google Doc ID / URL パターンによるカスタムルール追加
- 既存カスタムルールの有効 / 無効と削除
- カスタムルールのインポート / エクスポート
- `グループをすべて解除` による開いている全グループの解除

## プロジェクト構成

```text
.
├── manifest.json
├── popup.html
├── popup.js
├── src/
│   ├── group-rules.json
│   ├── popup-logic.mjs
│   ├── tab-organizer.js
│   └── tab-organizer.browser.js
├── tests/
│   ├── popup-logic.test.js
│   └── tab-organizer.test.js
├── scripts/
│   └── generate-icons.js
└── docs/
    ├── customization.md
    └── development.md
```

主要ファイル:

- `src/group-rules.json`: 標準グループルールの単一定義
- `src/popup-logic.mjs`: popup で使う純粋ロジック
- `src/tab-organizer.js`: テスト対象の CommonJS 実装
- `src/tab-organizer.browser.js`: popup から import するブラウザ向け ESM 実装
- `popup.js`: popup UI の初期化とボタン処理
- `popup.html`: popup UI とカスタムルール入力フォーム
- `tests/popup-logic.test.js`: popup ロジックのユニットテスト
- `tests/tab-organizer.test.js`: コアロジックのユニットテスト

## セットアップとテスト

```bash
npm install
npm test
```

カバレッジ確認:

```bash
npm run test:coverage
```

開発時の補足は [docs/development.md](docs/development.md) にまとめています。

## 権限

| 権限 | 用途 |
| --- | --- |
| `tabs` | タブ一覧の取得、移動、削除 |
| `tabGroups` | タブグループの作成と更新 |
| `storage` | popup 設定とカスタムルールの保存 |

## ショートカット

- `重複タブを削除`: `Alt+Shift+D`
- `ドメインごとに整理`: `Alt+Shift+G`
- `グループをすべて解除`: `Alt+Shift+U`

popup には現在のショートカット割り当てを表示します。Chrome 側で変更した場合も、再度 popup を開くと表示が追従します。

## ローカル利用時の補足

この拡張はタブ URL をローカルで読み取り、重複判定やグループ判定に使います。  
保存するのは次の設定だけです。

- `全ウィンドウを対象にする` の状態
- 標準ルールの有効 / 無効
- popup で追加したカスタムルール
- カスタムルールの import/export に使う JSON ファイルの内容

これらは `chrome.storage.local` に保存され、外部サーバーには送信しません。

## 制約と注意

- `chrome://` と `chrome-extension://` は整理対象から除外されます
- グループ化時は、ルール名と一致する既存グループだけを解除して再構成します
- `ドメインごとに整理` は、開いている既存グループをいったんすべて解除してから再グルーピングします
- `グループをすべて解除` は、開いているタブグループをすべて対象にします
- Jira の親子関係そのものは Jira API から自動取得していません。現時点では課題キー集合をユーザーが定義する方式です
- Google Doc ID は URL から抽出または手入力で指定します
- 会社管理の Chrome 環境では、未署名拡張の読み込みが制限されることがあります

## 今後の拡張候補

- Jira API と連携して親課題・エピック名を自動取得する
- ルールの並び順を UI から変更できるようにする
- ウィンドウ全体ではなく選択タブだけを対象にする

## ライセンス

MIT
