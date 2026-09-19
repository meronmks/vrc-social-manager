---
title: アーキテクチャ
kind: architecture
status: verified
updated: 2026-09-19
sources:
  - ../../src/App.tsx
  - ../../src/screens/friendScreen.tsx
  - ../../src/bindings.ts
  - ../../src-tauri/src/commands.rs
  - ../../src-tauri/src/lib.rs
---

# アーキテクチャ

## 全体像

```text
React 画面・コンポーネント
        │ 型付き commands 呼び出し
        ▼
src/bindings.ts（tauri-specta 生成物）
        │ Tauri IPC
        ▼
Rust commands.rs
        │ reqwest + 共有 CookieStore
        ▼
VRChat API

React ── tauri-plugin-store ── ローカル設定・表示キャッシュ
Rust  ── OS keyring ────────── アカウント別 Cookie
```

フロントエンドは画面表示とユーザー操作を担当し、VRChat API 呼び出しは Rust 側へ集約されています。
IPC の TypeScript 側インターフェースは `tauri-specta` が生成します。

根拠: [`src/bindings.ts`](../../src/bindings.ts)、[`src-tauri/src/commands.rs`](../../src-tauri/src/commands.rs)

## フロントエンド

[`src/App.tsx`](../../src/App.tsx) がアプリ共通のダイアログ、Toast、ルーターを構成します。
通常ルートはフレンド画面と設定画面で、デバッグ画面は開発ビルドだけに公開されます。
起動時にはテーマを復元し、設定が有効なら Tauri updater で更新を確認します。

[`src/screens/friendScreen.tsx`](../../src/screens/friendScreen.tsx) は現在の中心画面です。主に次を担います。

- 保存済みユーザーと前回の表示データの復元
- 認証トークンの検証
- グループインスタンス、オンライン／オフラインフレンドのページング取得
- フレンドを location ごとにまとめたインスタンス表示データの構築
- 検索、グループ絞り込み、表示順制御
- 多重取得を避けるための `AbortController` 管理

UI コンポーネントは `src/components/ui/`、共有の表示用型は
[`src/libs/exportInterfaces.tsx`](../../src/libs/exportInterfaces.tsx) にあります。

## IPC と Rust バックエンド

[`src-tauri/src/commands.rs`](../../src-tauri/src/commands.rs) の `handlers()` が公開コマンドを登録します。
主な分類は次の通りです。

- 認証: `login`、`email_otp`、`two_factor_auth`、`verify_auth_token`
- ユーザー: `get_current_user_info`、`get_current_user_friends`、`get_user_by_id`
- ワールド／インスタンス: `get_world_by_id`、`get_instance`、`invite_myself_to_instance`
- グループ／お気に入り: `get_group_by_id`、`get_user_group_instances`、`get_favorites_user_instances`
- アプリ補助: `get_licenses`、`get_release_note`、`debug_api_request`

コマンドの戻り値は `tauri-specta` によって TypeScript の `Result` と型へ変換されます。
Rust エラーは現在 `RustError::Unrecoverable` に集約され、UI が翻訳キーまたはメッセージを扱います。

## キャッシュ

Rust 側の `APP_STATE` は取得済みワールド情報をプロセス内で保持し、同じワールドへの API 呼び出しを減らします。
フロントエンド側では、画面再表示用のインスタンス情報を plugin-store へ一時保存します。
アプリ終了時に `instances-data` は削除されます。

根拠: [`src-tauri/src/structs.rs`](../../src-tauri/src/structs.rs)、
[`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs)、
[`src/libs/userDataStore.ts`](../../src/libs/userDataStore.ts)

## 変更時の注意

- Rust コマンドの追加・シグネチャ変更時は、`handlers()` と開発時の `export_ts()` の両方へ反映する。
- `src/bindings.ts` は直接変更せず、開発ビルドによる生成結果を使う。
- API レスポンス型は UI 用型と Rust の内部キャッシュ型が別に存在するため、変更の伝播範囲を確認する。
- モバイルとデスクトップで updater の利用可否が異なる。デスクトップ限定処理は cfg 条件を保つ。

## 関連ページ

- [プロジェクト概要](project-overview.md)
- [認証とローカル保存](authentication-and-storage.md)
- [開発とリリース](development-and-release.md)
