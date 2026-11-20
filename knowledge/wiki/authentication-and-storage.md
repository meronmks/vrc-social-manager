---
title: 認証とローカル保存
kind: security
status: verified
updated: 2026-11-19
sources:
  - ../../src-tauri/src/lib.rs
  - ../../src-tauri/src/commands.rs
  - ../../src/libs/userDataStore.ts
  - ../../src/components/ui/sessionForm.tsx
  - ../../src-tauri/src/social.rs
  - ../../src-tauri/src/account_migration.rs
  - ../../src-tauri/tauri.conf.json
  - ../../src-tauri/src/preferences.rs
  - ../../src-tauri/Cargo.toml
---

# 認証とローカル保存

## 認証フロー

1. 登録を選ぶと、専用のCookieStoreにそのユーザーの認証情報を復元し、現在ユーザーのIDを確認する。通信失敗時も登録を保持する。
2. 追加・再ログインは独立したクライアントで開始し、必要に応じてメールまたは認証アプリのコードを検証する。再ログインは元のユーザーIDとの一致が必要。
3. 認証に成功してから、OSのkeyringと登録一覧を更新し、使用中のクライアントを切り替える。ログアウトでは端末の登録と、該当アカウントのkeyringエントリを削除する。

[再ログイン画面](../../src/components/ui/sessionForm.tsx)・[セッションの確定と切り替え](../../src-tauri/src/social.rs)

## 保存場所と機密性

| データ | 保存手段 | 機密性・寿命 |
| --- | --- | --- |
| VRChat Cookie | OS keyring | 機密。アカウントのユーザー ID ごとに保存 |
| 現在のユーザー ID | `store.json` | Cookie 復元用の識別子 |
| 登録ID・表示名・アイコン候補のURL・ログインID・最終使用日時 | `store.json` | 暗号化していないJSON。ログインIDは入力したユーザー名またはメールアドレス。複数アカウント切り替えに使用 |
| テーマ、言語、取得件数、更新確認設定 | `store.json` | 一般設定 |
| フレンドの表示範囲・選択したお気に入りグループ | `store.json` | アカウントごとの表示設定 |
| フレンド・インスタンス一覧、最近の通知 | UIのメモリ | アプリの終了まで |
| ワールド情報 | Rust のメモリ | プロセス終了までのキャッシュ |

`store.json` の保存処理は [`src/libs/userDataStore.ts`](../../src/libs/userDataStore.ts)、
Cookie の保存処理は [`src-tauri/src/social.rs`](../../src-tauri/src/social.rs) にあります。

起動時に、旧版の全登録からプロフィール全文（`users[].userData`）を取り除く。本人IDが一致した場合だけ、再ログインに使うユーザー名またはメールアドレスと表示用の画像URLを引き継ぐ。旧形式の一覧全体が壊れている場合は復元のため原本を保持する。[起動時の移行](../../src-tauri/src/account_migration.rs)

Windowsでは資格情報マネージャー、macOSではキーチェーン、LinuxではSecret Serviceを利用する。現在のkeyring依存にはAndroid用の保管実装がなく、Androidでは資格情報の保存がエラーになる。[依存設定](../../src-tauri/Cargo.toml)

## セキュリティ境界

- パスワードと OTP は認証要求にだけ利用し、アプリのストアへ永続化しない。
- Cookie の永続化には平文の plugin-store ではなく OS keyring を使う。
- VRChat API 通信は `https://api.vrchat.cloud/api` を基点とする。
- ログ、デバッグ出力、Knowledge Base へ認証情報や個人データを転記しない。
- 進行中の取得・自己招待には開始時のアカウントのクライアントを使用する。画面の切り替え後に届いた応答は元のアカウントに属する。
- 画面は専用の設定コマンドを通じて登録一覧と現在のアカウントを参照する。設定の書き込みは定義済みの項目・型・値に限定し、アカウント登録と選択IDの更新はRustの認証処理が行う。[設定コマンド](../../src-tauri/src/preferences.rs)
- 切り替え時は登録済みIDを確認してからCookieを復元する。ログアウト時には使用中のセッションと登録の双方を確認し、資格情報を先に削除する。ログアウトは端末単位の操作で、VRChat側でセッションを取り消すAPIは呼ばない。[認証処理](../../src-tauri/src/social.rs)
- パスワード・確認コードは送信時に入力欄から消す。二要素認証の待機は開始から10分で期限切れになり、次に入力されたコードを送信する前に破棄する。認証通信は転送を追従しない。[フォーム](../../src/components/ui/sessionForm.tsx)・[認証処理](../../src-tauri/src/social.rs)
- フレンド一覧・ユーザー詳細・プロフィールの応答は、画面で扱う項目だけを取り出して渡す。[プロフィールの返却](../../src-tauri/src/social.rs)
- 配布版の WebView はアカウント専用の認証・参照コマンドを使用する。旧認証コマンドを登録せず、汎用APIテスターは開発用のデバッグ構成に限って登録する。[公開コマンド](../../src-tauri/src/commands.rs)
- アプリのログはアプリ自身と画面のログが対象。HTTP・Cookie・keyringライブラリの診断を除外し、APIの失敗はHTTPステータスまたは固定のエラーとして扱う。[ログ設定](../../src-tauri/src/lib.rs)
- 配布版の画面ではローカルのスクリプトとTauri IPCを許可し、外部フォーム送信を禁止する。リモート画像はHTTPSで表示する。[CSP設定](../../src-tauri/tauri.conf.json)

根拠: [`src-tauri/src/commands.rs`](../../src-tauri/src/commands.rs)

## データ変更時の確認事項

- plugin-store に新しい個人データを追加する前に、本当に永続化が必要か確認する。
- Cookie やトークンは `store.json` に保存しない。
- API 応答本文、ヘッダー、リクエストURLを診断ログに出力しない。
- アカウント削除操作では、表示用ユーザー情報と keyring エントリの寿命が一致するか確認する。
- 保存形式を変える場合は、既存利用者向けの移行または安全なフォールバックを設計する。

## 関連ページ

- [アーキテクチャ](architecture.md)
- [開発とリリース](development-and-release.md)
