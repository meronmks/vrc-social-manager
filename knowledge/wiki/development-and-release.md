---
title: 開発とリリース
kind: operations
status: verified
updated: 2026-09-20
sources:
  - ../../README.md
  - ../../package.json
  - ../../scripts/lint.js
  - ../../src-tauri/Cargo.toml
  - ../../.github/workflows/pr-check.yml
  - ../../.github/workflows/bump-version.yml
  - ../../.github/workflows/publish.yml
  - ../../.github/workflows/release-pr.yml
---

# 開発とリリース

## 必要な環境

- Node.js
- pnpm
- Rust toolchain
- Tauri 2 のビルドに必要な OS 別依存関係

依存パッケージの定義は [`package.json`](../../package.json) と
[`src-tauri/Cargo.toml`](../../src-tauri/Cargo.toml) にあります。

## よく使うコマンド

```bash
# 依存関係
pnpm install

# フロントエンド開発サーバー
pnpm run dev

# Tauri 開発実行
pnpm run tauri dev

# TypeScript 検査
pnpm run lint

# フロントエンドの本番ビルド
pnpm run build:vite

# Rust の検査
cargo check --manifest-path src-tauri/Cargo.toml

# アプリの本番ビルド
pnpm run tauri build
```

`pnpm run dev` と `pnpm run build` は、ライセンス情報の収集も実行します。
正確なスクリプト定義は [`package.json`](../../package.json) を参照してください。

## 型生成

Rust の Tauri コマンドは `tauri-specta` から [`src/bindings.ts`](../../src/bindings.ts) へ型を生成します。
生成はデスクトップのデバッグ構成で `run()` から呼ばれるため、次の規則を守ります。

- `src/bindings.ts` を手動編集しない。
- コマンド追加時は `commands.rs` の `handlers()` と `export_ts()` の登録をそろえる。
- 生成後に TypeScript 検査を実行し、UI 側の呼び出しを更新する。

根拠: [`src-tauri/src/commands.rs`](../../src-tauri/src/commands.rs)、
[`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs)

## 国際化

画面に追加するユーザー向け文言は、原則として
[`src/locales/ja.json`](../../src/locales/ja.json) と
[`src/locales/en.json`](../../src/locales/en.json) の両方へ追加します。
初期言語と永続化は `i18next` と plugin-store が扱います。

## CI とリリース

`.github/workflows/` には、PR 検査、バージョン更新、公開、リリース PR のワークフローがあります。
アプリは Tauri updater を組み込み、起動時設定が有効な場合に更新の有無を確認します。

リリースは次の順序で行います。

1. `bump-version.yml` を手動実行し、バージョン更新を含む `release/v*` ブランチと PR を作成する。
2. リリース PR を `main` へマージすると、`release-pr.yml` がマージコミットへタグを付ける。
3. `release-pr.yml` から再利用可能な `publish.yml` を直接呼び出し、3 OS 向け成果物と updater 用の
   `latest.json` をドラフトリリースへ追加する。
4. リリース本文と `latest.json` の `notes` には、GitHub の自動生成リリースノートを使用する。

`GITHUB_TOKEN` で push したタグは別の workflow run を開始しないため、リリース PR 経由では
タグ push イベントに依存せず `workflow_call` を使用します。人がタグを push した場合は、従来どおり
`publish.yml` のタグトリガーから同じ公開処理を実行できます。

公開やバージョン変更に手を入れる際は、少なくとも次を一緒に確認します。

- `package.json` と `src-tauri/tauri.conf.json` のバージョン
- Cargo のパッケージ／ロック情報
- updater の署名・endpoint 設定
- `CHANGELOG.md` と GitHub Release の生成処理
- 対象 OS ごとのビルド成果物

根拠: [`.github/workflows/`](../../.github/workflows/)、
[`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json)、
[`src/App.tsx`](../../src/App.tsx)

## 変更時の最小検証

| 変更 | 最小検証 |
| --- | --- |
| React / TypeScript | `pnpm run lint` |
| UI の構成・依存関係 | `pnpm run lint`、`pnpm run build:vite` |
| Rust | `cargo check --manifest-path src-tauri/Cargo.toml` |
| IPC シグネチャ | binding 再生成、TypeScript 検査、Cargo 検査 |
| 翻訳 | 日英キーの対応と対象画面の確認 |
| Knowledge Base | 相対リンク、索引、frontmatter、ログ |

## 関連ページ

- [プロジェクト概要](project-overview.md)
- [アーキテクチャ](architecture.md)
- [認証とローカル保存](authentication-and-storage.md)
