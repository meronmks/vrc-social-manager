# VRC Social Manager Knowledge Base

このディレクトリは、[LLM Wiki パターン](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)を
VRC Social Manager の開発知識へ適用したものです。会話のたびに情報を探し直すのではなく、
コードと資料から得た知識を、相互リンクされた Markdown として継続的に育てます。

## 構成

```text
knowledge/
├── README.md            # 人間向けの利用案内
├── raw/                 # 変更しない外部資料
│   └── README.md
└── wiki/                # LLM が保守する派生文書
    ├── index.md         # 内容別の索引
    ├── log.md           # 追記専用の作業履歴
    ├── project-overview.md
    ├── architecture.md
    ├── authentication-and-storage.md
    ├── development-and-release.md
    └── templates/
        └── page.md
```

プロジェクトのソースコード、設定、テスト、既存文書は「一次情報」です。
`raw/` は外部仕様や調査資料をそのまま保存する場所、`wiki/` は一次情報と raw sources を
統合して LLM が更新する場所です。Wiki は理解を速める入口であり、実装の代わりではありません。

## 基本的な使い方

### 資料を取り込む

1. 資料を `raw/YYYY-MM-DD-短い名前.拡張子` として追加します。
2. エージェントへ「この資料を knowledge base に取り込んで」と依頼します。
3. エージェントは関連ページ、[`wiki/index.md`](wiki/index.md)、[`wiki/log.md`](wiki/log.md) を更新します。

取り込んだ raw source は変更しません。誤りや新版が見つかった場合も上書きせず、別ファイルとして追加して
Wiki 側で訂正・置換関係を説明します。

### Wiki に質問する

たとえば「認証 Cookie はどこへ保存されるか」「フレンド一覧取得の流れを説明して」のように質問できます。
エージェントは索引から関連ページを探し、最後にコードで内容を検証して回答します。

### 健全性を確認する

「knowledge base を lint して」と依頼すると、リンク切れ、孤立ページ、古い記述、コードとの矛盾、
出典不足、秘密情報の混入を確認します。詳細なエージェント向け手順はルートの
[`AGENTS.md`](../AGENTS.md) にあります。

## 責任分界

- 開発者は、資料の選定、設計判断、最終確認を担当します。
- LLM は、要約、相互参照、索引、矛盾の記録、Wiki の更新を担当します。
- 認証情報、OTP、Cookie、VRChat ユーザーの個人データは raw/Wiki のどちらにも保存しません。
