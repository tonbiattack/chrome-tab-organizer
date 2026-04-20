# Customization Guide

この拡張のグループ判定ルールは [src/tab-organizer.js](../src/tab-organizer.js) と [src/tab-organizer.browser.js](../src/tab-organizer.browser.js) の `GROUP_RULES` で管理しています。

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

## 新しいサービスを追加する

例として Figma を追加する場合:

```js
{ name: "Figma", color: "pink", patterns: [/figma\.com/i] }
```

追加場所:

1. `src/tab-organizer.js` の `GROUP_RULES`
2. `src/tab-organizer.browser.js` の `GROUP_RULES`

このプロジェクトではテスト用の CommonJS 実装と、popup 用の ESM 実装を分けているため、両方を更新する必要があります。

## 色の候補

popup 側では次の色名に対応しています。

- `blue`
- `purple`
- `yellow`
- `grey`
- `green`
- `teal`
- `red`
- `orange`
- `pink`
- `cyan`

未定義の色名を指定した場合、popup の凡例表示ではフォールバック色が使われます。

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
3. popup のルール一覧に反映されていることを確認する
4. 対象サイトのタブで `ドメインごとに整理` を実行する

## 補足

重複判定ロジックは `GROUP_RULES` とは別で、`normalizeUrl()` により URL のハッシュだけを除去して比較しています。  
クエリパラメータは保持されるため、`?page=1` と `?page=2` は別タブとして扱われます。
