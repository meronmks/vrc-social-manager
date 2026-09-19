---
title: 認証とローカル保存
kind: security
status: verified
updated: 2026-09-19
sources:
  - ../../src-tauri/src/lib.rs
  - ../../src-tauri/src/commands.rs
  - ../../src/libs/userDataStore.ts
  - ../../src/components/ui/dialogs/login.tsx
---

# 認証とローカル保存

## 認証フロー

1. ログイン画面がユーザー名とパスワードを Rust の `login` コマンドへ渡す。
2. Rust は HTTP Basic 認証で VRChat の `/1/auth/user` を呼び出す。
3. 二要素認証が必要な場合、API 応答に応じてメール OTP または TOTP 入力へ進む。
4. OTP 検証後に現在ユーザーを取得し、ユーザー ID をキーとして CookieStore 全体を OS keyring に保存する。
5. 次回起動時は plugin-store の `current-user-id` を読み、そのユーザーの Cookie を keyring から復元する。
6. UI は `verify_auth_token` でセッションの有効性を確認してからユーザーデータを更新する。

根拠: [`src/components/ui/dialogs/login.tsx`](../../src/components/ui/dialogs/login.tsx)、
[`src-tauri/src/commands.rs`](../../src-tauri/src/commands.rs)、
[`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs)

## 保存場所と機密性

| データ | 保存手段 | 機密性・寿命 |
| --- | --- | --- |
| VRChat Cookie | OS keyring | 機密。アカウントのユーザー ID ごとに保存 |
| 現在のユーザー ID | `store.json` | Cookie 復元用の識別子 |
| ユーザー一覧・プロフィール応答 | `store.json` | 個人データ。複数アカウント切り替えに使用 |
| テーマ、言語、取得件数、更新確認設定 | `store.json` | 一般設定 |
| インスタンス表示データ | `store.json` | 一時キャッシュ。正常終了時に削除 |
| ワールド情報 | Rust のメモリ | プロセス終了までのキャッシュ |

`store.json` の保存処理は [`src/libs/userDataStore.ts`](../../src/libs/userDataStore.ts)、
Cookie の保存処理は [`src-tauri/src/lib.rs`](../../src-tauri/src/lib.rs) にあります。

## セキュリティ境界

- パスワードと OTP は認証要求にだけ利用し、アプリのストアへ永続化しない。
- Cookie の永続化には平文の plugin-store ではなく OS keyring を使う。
- VRChat API 通信は `https://api.vrchat.cloud/api` を基点とする。
- ログ、デバッグ出力、Knowledge Base へ認証情報や個人データを転記しない。
- アカウント切り替え時は現在の CookieStore をクリアし、選択したユーザーの keyring エントリを読み込む。

> [!WARNING]
> `login` コマンドは現在、デバッグログへユーザー名とパスワード引数を出力する形になっています。
> 実装上のセキュリティ上の懸念であり、認証関連を変更する際は機密値をログへ出さない方針で見直す必要があります。

根拠: [`src-tauri/src/commands.rs`](../../src-tauri/src/commands.rs)

## データ変更時の確認事項

- plugin-store に新しい個人データを追加する前に、本当に永続化が必要か確認する。
- Cookie やトークンは `store.json` に保存しない。
- ログへ API 応答全体を出す場合、個人情報や認証ヘッダーが含まれないか確認する。
- アカウント削除操作では、表示用ユーザー情報と keyring エントリの寿命が一致するか確認する。
- 保存形式を変える場合は、既存利用者向けの移行または安全なフォールバックを設計する。

## 関連ページ

- [アーキテクチャ](architecture.md)
- [開発とリリース](development-and-release.md)
