# Kiro Unreal Accelerator

[English](README.md) | [繁體中文](README_TW.md) | [简体中文](README_CN.md) | [日本語](README_JP.md) | [한국어](README_KR.md)

> **言語について**：メインの README は繁体字中国語です。Steering ファイル（ドメイン知識）は繁体字中国語で英語の要約セクション付きです。Power は開発者の希望する言語で応答します。

IDE を Unreal Engine 開発 AI アシスタントに変換します。MCP（Model Context Protocol — AI アシスタントが開発ツールと対話するための標準化プロトコル）を通じて自然言語で Unreal Editor を操作できます。本 Power は Blueprint ロジック生成、アセット管理、マテリアルワークフロー、パフォーマンス分析、コード品質チェック、クロスプラットフォーム互換性などをカバーし、35 の MCP ツールと 10 のドメイン知識ファイルを含みます。

> **主要概念**：
> * **MCP**（Model Context Protocol）：AI アシスタントと開発ツール間の標準化通信プロトコル
> * **Blueprint**：Unreal Engine のビジュアルスクリプティングシステム
> * **Nanite**：UE5 の仮想化ジオメトリシステム（自動 LOD と Draw Call 最適化）
> * **Lumen**：UE5 の動的グローバルイルミネーション＆リフレクションシステム
> * **GAS**（Gameplay Ability System）：Unreal のアビリティ、エフェクト、アトリビュートフレームワーク

## 機能

* **Blueprint ロジック生成** — Blueprint Editor 内で直接ノード作成、ピン接続、完全なイベントグラフ構築
* **アセット自動化** — プリセットの一括適用、アセットタイプ自動検出、Nanite 互換性検証
* **マテリアルワークフロー** — 検証済み MCP API 回避策付きのマテリアル検索・作成・適用・置換
* **パフォーマンス分析** — Draw Call/メモリ/GPU プロファイリング、アンチパターン検出、最適化提案
* **コード品質** — 命名規則チェック、循環依存検出、Blueprint/C++ バランス分析
* **クロスプラットフォーム互換性** — 8 プラットフォームの Shader Model チェックとメモリバジェット検証
* **GAS 統合** — 適切な Tag 設定付きのアビリティ、エフェクト、アトリビュートセット生成
* **AI ビヘイビアツリー** — テンプレートからビヘイビアツリー、ブラックボード、EQS クエリを作成
* **レベルスキャフォールディング** — ワンコマンドでレベル構造生成（オープンワールド、リニア、アリーナ、インテリア）
* **ワークフロー自動化** — 条件分岐と失敗戦略付きのマルチステップワークフロー

## アーキテクチャ

```
開発者（自然言語）
    → AI レイヤー（意図理解＆プランニング）
        → MCP プロトコル
            → Unreal Editor（実行レイヤー）

Unreal Accelerator（インテリジェンスレイヤー）
├── POWER.md        → ツールとワークフローを定義するメインドキュメント
├── steering/       → 10 のドメイン知識ファイル
├── templates/      → 45 の JSON テンプレート（10 カテゴリ）
└── src/            → 35+ TypeScript ツールモジュール
```

## 前提条件

* [Unreal Engine 5.5+](https://www.unrealengine.com/)（5.5 / 5.6 / 5.7 対応）FlopAI プラグインインストール済み
* [Kiro IDE](https://kiro.dev/docs/getting-started/installation)
* [Flopperam API Key](https://flopperam.com/account)（Hosted MCP 用）または Python 3.12+（Local MCP 用）
* Node.js 18+（本 Power の開発/テスト用のみ）

## インストール

### ステップ 1 — Kiro に Power をインストール

Kiro を開く → 左パネルの Powers アイコンをクリック → "+" をクリック → "Add Custom Power" を選択 → 本プロジェクトのルートディレクトリを選択

### ステップ 2 — MCP Server のインストール

本 Power は [flopperam/unreal-engine-mcp](https://github.com/flopperam/unreal-engine-mcp) を使用します。UE 5.5 / 5.6 / 5.7 対応。

**方法 1：オープンソースローカル MCP（無料、推奨）**

1. リポジトリをクローン：`git clone https://github.com/flopperam/unreal-engine-mcp.git`
2. `UnrealMCP/` フォルダを UE プロジェクトの `Plugins/` ディレクトリにコピー
3. プロジェクトファイルを再生成、プラグインをビルド、Editor で有効化（Edit → Plugins → "UnrealMCP"）
4. Python 3.12+ と [uv](https://docs.astral.sh/uv/getting-started/installation/) をインストール

**方法 2：Hosted Flop MCP（有料、50+ 完全ツール）**

完全な 50+ ツール体験でローカルセットアップ不要の場合：

1. [flopperam.com/account](https://flopperam.com/account) で API Key を取得
2. FlopAI Unreal プラグインをインストール — [flopperam.com/docs](https://flopperam.com/docs)（Installation タブ）を参照

### ステップ 3 — MCP 接続を設定

`mcp.json` または `.kiro/settings/mcp.json` を編集：

**方法 1：ローカル MCP（無料）**

```json
{
  "mcpServers": {
    "unreal-engine": {
      "command": "uv",
      "args": [
        "--directory",
        "<path/to/unreal-engine-mcp/Python>",
        "run",
        "unreal_mcp_server_advanced.py"
      ]
    }
  }
}
```

**方法 2：Hosted Flop MCP（有料）**

```json
{
  "mcpServers": {
    "unreal-engine": {
      "url": "https://agent.flopperam.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### ステップ 4 — 自動ガイダンス Hook をインストール（推奨）

```bash
mkdir -p .kiro/hooks
cp hooks/pre-unreal-tool.kiro.hook .kiro/hooks/
```

### 接続確認

Kiro で Unreal 関連のコマンドを入力（例：「現在のレベルの全アクターを一覧表示」）。AI が正しく応答すれば接続成功です。

## 使い方

自然言語で AI にやりたいことを伝えてください。適切な MCP ツールが自動的に選択・実行されます。

### コマンド例

```
「SpringArm と Camera 付きのキャラクター Blueprint を作成」
「Environment フォルダの全メッシュに Nanite を適用」
「ラフネス 0.3 の PBR メタルマテリアルを作成」
「プロジェクトのコードアーキテクチャ品質をチェック」
「このプロジェクトは iOS と互換性がある？」
「BP_MainCharacter の依存関係を分析」
「パフォーマンス監査ワークフローを実行」
```

## 開発

```bash
npm install
npm test                 # 全テスト実行
npm run test:coverage    # カバレッジ付きテスト
npm run lint             # ESLint チェック
npx tsc --noEmit        # TypeScript 型チェック
```

## トラブルシューティング

| 問題 | 解決策 |
|------|--------|
| MCP 接続失敗 | Unreal Editor が開いており MCP プラグインが有効であることを確認 |
| Blueprint コンパイルエラー | `listNodeTypes()` でノードタイプ名を確認 |
| マテリアル適用が効かない | Blueprint SCS 方式を使用（POWER.md の既知の問題を参照） |
| テスト失敗 | `npm install` 後に `npm test` を実行 |
| TypeScript エラー | `npm install` 後に `npx tsc --noEmit` を実行 |

## セキュリティ

詳細は [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) を参照してください。

## ライセンス

MIT License。[LICENSE](LICENSE) ファイルを参照してください。
