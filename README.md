# Chrome Tab Organizer

重複タブの削除と、サービス単位のタブ整理をワンクリックで行う Chrome 拡張です。  
現在のウィンドウ内のタブを対象に、同一 URL の整理と Jira / GitHub / Slack などのグルーピングを行います。

## できること

- 重複タブを削除する
- サービスごとにタブを並び替えてグループ化する
- popup から現在のルール一覧を確認する

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
- 既存のタブグループがある場合はいったん解除して作り直します
- ルールに一致しないタブは末尾に残します

## グループルール

| サービス | 判定パターン | グループカラー |
| --- | --- | --- |
| Jira | `jira.*`, `*.atlassian.net` | 青 |
| GitHub | `github.com` | 紫 |
| Slack | `app.slack.com` | 黄 |
| Notion | `notion.so` | グレー |
| Google | `google.com`, `docs.google.com`, `drive.google.com` | 緑 |
| ChatGPT | `chatgpt.com`, `chat.openai.com` | シアン |
| Qiita | `qiita.com` | 緑 |
| Zenn | `zenn.dev` | 青 |
| Amazon | `amazon.co.jp`, `amazon.com`, `amzn.to` | オレンジ |

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

popup 下部には、現在有効なグループルールが一覧表示されます。

## プロジェクト構成

```text
.
├── manifest.json
├── popup.html
├── popup.js
├── background.js
├── src/
│   ├── tab-organizer.js
│   └── tab-organizer.browser.js
├── tests/
│   └── tab-organizer.test.js
├── scripts/
│   └── generate-icons.js
└── docs/
    ├── customization.md
    └── development.md
```

主要ファイル:

- `src/tab-organizer.js`: テスト対象の CommonJS 実装
- `src/tab-organizer.browser.js`: popup から import するブラウザ向け ESM 実装
- `popup.js`: popup UI の初期化とボタン処理
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

## 制約と注意

- 対象は現在のウィンドウだけです
- `chrome://` と `chrome-extension://` は整理対象から除外されます
- グループ化時は既存のタブグループを解除して再構成します
- 会社管理の Chrome 環境では、未署名拡張の読み込みが制限されることがあります

## 今後の拡張候補

- ユーザー設定画面でルールを編集できるようにする
- ルールの並び順を UI から変更できるようにする
- ウィンドウ全体ではなく選択タブだけを対象にする

## ライセンス

MIT
