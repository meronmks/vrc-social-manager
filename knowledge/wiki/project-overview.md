---
title: プロジェクト概要
kind: overview
status: verified
updated: 2026-09-19
sources:
  - ../../README.md
  - ../../package.json
  - ../../src/App.tsx
  - ../../src/screens/friendScreen.tsx
---

# プロジェクト概要

## 目的

VRC Social Manager は、VRChat のフレンドと、そのフレンドがいるインスタンスを確認するための
非公式デスクトップアプリケーションです。管理操作そのものより、ソーシャル状況の把握と参加補助を目的とします。
公式アプリではなく、VRChat API の仕様変更による影響を受けます。

根拠: [`README.md`](../../README.md)

## 現在の主要機能

- VRChat アカウントへのログインと TOTP／メール OTP による二要素認証
- オンライン・オフラインのフレンド取得とインスタンス単位の集約
- ワールド、インスタンス、ユーザー、グループ情報の表示
- 対象インスタンスへ自分を招待する操作
- 複数 VRChat アカウントの切り替え
- 日本語・英語の UI、ライト／ダークテーマ
- デスクトップ版の自動更新とリリースノート表示

根拠: [`README.md`](../../README.md)、[`src/screens/friendScreen.tsx`](../../src/screens/friendScreen.tsx)、
[`src-tauri/src/commands.rs`](../../src-tauri/src/commands.rs)

## 技術スタック

| 領域 | 採用技術 | 役割 |
| --- | --- | --- |
| デスクトップ基盤 | Tauri 2 | Web UI とネイティブ機能の統合、配布 |
| UI | React 19 / TypeScript / Vite | 画面、状態、操作フロー |
| スタイル | Tailwind CSS 4 / DaisyUI 5 | レイアウトとテーマ |
| バックエンド | Rust / Tokio / reqwest | VRChat API、Cookie、OS 機能との連携 |
| IPC 型共有 | tauri-specta / Specta | Rust コマンドから TypeScript binding を生成 |
| ローカル設定 | tauri-plugin-store | テーマ、言語、ユーザー情報などの保存 |
| 秘密情報 | OS keyring | アカウント別の認証 Cookie 保存 |
| 国際化 | i18next | 日本語・英語リソースの切り替え |

根拠: [`package.json`](../../package.json)、[`src-tauri/Cargo.toml`](../../src-tauri/Cargo.toml)

## 主要な責任範囲

- `src/`: UI、表示用データの組み立て、設定、画面内状態。
- `src-tauri/src/`: API 通信、認証セッション、ネイティブ機能、IPC コマンド。
- `src/locales/`: 日本語・英語の翻訳リソース。
- `scripts/`: ライセンス収集、変更履歴生成、TypeScript 検査。
- `.github/workflows/`: PR 検査、バージョン更新、公開、リリース PR。
- `design/`: UI デザイン資料。
- `knowledge/`: LLM が継続保守する開発知識。

## 関連ページ

- [アーキテクチャ](architecture.md)
- [認証とローカル保存](authentication-and-storage.md)
- [開発とリリース](development-and-release.md)
