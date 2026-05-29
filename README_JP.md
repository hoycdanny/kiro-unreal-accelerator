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

* [Unreal Engine 5.5+](https://www.unrealengine.com/)（5.5 / 5.6 / 5.7 対応）
* [Kiro IDE](https://kiro.dev/docs/getting-started/installation)
* Python 3.12+ と [uv](https://docs.astral.sh/uv/getting-started/installation/)（Local MCP 用）
* Node.js 18+（本 Power の開発/テスト用のみ）
* （オプション）[Flopperam API Key](https://flopperam.com/account) — 有料 Hosted MCP のみ必要

> **完全なインストール手順は下記のインストールセクションを参照してください**

## インストール

### ステップ 1 — Kiro に Power をインストール

Kiro を開く → 左パネルの Powers アイコンをクリック → "+" をクリック → "Add Custom Power" を選択 → 本プロジェクトのルートディレクトリを選択

### ステップ 2 — MCP Server のインストール

本 Power は [flopperam/unreal-engine-mcp](https://github.com/flopperam/unreal-engine-mcp) を使用します。UE 5.5 / 5.6 / 5.7 対応。

**方法 1：オープンソースローカル MCP（無料、推奨）**

**2a — リポジトリを固定の場所にクローン（UE プロジェクト内には置かない）**

```cmd
cd %USERPROFILE%\Desktop
git clone https://github.com/flopperam/unreal-engine-mcp.git
```

**2b — UnrealMCP プラグインを UE プロジェクトにコピー**

UE プロジェクトのルート（`.uproject` がある場所）で実行：

```cmd
xcopy /E /I "%USERPROFILE%\Desktop\unreal-engine-mcp\UnrealMCP" "Plugins\UnrealMCP"
```

最終構造：
```
UEプロジェクト/
├── Plugins/
│   └── UnrealMCP/
│       ├── Source/
│       └── UnrealMCP.uplugin
├── Content/
└── プロジェクト.uproject
```

**2c — プラグインをビルドして有効化**

1. `.uproject` を右クリック → "Generate Visual Studio project files"
2. `.sln` を開き、**Development Editor** + **Win64** でビルド
3. Unreal Editor → Edit → Plugins → "UnrealMCP" を検索 → 有効化 → 再起動

**2d — Python 環境をインストール**

```cmd
pip install uv
```

**2e — Python Server を検証**

```cmd
cd %USERPROFILE%\Desktop\unreal-engine-mcp\Python
uv run unreal_mcp_server_advanced.py
```

エラーなく起動したら Ctrl+C で停止。Kiro が自動的に Server を管理します。

**方法 2：Hosted Flop MCP（有料、50+ 完全ツール）**

完全な 50+ ツール体験でローカルセットアップ不要の場合：

1. [flopperam.com/account](https://flopperam.com/account) で API Key を取得
2. FlopAI Unreal プラグインをインストール — [flopperam.com/docs](https://flopperam.com/docs) を参照

### ステップ 3 — MCP 接続を設定

`mcp.json` または `.kiro/settings/mcp.json` を編集：

**方法 1：ローカル MCP（無料）**

Windows：
```json
{
  "mcpServers": {
    "unreal-engine": {
      "command": "uv",
      "args": [
        "--directory",
        "C:\\Users\\<ユーザー名>\\Desktop\\unreal-engine-mcp\\Python",
        "run",
        "unreal_mcp_server_advanced.py"
      ]
    }
  },
  "powers": {
    "mcpServers": {}
  }
}
```

macOS / Linux：
```json
{
  "mcpServers": {
    "unreal-engine": {
      "command": "uv",
      "args": [
        "--directory",
        "/Users/<ユーザー名>/Desktop/unreal-engine-mcp/Python",
        "run",
        "unreal_mcp_server_advanced.py"
      ]
    }
  },
  "powers": {
    "mcpServers": {}
  }
}
```

> パスを実際にクローンした場所に置き換えてください。Windows では JSON 内でダブルバックスラッシュ `\\` を使用してください。

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

### ステップ 4 — 自動ガイダンス Hook をインストール（必須）

この Hook により、AI が毎回のプロンプトで自動的に Power を起動し、MCP ツールを正しく使用します：

```bash
mkdir -p .kiro/hooks
cp hooks/pre-unreal-tool.kiro.hook .kiro/hooks/
```

> この Hook をインストールしないと、毎回手動で AI に MCP ツールの使用を指示する必要があります。

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
