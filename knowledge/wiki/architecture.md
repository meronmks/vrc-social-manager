---
title: アーキテクチャ
kind: architecture
status: verified
updated: 2026-11-19
sources:
  - ../../src/App.tsx
  - ../../src/screens/friendScreen.tsx
  - ../../src/libs/useSocialData.ts
  - ../../src-tauri/src/social.rs
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
Rust commands.rs / social.rs
        │ reqwest + アカウント単位の CookieStore
        ▼
VRChat API

React ── 用途別の IPC ── Rust / tauri-plugin-store ── ローカル設定・登録アカウント
Rust  ── OS keyring ────────── アカウント別 Cookie
```

フロントエンドは画面表示とユーザー操作を担当し、VRChat API 呼び出しは Rust 側へ集約されています。
IPC の TypeScript 側インターフェースは `tauri-specta` が生成します。

根拠: [`src/bindings.ts`](../../src/bindings.ts)、[`src-tauri/src/commands.rs`](../../src-tauri/src/commands.rs)

## フロントエンド

[`src/App.tsx`](../../src/App.tsx) がアプリ共通のダイアログ、Toast、ルーターを構成します。
通常ルートはお気に入り・インスタンス・設定で、デバッグ画面は開発ビルドだけに公開されます。
起動時にはテーマを復元し、設定が有効なら Tauri updater で更新を確認します。

[`src/screens/friendScreen.tsx`](../../src/screens/friendScreen.tsx) は現在の中心画面です。主に次を担います。

- アカウントのお気に入りと全フレンド検索、取得状況の表示
- 所属グループやフレンドの現在地によるインスタンスの分類
- 個別の現在地の再取得、プロフィール表示、自己招待

一覧の取得・ページング・手動更新は [useSocialData](../../src/libs/useSocialData.ts)、アカウント操作と通知履歴は [App](../../src/App.tsx) が担当する。

UI コンポーネントは `src/components/ui/`、共有の表示用型は
[`src/libs/exportInterfaces.tsx`](../../src/libs/exportInterfaces.tsx) にあります。

## IPC と Rust バックエンド

[`src-tauri/src/commands.rs`](../../src-tauri/src/commands.rs) の `handlers()` が公開コマンドを登録します。
主な分類は次の通りです。

- ログイン・二要素認証・切り替え・ログアウトは `social_login`、`social_otp`、`social_cancel`、`social_switch`、`social_logout` を使う。
- フレンド・グループ・インスタンスの取得と自己招待は、アカウントを指定する `social_request` を使う。
- `settings_get` は登録一覧と設定を参照し、`settings_set` は書き込みが許可された設定値を検証して保存する。[設定操作](../../src-tauri/src/preferences.rs)
- ライセンス表示と更新内容の取得には `get_licenses` と `get_release_note` を使う。汎用の `debug_api_request` とデバッグ画面用の取得コマンドは開発時に限定する。

コマンドの戻り値は `tauri-specta` によって TypeScript の `Result` と型へ変換されます。
通常画面の `social_*` コマンドは認証切れ・HTTP応答・通信失敗・保存失敗を区別する。従来のコマンドのエラーは `RustError::Unrecoverable` に集約され、UI が翻訳キーまたはメッセージを扱います。

## キャッシュ

Rust 側の `APP_STATE` は取得済みワールド情報をプロセス内で保持し、同じワールドへの API 呼び出しを減らします。
新しいホームは、フレンド一覧のページを受け取るたびに、ワールドIDごとの名前・画像と、場所ごとのインスタンス詳細を並行して読み始めます。同じ更新中は各IDを一度だけ一覧用に取得し、結果を使用中のアカウントの画面メモリに保持します。公開プロフィールは、そのフレンドのプロフィールを開いた時点で取得します。[一覧の取得処理](../../src/libs/useSocialData.ts)・[通常画面のAPI](../../src-tauri/src/social.rs)旧版の `instances-data` は復元しません。

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
