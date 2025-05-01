# VRC Social Manager

VRChatのフレンドやインスタンス情報を確認するためのデスクトップアプリケーションです。
マネージャと銘打ってますが、管理するというよりは補佐の意味合いが強いです。

## 免責事項
- このアプリケーションは、VRChatの公式アプリケーションではありません。
- VRChat APIを利用する関係上、VRChatのアカウント情報を必要とし、認証のために利用します。
- VRChatのAPIの仕様変更により、アプリケーションが正常に動作しなくなる可能性があります。
- このアプリケーションを使用することで発生したいかなる損害についても、開発者は責任を負いません。あくまで自己責任でご利用ください。

## 主な機能

- VRChatアカウントでのログイン（2FAサポート）
- フレンドロケーションの表示
- インスタンス情報の詳細表示
- 自分へのインスタンス招待機能
- 多言語対応（日本語/英語）
- ダークモード/ライトモードの切り替え
- 自動アップデート機能

## 開発環境のセットアップ

### 必要条件

- [Node.js](https://nodejs.org/) (LTS推奨)
- [Rust](https://www.rust-lang.org/)
- [Tauri](https://tauri.app/)
- [VS Code](https://code.visualstudio.com/) (推奨)

### 推奨VS Code拡張機能

- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/vrc-social-manager.git
cd vrc-social-manager

# 依存関係のインストール
npm install
```

### 開発用サーバーの起動

```bash
npm run tauri dev
```

### ビルド

```bash
npm run tauri build
```

## 技術スタック

- [Tauri](https://tauri.app/) - デスクトップアプリケーションフレームワーク
- [React](https://react.dev/) - UIフレームワーク
- [TypeScript](https://www.typescriptlang.org/) - 型安全な JavaScript
- [Rust](https://www.rust-lang.org/) - バックエンド処理
- [Vite](https://vitejs.dev/) - ビルドツール
- [TailwindCSS](https://tailwindcss.com/) - スタイリング
- [DaisyUI](https://daisyui.com/) - UIコンポーネント

その他利用しているものについては、`package.json`や`Cargo.toml`を参照してください。

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルを参照してください。
