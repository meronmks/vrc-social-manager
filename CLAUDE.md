# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発コマンド

### 基本的な開発フロー
```bash
# 開発サーバー起動（フロントエンドとTauriアプリの開発モード）
npm run tauri dev

# プロダクションビルド
npm run tauri build

# フロントエンドのみの開発サーバー（Viteのみ）
npm run dev

# フロントエンドのみのビルド
npm run build

# TypeScriptの型チェック（lintの代用）
npm run lint
```

### その他のコマンド
```bash
# ライセンス情報収集（ビルド時に自動実行される）
npm run collect-licenses

# Viteプレビュー
npm run preview
```

## プロジェクト構成

### 技術スタック
- **Tauri 2.0**: デスクトップアプリケーションフレームワーク
- **React 19**: フロントエンドUI
- **TypeScript**: 型安全性確保
- **Rust**: バックエンド処理とAPI通信
- **Vite**: ビルドツール
- **TailwindCSS + DaisyUI**: スタイリング

### アーキテクチャ概要

#### フロントエンド (src/)
- `App.tsx`: メインアプリケーションコンポーネント
- `screens/`: 画面コンポーネント（友達、設定、デバッグ画面）
- `components/ui/`: 再利用可能なUIコンポーネント
- `components/ui/dialogs/`: ダイアログコンポーネント群
- `libs/`: ユーティリティライブラリ（i18n、ログ、ストア管理）
- `locales/`: 多言語対応ファイル（日本語・英語）

#### バックエンド (src-tauri/src/)
- `main.rs`: エントリーポイント
- `lib.rs`: Tauriアプリケーションの初期化とCookie管理
- `commands.rs`: VRChat API呼び出しとフロントエンド連携のTauriコマンド
- `structs.rs`: データ構造定義

### 重要な設計パターン

#### API通信
- VRChat APIとの通信はRustバックエンドで実装
- Cookie管理とセッション維持はOSのセキュアストアを利用
- 認証フロー（2FA、OTP）は`commands.rs`で実装

#### 状態管理
- アプリケーション状態は`tauri-plugin-store`を使用
- ユーザーデータは`userDataStore.ts`で管理
- Cookie情報はOSのKeyring APIで暗号化保存

#### 多言語対応
- i18nextを使用した国際化対応
- 日本語がデフォルト、英語サポート
- ロケールファイルは`src/locales/`に配置

### 開発時の注意事項

#### TypeScript型生成
- Rustの`tauri-specta`により型安全なIPC通信を実現
- `src/bindings.ts`は自動生成されるため手動編集不可
- デバッグモードでのみTypeScript型定義をエクスポート

#### セキュリティ
- VRChat認証情報はOSのセキュアストア（Keyring）で管理
- Cookie情報は暗号化して保存
- API通信はHTTPS必須

#### ビルドプロセス
- ライセンス情報は`scripts/collect-licenses.js`で自動収集
- Tauriのバンドル設定で複数プラットフォーム対応（Windows、macOS、Linux）
- 自動アップデート機能内蔵

### コード規約
- TypeScriptのstrictモード有効
- Rustは2021エディション使用
- ログレベルはデバッグビルドでDebug、リリースビルドでInfo
- コメントは日本語で記述（技術仕様等は英語併記可）