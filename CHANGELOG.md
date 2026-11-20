# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [1.0.0-beta.1] - 2026-11-20

### Added
- フレンド一覧で全員表示とお気に入りグループを切り替え、表示範囲内の総人数とオンライン人数を確認できるようにしました。名前検索は選択中のグループにかかわらず全フレンドが対象です。
- インスタンス一覧に、同じ場所にいるフレンドが多い順の並べ替えと、グループ主催の場所を絞り込む機能を追加しました。フレンドがいない場所も所属グループから探せます。
- インスタンス詳細のフレンド名から、その人の詳細やVRChatのWebプロフィールを開けるようにしました。
- アカウントごとに、自己招待の送信結果や更新エラーをアプリ終了まで読み返せる「最近の通知」を追加しました。

### Changed
- フレンド・インスタンス・設定の画面を刷新しました。インスタンス一覧にはワールドのサムネイルとフレンドのアイコンを表示し、絞り込み条件は折りたためます。
- ホーム右上からアカウントを追加・切り替えできるようにしました。認証期限切れの際は対象アカウントに再ログインし、ログアウト後は残っている中で最後に使ったアカウントに戻ります。
- フレンド詳細で現在地を再取得してから、そのインスタンスへの招待を自分に送れます。送信結果を確認できない場合はその旨を表示し、手動で再送できます。
- フレンドの状態は色で区別し、本人のステータステキストを優先して表示します。お気に入りはVRChatの設定名を使い、標準の枠はゲームと同じ `Group 1` などの表記に揃えました。
- 設定に現在のバージョンとフレンド一覧の取得件数を表示し、1回の取得件数を変更できるようにしました。サードパーティライセンスは設定内でnpm・Cargoを切り替え、パッケージ名で検索して本文を読めます。
- ベータ版の更新確認を、リリース公開時に更新される配信用マニフェストを参照する方式に変更しました。GitHub APIのレート制限を受けず、マニフェストを取得できない場合は安定版の確認に切り替わります。

### Fixed
- フレンドのプロフィールとアイコンの取得を修正し、一覧の読み込み中からワールド名とサムネイルを取得するようにしました。
- Web利用中のフレンドを現在地だけでオフラインと判定する問題と、長いフレンド一覧をスクロールするとヘッダーまで画面外に移動する問題を修正しました。
- 初回ログイン・アカウント追加・再ログイン画面に、認証情報の扱いと非公式アプリであることを示す注意文を復元しました。

### Security
- 配布版から旧認証コマンドと汎用APIテスターを除外し、画面から保存ファイルやアカウント登録を直接書き換える権限を外しました。
- 旧版が保存したプロフィール全文を起動時に整理し、画面へ返すユーザー情報を表示に必要な項目に絞りました。通信応答やCookie・資格情報ライブラリの診断出力もアプリのログから除外しました。
- アカウントの切り替えとログアウトで対象IDを照合し、二要素認証コードの入力待ちに10分の期限を設けました。

## [0.11.0] - 2026-11-20

### Added
- 設定に「ベータ版の更新を受け取る」を追加。オンにするとベータ版・リリース候補を含む最新版をすぐに確認でき、オフにすると、以降はインストール済みの版より新しい安定版のみが更新対象になります。更新確認に失敗した場合は原因をログに記録します。

## [0.10.2] - 2026-09-20

### Fixed
- APIのレスポンスが変更となり、ユーザーのプロフィール画像およびプロフィール情報が取得できなくなった問題を修正

### Security
- デバッグ時のログ出力から機密情報を削除

## [0.10.0] - 2026-02-02

### Added
- [Pencil](https://www.pencil.dev/)でのUIデザインファイル追加

### Changed
- ライセンス表示をダイアログ形式に変更
- 設定画面にヘッダーを追加し、戻るボタンとタイトルを表示

## [0.8.1] - 2025-07-28

### Fixed
- publicのインスタンスのインスタンスオーナーが正しく表示されないのを修正

## [0.8.0] - 2025-07-21

### Added
- 所属しているグループのインスタンスを取得するように

## [0.7.0] - 2025-06-28

### Added
- 認証cookieをOSのセキュアストアへ保管する機能

### Fixed
- 認証が切れると他のアカウントがあっても切り替えられない問題

### Changed
- CI設定の改善（TAURI_BUNDLER_DMG_IGNORE_CI設定追加）

[Unreleased]: https://github.com/meronmks/vrc-social-manager/compare/v1.0.0-beta.1...HEAD
[1.0.0-beta.1]: https://github.com/meronmks/vrc-social-manager/releases/tag/v1.0.0-beta.1
[0.11.0]: https://github.com/meronmks/vrc-social-manager/releases/tag/v0.11.0
[0.10.2]: https://github.com/meronmks/vrc-social-manager/releases/tag/v0.10.2
[0.10.0]: https://github.com/meronmks/vrc-social-manager/releases/tag/v0.10.0
[0.8.1]: https://github.com/meronmks/vrc-social-manager/releases/tag/v0.8.1
[0.8.0]: https://github.com/meronmks/vrc-social-manager/releases/tag/v0.8.0
[0.7.0]: https://github.com/meronmks/vrc-social-manager/releases/tag/v0.7.0
