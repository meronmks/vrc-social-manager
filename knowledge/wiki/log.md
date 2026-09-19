---
title: Knowledge Base 作業ログ
kind: log
status: verified
updated: 2026-09-20
sources:
  - ../../README.md
  - ../../package.json
  - ../../src-tauri/Cargo.toml
  - ../../src/App.tsx
  - ../../src-tauri/src/lib.rs
---

# Knowledge Base 作業ログ

このファイルは追記専用です。既存エントリの変更、削除、並べ替えは行いません。

## [2026-09-19] maintenance | LLM Wiki の初期構築

- LLM Wiki の三層構造を、このリポジトリ向けに「一次情報」「不変の raw sources」「LLM 管理 Wiki」として定義。
- プロジェクト概要、アーキテクチャ、認証と保存、開発とリリースの初期ページを作成。
- エージェント向けの ingest、query、lint、更新条件をルートの `AGENTS.md` に追加。
- 調査対象: `README.md`、`package.json`、`src/`、`src-tauri/`、`.github/workflows/`。

## [2026-09-19] query | 認証情報のデバッグログ出力

- `login` がユーザー名とパスワードをデバッグログへ出力していたことを実装で確認し、値を出力しない形へ修正。
- 同じ認証フローにあったメール OTP と TOTP の値のログ出力も修正。
- 認証コマンドのログはコマンド名だけを記録し、機密値を含めない方針を明記。

## [2026-09-20] maintenance | GitHub Actions のリリース経路

- リリース PR のマージ処理から再利用可能な公開ワークフローを直接呼び出す構成へ変更。
- `GITHUB_TOKEN` によるタグ push が別ワークフローを起動しない制約と、手動タグ push の公開経路を記録。
- GitHub の自動生成リリースノートを GitHub Release と updater の `latest.json` で共用する方針を記録。
