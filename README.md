# PNGinfo Viewer Chrome Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0-blue.svg)](https://github.com/sunadarake/chrome-pnginfo-viewer)

PNG画像のメタデータ（PNGinfo）を簡単に閲覧できるChrome拡張機能。

AI生成画像のプロンプト情報やその他の埋め込みデータを確認できる。

### インストール方法

1. このリポジトリをクローンまたはダウンロード
   ```bash
   git clone https://github.com/sunadarake/chrome-pnginfo-viewer.git
   cd chrome-pnginfo-viewer
   ```

2. Chromeで `chrome://extensions/` にアクセス

3. 右上の「デベロッパーモード」を有効化

4. 「パッケージ化されていない拡張機能を読み込む」をクリック

5. ダウンロードしたフォルダを選択

6. 拡張機能一覧に「PNGinfo Viewer」が表示されれば完了

## 使い方

1. Chromeツールバーの「PNGinfo Viewer」アイコンをクリック
2. 新しいタブでPNGinfo Viewerが開かれる
3. PNG画像をドラッグ&ドロップするか、「ファイルを選択」ボタンで画像を選択
4. 自動的に解析が開始され、メタデータが表示される

## 技術スタック
- JavaScript: ES2015、Manifest V3
- HTML5
- CSS3

## ライセンス

MIT License

