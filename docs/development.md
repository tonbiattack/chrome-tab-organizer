# Development Notes

このドキュメントは、ローカルでこの Chrome 拡張を修正するときの前提をまとめたものです。

## 前提

- Manifest V3 の Chrome 拡張です
- popup UI から処理を実行します
- コアロジックはテストしやすいように UI から分離しています

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

- popup の初期化
- 現在ウィンドウのタブ数表示
- 実行結果のステータスメッセージ表示
- `GROUP_RULES` の凡例表示

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
- サービス判定
- 重複タブ削除
- タブ並び替えとグループ化
- ルール定義の整合性

## Chrome での確認手順

1. `chrome://extensions/` を開く
2. 対象拡張の更新ボタンを押す
3. popup を開く
4. `重複タブを削除` と `ドメインごとに整理` を確認する

## 変更時の注意点

- ルールを変える場合は CommonJS 版と ESM 版の両方を更新する
- popup で `import` を使うファイルは `type="module"` で読み込む必要がある
- `chrome://` と `chrome-extension://` は Chrome API 操作の対象外として扱っている
- グループ化処理では既存グループを解除してから再作成する仕様

## 改善余地

- `GROUP_RULES` の定義重複をビルドや生成で解消する
- popup UI のスクリーンショットを README に追加する
- 設定画面を追加してルールをコード外に逃がす
