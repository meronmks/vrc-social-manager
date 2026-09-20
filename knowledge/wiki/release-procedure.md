---
title: リリース手順書
kind: operations
status: verified
updated: 2026-09-20
sources:
  - ../../.github/workflows/bump-version.yml
  - ../../.github/workflows/release-pr.yml
  - ../../.github/workflows/publish.yml
  - ../../CHANGELOG.md
  - ../../src-tauri/tauri.conf.json
---

# リリース手順書

## 目的

VRC Social Manager の通常リリース、ベータ版、RC 版を GitHub Actions から作成し、
GitHub Releases のドラフトを確認して公開するまでの手順です。

標準経路は `dev` を起点にリリース PR を作り、`main` へのマージを契機にタグ、
3 OS 向け成果物、Tauri updater 用 `latest.json` を生成します。

## 自動化される範囲

1. [`bump-version.yml`](../../.github/workflows/bump-version.yml) が
   [`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json) のバージョンと
   [`CHANGELOG.md`](../../CHANGELOG.md) を更新する。
2. `release/vX.Y.Z` ブランチを push し、`main` 向けのリリース PR を作成する。
3. PR のマージ後、[`release-pr.yml`](../../.github/workflows/release-pr.yml) が
   マージコミットへ `vX.Y.Z` タグを作成する。
4. [`publish.yml`](../../.github/workflows/publish.yml) が GitHub の自動生成リリースノートを作成し、
   macOS、Linux、Windows の成果物と `latest.json` をドラフトリリースへ追加する。
5. ビルド完了後、リリースブランチを削除してリリース PR へ結果をコメントする。

GitHub Release の最終確認と公開操作は人が行います。

## 事前準備

### リポジトリ設定

次が設定済みであることを確認します。値そのものをログ、Issue、PR、Wiki に記載してはいけません。

- Actions がリポジトリへ書き込み、PR を作成できること。
- Actions secrets に `TAURI_SIGNING_PRIVATE_KEY` が登録されていること。
- 秘密鍵にパスワードがある場合は `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` が登録されていること。

### リリース対象

- リリース対象の変更が `dev` に入っている。
- 対象 PR の CI が成功している。
- `dev` に意図しない変更や未確認の依存関係更新が含まれていない。
- `CHANGELOG.md` の `Unreleased` に利用者向けの変更内容が記載されている。
- 破壊的変更、設定移行、再ログインなどが必要な場合、その注意事項が記載されている。

必要に応じてローカルでも次を実行します。

```bash
pnpm run lint
pnpm run build:vite
cargo check --manifest-path src-tauri/Cargo.toml
```

## バージョンの選び方

GitHub の `Actions` → `bump-version` → `Run workflow` で次の入力を選びます。

| 現在 | 目的 | Version type | Is prerelease | 生成例 |
| --- | --- | --- | --- | --- |
| `0.10.1` | パッチ版 | `patch` | `false` | `0.10.2` |
| `0.10.1` | マイナー版 | `minor` | `false` | `0.11.0` |
| `0.10.1` | メジャー版 | `major` | `false` | `1.0.0` |
| `0.10.1` | 次のベータ系列を開始 | `minor` | `true` | `0.11.0-beta.1` |
| `0.11.0-beta.1` | ベータを進める | `beta` | `true` | `0.11.0-beta.2` |
| `0.11.0-beta.2` | RCへ移行 | `rc` | `true` | `0.11.0-rc.1` |
| `0.11.0-rc.1` | RCを進める | `rc` | `true` | `0.11.0-rc.2` |
| `0.11.0-beta.2` | 同じバージョンの正式版 | `beta` | `false` | `0.11.0` |
| `0.11.0-rc.2` | 同じバージョンの正式版 | `rc` | `false` | `0.11.0` |

注意事項:

- `patch` は `Is prerelease` に関係なく正式版を作ります。
- 正式版から次のベータ系列を始める場合は `minor` または `major` と `true` を使用します。
- 正式版から `beta` と `true` を選ぶと、既に公開した正式版より SemVer 上で古いベータ版になるため使用しません。
- バージョンが不明な場合は、実行前に `src-tauri/tauri.conf.json` を確認します。

## 通常のリリース手順

### 1. バージョン更新ワークフローを実行する

1. GitHub のリポジトリで `Actions` を開く。
2. `bump-version` を選ぶ。
3. `Run workflow` を開く。
4. `Use workflow from` は通常 `dev` を選ぶ。
5. `Version type` と `Is prerelease` を「バージョンの選び方」に従って設定する。
6. 実行し、`validate-tag` と `bump-version` の両ジョブが成功するまで待つ。

成功すると `Release vX.Y.Z` という PR が `main` 向けに作成されます。

### 2. リリース PR をレビューする

最低限、次を確認します。

- PR の変更元が `release/vX.Y.Z`、変更先が `main` である。
- `src-tauri/tauri.conf.json` のバージョンが PR と一致する。
- `CHANGELOG.md` の対象バージョン、日付、内容が正しい。
- リリース対象外の差分が含まれていない。
- PR の CI がすべて成功している。
- ベータ版または RC 版の場合、PR のバージョンに `-beta.N` または `-rc.N` が付いている。

問題があれば PR 上で修正し、問題がなければ `main` へマージします。PR を閉じただけでは
リリース処理は開始されません。

### 3. 自動リリース処理を確認する

PR のマージ後、`Actions` の `release-pr` を開き、次が成功したことを確認します。

- `prepare`: バージョン検証とタグ作成。
- `publish / prepare`: タグ検証とリリースノート生成。
- `publish / publish-tauri`: macOS、Linux、Windows のビルドとアップロード。
- `cleanup`: リリースブランチ削除と PR コメント。

`publish` はリリース PR から直接呼び出されます。Actions のトークンが push したタグでは
別のタグ push ワークフローが起動しないため、タグの画面だけを待たず `release-pr` の実行を確認します。

### 4. ドラフトリリースを確認する

GitHub の `Releases` を開き、対象タグのドラフトで次を確認します。

- タグとタイトルが `vX.Y.Z` である。
- 正式版とプレリリースの区分が正しい。
- 自動生成されたリリースノートに対象 PR が含まれている。
- macOS、Linux、Windows の成果物がそろっている。
- updater 用の署名ファイルと `latest.json` が存在する。
- `latest.json` の `version`、`notes`、`platforms` が対象リリースと一致する。

リリース本文はビルド時に `latest.json` の `notes` にも書き込まれます。ドラフト画面で本文だけを
手動編集しても `latest.json` は自動更新されません。標準運用では生成された本文を変更せず、
修正が必要な場合は公開を止めて、リリース本文と `latest.json` の両方をどう更新するか確認します。
ワークフローの再実行だけでは、GitHub 上で手動編集した内容は `latest.json` に反映されません。

### 5. リリースを公開する

確認が完了したら GitHub Releases の `Publish release` を実行します。

- 正式版は、公開後に `/releases/latest/download/latest.json` から取得できることを確認する。
- ベータ版と RC 版はプレリリースとして公開する。現在の updater endpoint は `releases/latest` を
  使用するため、プレリリースは通常の自動更新対象になりません。
- 公開後、実機で更新確認画面のバージョンとリリースノートを確認する。

## 失敗時の対応

### `bump-version` が失敗した

- リリースブランチが作成されていなければ、原因を修正してワークフローを再実行する。
- `release/vX.Y.Z` の push までは成功し、PR 作成だけ失敗した場合は、そのブランチから `main` への
  PR を手動で作成する。同じバージョンでそのまま再実行するとブランチ名が衝突する。
- `CHANGELOG.md` に変更がない場合は、`Unreleased` の記載と生成ログを確認する。

### `release-pr` の `prepare` が失敗した

- PR のブランチ名と `src-tauri/tauri.conf.json` のバージョンが一致するか確認する。
- 同名タグが別のコミットを指している場合、ワークフローは安全のためタグを移動しない。
- タグを削除・移動する前に、既に配布済みか、ドラフトや成果物が存在するかを確認する。

### OS別ビルドの一部が失敗した

- GitHub Actions から失敗したジョブを再実行する。
- 公開処理は既存のドラフトリリースとタグを再利用するため、成功済み成果物を保持したまま不足分を追加できる。
- 署名エラーの場合は secrets の有無を確認するが、値をログへ出力しない。

### `cleanup` だけが失敗した

タグ、ビルド、ドラフトリリースが成功していれば、リリース成果物自体は作成済みです。
残っている `release/vX.Y.Z` ブランチを確認し、不要なら GitHub 上で削除します。

### 公開後に問題が見つかった

- 公開済みタグの移動や成果物の差し替えは原則として行わない。
- 修正を `dev` へ入れ、パッチバージョンで新しいリリースを作成する。
- 重大な問題では、GitHub Release の説明へ注意書きを追加し、必要に応じて該当リリースを最新扱いから外す。

## リリースチェックリスト

```text
[ ] dev に対象変更がすべて入っている
[ ] 対象変更の CI が成功している
[ ] CHANGELOG.md の Unreleased を確認した
[ ] bump-version を dev から実行した
[ ] リリース PR のバージョンと差分を確認した
[ ] リリース PR の CI が成功した
[ ] リリース PR を main へマージした
[ ] release-pr の全ジョブが成功した
[ ] 3 OS の成果物と署名ファイルを確認した
[ ] latest.json の version、notes、platforms を確認した
[ ] 正式版／プレリリースの区分を確認した
[ ] ドラフトリリースを公開した
[ ] 公開後のダウンロードと更新確認画面を確認した
```

## 関連ページ

- [開発とリリース](development-and-release.md)
- [Knowledge Base 索引](index.md)
