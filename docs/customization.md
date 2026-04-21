# Customization Guide

この拡張では、標準ルールとカスタムルールの 2 種類を使えます。

- 標準ルール: [src/group-rules.json](../src/group-rules.json)
- カスタムルール: popup から追加し、`chrome.storage.local` に保存

通常の利用では popup からカスタムルールを追加するだけで十分です。コード編集は、標準ルールそのものを増やしたいときだけ必要です。

## popup から追加できるルール

カスタムルールは 1 つのフォームで定義します。`Jira課題キー` `Google Doc ID` `URLパターン` の 3 つを任意に組み合わせられ、1 件以上入っていれば保存できます。

入力できる内容:

- `グループ名`: タブグループ名
- `グループ色`: Chrome タブグループ色
- `Jira課題キー`: `PROJ-101` のようなキーの一覧
- `Google Doc ID`: Google ドキュメント、スプレッドシート、スライド、フォーム、図形描画の ID 一覧
- `URLパターン`: 正規表現の一覧

Jira 課題キーは次のような URL にマッチします。

- `https://company.atlassian.net/browse/PROJ-101`
- `https://company.atlassian.net/jira/software/...?...&selectedIssue=PROJ-101`

Google Doc ID は次のような URL にマッチします。

- `https://docs.google.com/document/d/<doc-id>/edit`
- `https://docs.google.com/spreadsheets/d/<doc-id>/edit`
- `https://docs.google.com/presentation/d/<doc-id>/edit`

Google Doc ID を複数指定する書き方:

- カンマ区切り: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms, 1Q2w3E4r5T6y7U8i9O0pAaBbCcDdEeFfGgHhIiJj`
- 改行区切り:
  `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`
  `1Q2w3E4r5T6y7U8i9O0pAaBbCcDdEeFfGgHhIiJj`

URL パターンは正規表現をカンマ区切りまたは改行区切りで指定します。

例:

- `figma\.com`
- `miro\.com`
- `docs\.company\.example`

URLパターンを複数指定する書き方:

- カンマ区切り: `figma\.com, miro\.com, docs\.company\.example`
- 改行区切り:
  `figma\.com`
  `miro\.com`
  `docs\.company\.example`

使い方の例:

1. 親課題や関連ドキュメントのタブを開く
2. popup の `現在のJiraタブから取得` や `現在のGoogleドキュメントタブから取得` を必要に応じて使う
3. `グループ名` に `親課題A` や `Sprint 42` を入れる
4. 必要なら `URLパターン` に Figma や Miro など追加でまとめたい条件を書く
5. `カスタムルールを追加` を押す

## ルールの構造

各ルールは次の形です。

```js
{
  name: "GitHub",
  color: "purple",
  patterns: [/github\.com/i]
}
```

項目の意味:

- `name`: タブグループ名として表示される文字列
- `color`: Chrome のタブグループ色
- `patterns`: URL に対して評価する正規表現の配列
- `issueKeys`: Jira 課題キーの配列
- `docIds`: Google ドキュメント ID の配列

## コードで標準ルールを追加する

例として Figma を追加する場合:

```js
{ name: "Figma", color: "pink", patterns: [/figma\.com/i] }
```

追加場所:

1. `src/group-rules.json` にルールを追加する

標準ルールは JSON を単一のソースとして持ち、Node 側と browser 側で `RegExp` に変換しています。

## 現在の標準ルール一覧

| サービス | パターン | 色 |
| --- | --- | --- |
| Confluence | `confluence.*`, `atlassian.net/wiki` | cyan |
| Jira | `jira.*`, `atlassian.net` | blue |
| GitHub | `github.com` | purple |
| Slack | `app.slack.com` | yellow |
| Notion | `notion.so` | grey |
| Gemini | `gemini.google.com` | cyan |
| Google | `google.com`, `docs.google.com`, `drive.google.com` | green |
| ChatGPT | `chatgpt.com`, `chat.openai.com` | cyan |
| Qiita | `qiita.com` | green |
| Zenn | `zenn.dev` | blue |
| Amazon | `amazon.co.jp`, `amazon.com`, `amzn.to` | orange |
| YouTube | `youtube.com`, `youtu.be` | red |

## 色の候補

Chrome のタブグループが受け付ける色名は次のとおりです。

- `blue`
- `cyan`
- `green`
- `grey`
- `orange`
- `pink`
- `purple`
- `red`
- `yellow`

`teal` は Chrome API では使えないため指定しないでください。未定義の色名を指定した場合、popup の凡例表示ではフォールバック色が使われます。

## 正規表現を書くときの注意

- ドメイン判定だけなら大文字小文字を無視する `i` フラグを付ける
- 必要以上に広いパターンにしない
- サブドメインも拾いたいときは `jira\.` や `atlassian\.net` のように書く

例:

- `/github\.com/i`
- `/app\.slack\.com/i`
- `/atlassian\.net/i`

## 変更後の確認

1. `npm test` を実行する
2. Chrome 拡張を再読み込みする
3. popup の `標準ルール` または `カスタムルール` 一覧に反映されていることを確認する
4. 対象サイトのタブで `ドメインごとに整理` を実行する

## 補足

重複判定ロジックは `GROUP_RULES` とは別で、`normalizeUrl()` により URL のハッシュだけを除去して比較しています。  
クエリパラメータは保持されるため、`?page=1` と `?page=2` は別タブとして扱われます。

カスタムルールは popup から削除・無効化できます。保存先は `chrome.storage.local` なので、拡張を再読み込みしても残ります。

カスタムルールは JSON ファイルとしてエクスポートし、別の環境へインポートできます。対象はカスタムルールのみで、標準ルールの有効 / 無効状態は含みません。

`グループをすべて解除` ボタンは、標準ルール名またはカスタムルール名と一致するタイトルのタブグループだけを解除します。`全ウィンドウを対象にする` が ON の場合は全ウィンドウが対象になります。

手動で作ったグループでも、タイトルがルール名と一致している場合は管理対象とみなされます。逆に、タイトルが一致しない手動グループには触れません。
