---
title: Knowledge Base 索引
kind: index
status: verified
updated: 2026-09-19
sources:
  - ../../README.md
  - ../../package.json
  - ../../src-tauri/Cargo.toml
---

# Knowledge Base 索引

VRC Social Manager の実装・運用知識への入口です。回答や設計の際は、関連ページを読んだ後に
リンク先のコードと設定で現在の状態を確認してください。

## プロジェクト

- [プロジェクト概要](project-overview.md) — 目的、主要機能、技術スタック、責任範囲の要約。
- [アーキテクチャ](architecture.md) — React/Tauri/Rust 間の境界、IPC、主要なデータフロー。
- [認証とローカル保存](authentication-and-storage.md) — VRChat 認証、Cookie、設定・キャッシュの保存方式、機密値を含むログの禁止方針。
- [開発とリリース](development-and-release.md) — 開発コマンド、型生成、品質確認、更新配布の概要。

## 運用

- [作業ログ](log.md) — ingest、query、lint、maintenance の時系列記録。追記専用。
- [ページテンプレート](templates/page.md) — 新規 Wiki ページの frontmatter と本文構成。

## Raw sources

現在、外部資料の取り込みはありません。配置規則は [`../raw/README.md`](../raw/README.md) を参照してください。
