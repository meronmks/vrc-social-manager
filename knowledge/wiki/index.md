---
title: Knowledge Base 索引
kind: index
status: verified
updated: 2026-11-20
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
- [認証とローカル保存](authentication-and-storage.md) — ログイン、アカウント別のCookie保管、旧プロフィールの移行、画面に許可する操作と認証ログの範囲。
- [開発とリリース](development-and-release.md) — 開発コマンド、型生成、品質確認、更新配布の概要。
- [リリース手順書](release-procedure.md) — バージョン選択、リリース PR、ドラフト確認、公開、ベータ参加と解除、失敗時の復旧手順。

## UI設計

- [フレンド確認と合流のUI仕様草案](friend-ui-spec.md) — 実装したホーム、初回ログイン、ユーザーアイコン、全フレンド表示とオンライン人数、任意のステータステキスト、お気に入りグループの設定名・標準名と初期選択、インスタンス一覧の折りたたみ式の絞り込み・フレンド人数順・アイコンと主催種別、所属グループからの検索、ログアウト後のアカウント切り替え、保存済みログインIDの有無に応じた再ログイン、更新失敗時の復旧、全フレンド検索中の表示、ワールド名・サムネイルの先行取得、インスタンスからのフレンド詳細とWebプロフィール表示、自己招待の送信結果と手動再送、設定画面の配置、サードパーティライセンスの閲覧、フレンド取得件数の変更、アプリ終了まで保持するアカウント別の通知履歴。 [新UIの画面定義](friend-ui-spec.md#新uiの画面定義)からAltPenの設計ファイルを参照できる。

## 運用

- [作業ログ](log.md) — ingest、query、lint、maintenance の時系列記録。追記専用。
- [ページテンプレート](templates/page.md) — 新規 Wiki ページの frontmatter と本文構成。

## Raw sources

現在、外部資料の取り込みはありません。配置規則は [`../raw/README.md`](../raw/README.md) を参照してください。
