# Kiro Unreal Accelerator Power

讓 Kiro 成為你的 Unreal Engine 開發智慧大腦。透過自然語言下達指令，Kiro 經由 MCP（Model Context Protocol）遠端操控 Unreal Editor，涵蓋資產管理、關卡建置、Blueprint 生成、材質工作流、效能分析、程式碼品質檢查等十一大核心功能，整合 35 個 MCP 工具。

---

## 安裝設定

### 前置需求

- [Unreal Engine 5](https://www.unrealengine.com/) 已安裝並開啟專案
- [Kiro IDE](https://kiro.dev/docs/getting-started/installation) 已安裝
- Node.js 18+（僅開發/測試時需要）

### 兩步安裝

1. **Kiro 端 — 安裝本 Power**

   Kiro → 左側面板點選 Powers 圖示 → 點擊右上角「+」按鈕 → 選擇「Add Custom Power」→ 選取本專案資料夾

2. **Unreal 端 — 安裝 Unreal Engine MCP Server**

   安裝 [unreal-engine-mcp-server](https://www.npmjs.com/package/unreal-engine-mcp-server) 並確保 Unreal Editor 已開啟專案。

   ```bash
   npm install -g unreal-engine-mcp-server
   ```

### MCP 連線配置

編輯 `mcp.json`（位於本 Power 根目錄或 `~/.kiro/settings/mcp.json`）：

```json
{
  "mcpServers": {
    "unreal-engine": {
      "command": "npx",
      "args": ["unreal-engine-mcp-server"],
      "env": {
        "UE_PROJECT_PATH": "/path/to/your/unreal/project/"
      },
      "autoApprove": ["inspect", "manage_tools"]
    }
  }
}
```

> 將 `UE_PROJECT_PATH` 替換為你的 Unreal 專案路徑。若使用 nvm，請將 `command` 改為 npx 的完整路徑。

### 驗證連線

在 Kiro 中輸入任意 Unreal 相關指令（例如「列出目前關卡的 Actor」），若 Kiro 能正確回應，代表連線成功。

### 開發與測試

```bash
npm install
npm test              # 執行所有測試（287 個測試）
npm run test:watch    # 監聽模式
npm run test:coverage # 含覆蓋率報告
npx tsc --noEmit      # TypeScript 型別檢查
```

---

## 如何使用

在 Kiro 聊天中用自然語言描述你想做的事，Kiro 會自動選擇對應的 MCP 工具執行。

### 基本指令範例

```
「把 Props 資料夾的靜態網格都啟用 Nanite」
「幫我建一個開放世界關卡，包含 World Partition 和 Data Layer」
「建立一個第三人稱角色 Blueprint，含移動和跳躍」
「建立 PBR 材質，帶 Base Color 和 Normal Map 參數」
「檢查專案的效能，找出反模式」
「分析 PS5 平台的相容性」
「建立一個巡邏 AI 行為樹」
```

### 效能分析

當你發現 FPS 掉幀但不確定瓶頸在哪時：

```
「掃描目前場景的效能，產生完整報告」
「Draw Call 太多了，有什麼最佳化方案？」
「檢查 Nanite 和 Lumen 的使用狀況」
「偵測場景中的效能反模式」
「分析記憶體使用量，找出過大的貼圖」
```

Kiro 會自動執行以下流程：

1. **場景掃描** — 分析 Draw Call、記憶體、GPU 使用量
2. **反模式偵測** — 識別過多動態光源、未合併網格、過大貼圖、過高材質指令數、過多 Tick 更新
3. **Nanite/Lumen 分析** — 檢查 Nanite 啟用狀態與 Lumen GI 設定
4. **產生最佳化報告** — 依嚴重程度排序，提供具體修復步驟與預期改善幅度

### 程式碼層級使用（進階）

如果你想直接在 TypeScript 中呼叫分析模組：

```typescript
import {
  AssetAnalyzer,
  PerformanceAnalyzer,
  CodeQualityAnalyzer,
  DependencyAnalyzer,
  CompatibilityChecker,
  WorkflowEngine,
  ReportGenerator,
} from './src';

// 效能分析
const perfAnalyzer = new PerformanceAnalyzer(mcpClient);
const report = await perfAnalyzer.analyzeScene();
const antiPatterns = perfAnalyzer.detectAntiPatterns(report);

// 資產分析
const assetAnalyzer = new AssetAnalyzer(mcpClient);
const result = await assetAnalyzer.analyzeAsset('/Game/Props/Chair');
const naniteCheck = assetAnalyzer.validateNaniteCompatibility(meshMetadata);

// 程式碼品質
const codeAnalyzer = new CodeQualityAnalyzer(mcpClient);
const qualityReport = await codeAnalyzer.analyzeProject();
const cycles = codeAnalyzer.detectCircularDependencies(dependencyGraph);

// 依賴分析
const depAnalyzer = new DependencyAnalyzer(mcpClient);
const tree = await depAnalyzer.buildDependencyTree('/Game/Characters/Hero');
const orphans = depAnalyzer.findOrphanedAssets(allAssets);

// 平台相容性
const checker = new CompatibilityChecker(mcpClient);
const compatReport = await checker.checkPlatform('PS5');

// 報告產生
const reportGen = new ReportGenerator();
const markdown = reportGen.generatePerformanceReport(report, { format: 'markdown' });
```

---

## 功能列表

### 十一大核心功能

| 功能 | 說明 | 對應 Steering |
|------|------|---------------|
| 資產管理與自動配置 | 批次套用 Asset Preset、自動偵測資產類型、Nanite 相容性驗證 | `asset-pipeline.md` |
| 關卡建置與腳手架 | 從範本一鍵生成關卡結構（開放世界、線性、競技場、室內） | `architecture.md` |
| Blueprint 生成與最佳化 | 建立角色、互動物件、Widget、GameMode、AI Controller 等 Blueprint | `blueprint-patterns.md` |
| 材質工作流自動化 | 生成 PBR、次表面散射、地形混合、VFX 材質範本 | `asset-pipeline.md` |
| 效能分析與最佳化 | Draw Call/記憶體/GPU 分析、反模式偵測、Nanite/Lumen 專屬建議 | `performance.md` |
| 程式碼品質檢查 | 命名規範、循環依賴偵測、Blueprint/C++ 職責分配分析 | `architecture.md` |
| 跨平台相容性驗證 | Shader Model 相容性、記憶體預算、Scalability Settings 驗證 | `platform-compat.md` |
| GAS 整合 | 生成 Ability、Effect、Attribute Set、Cue，含 Tag 設定 | `gas-patterns.md` |
| AI 行為樹生成 | 建立行為樹、Blackboard、EQS 查詢、AI Controller | `blueprint-patterns.md` |
| 知識管理 | 團隊文件儲存/檢索、過期偵測、API 變更追蹤 | — |
| 工作流自動化 | 定義多步驟工作流，支援條件分支與錯誤處理 | — |

### 效能反模式偵測

| 類別 | 反模式 | 嚴重程度 |
|------|--------|----------|
| 光源 | 過多動態光源（> 閾值） | Error |
| 網格 | 未合併的小型靜態網格 | Warning |
| 貼圖 | 過大貼圖（> 4096） | Warning |
| 材質 | 過高材質指令數 | Warning |
| Tick | 過多 Actor Tick 更新 | Warning |
| Nanite | 未啟用 Nanite 的高面數網格 | Suggestion |
| Lumen | Lumen 設定不當 | Suggestion |

### 最佳化建議對照

| 問題類別 | 建議方案 |
|---------|---------|
| Draw Call 過多 | Static Mesh 合併、HLOD、Nanite 啟用、Instanced Static Mesh |
| 記憶體過高 | 貼圖壓縮、LOD 設定、Streaming 啟用、Nanite 取代傳統 LOD |
| GPU 瓶頸 | Shader 簡化、Lumen 設定調整、Virtual Shadow Maps 最佳化 |
| Tick 過多 | 降低 Tick 頻率、改用 Timer、事件驅動架構 |

---

## MCP 工具映射

將使用者意圖映射到對應的 MCP 工具。所有工具在執行時帶有 `mcp_unreal_engine_` 前綴。

| 使用者意圖 | 主要 MCP 工具 | 輔助工具 |
|---|---|---|
| 匯入/設定資產 | `manage_asset` | `inspect`, `manage_texture` |
| 建立/修改 Blueprint | `manage_blueprint` | `inspect`, `manage_asset` |
| 生成/變換 Actor | `control_actor` | `inspect`, `manage_level` |
| PIE 播放/截圖 | `control_editor` | `system_control` |
| 載入/儲存/串流關卡 | `manage_level` | `manage_level_structure`, `manage_volumes` |
| 建立地形/植被 | `build_environment` | `manage_asset`, `manage_material_authoring` |
| 動畫/物理/布娃娃 | `animation_physics` | `manage_skeleton`, `manage_asset` |
| 編輯 Level Sequence | `manage_sequence` | `control_actor`, `control_editor` |
| 建立輸入動作/映射 | `manage_input` | `manage_blueprint` |
| 檢查 UObject 屬性 | `inspect` | — |
| 播放/設定音訊 | `manage_audio` | `manage_asset`, `inspect` |
| 建立行為樹 | `manage_behavior_tree` | `manage_ai`, `manage_blueprint` |
| 生成/設定光源 | `manage_lighting` | `manage_level`, `build_environment` |
| 效能分析/最佳化 | `manage_performance` | `system_control`, `inspect` |
| 建立程序化幾何 | `manage_geometry` | `manage_asset`, `manage_material_authoring` |
| 編輯骨骼網格/Socket | `manage_skeleton` | `animation_physics`, `manage_asset` |
| 編寫材質/圖表 | `manage_material_authoring` | `manage_asset`, `manage_texture` |
| 建立/處理貼圖 | `manage_texture` | `manage_asset` |
| 建立 GAS 能力/效果 | `manage_gas` | `manage_blueprint`, `manage_character` |
| 建立角色 Blueprint | `manage_character` | `manage_blueprint`, `animation_physics` |
| 設定武器/戰鬥 | `manage_combat` | `manage_blueprint`, `manage_gas` |
| 建立 AI 控制器/EQS | `manage_ai` | `manage_behavior_tree`, `manage_blueprint` |
| 建立物品/庫存 | `manage_inventory` | `manage_blueprint`, `manage_asset` |
| 建立門/開關/觸發器 | `manage_interaction` | `control_actor`, `manage_blueprint` |
| 建立 UMG Widget/HUD | `manage_widget_authoring` | `manage_blueprint`, `manage_asset` |
| 設定複製/RPC | `manage_networking` | `manage_blueprint`, `manage_game_framework` |
| 建立 GameMode/GameState | `manage_game_framework` | `manage_blueprint`, `manage_networking` |
| 設定分割畫面/LAN | `manage_sessions` | `manage_game_framework`, `manage_networking` |
| 建立子關卡/World Partition | `manage_level_structure` | `manage_level`, `manage_volumes` |
| 建立觸發/物理 Volume | `manage_volumes` | `manage_level`, `control_actor` |
| 設定 NavMesh/尋路 | `manage_navigation` | `manage_volumes`, `control_actor` |
| 建立/編輯 Spline | `manage_splines` | `manage_asset`, `manage_material_authoring` |
| 執行主控台命令/CVar | `system_control` | `control_editor` |
| 啟用/停用 MCP 工具 | `manage_tools` | — |

---

## 內建範本

| 類型 | 數量 | 路徑 | 內容 |
|------|------|------|------|
| Asset Preset | 7 | `templates/presets/` | `texture-2d-diffuse`、`texture-2d-normal`、`static-mesh-nanite`、`static-mesh-standard`、`skeletal-mesh-character`、`material-pbr`、`sound-sfx` |
| Level Scaffold | 4 | `templates/scaffolds/` | `open-world`、`linear-level`、`arena`、`interior` |
| Blueprint | 6 | `templates/blueprints/` | `character-base`、`actor-interactable`、`component-health`、`widget-hud`、`gamemode-base`、`ai-controller` |
| Material | 4 | `templates/materials/` | `pbr-standard`、`pbr-subsurface`、`landscape-blend`、`vfx-translucent` |
| GAS | 5 | `templates/gas/` | `ability-melee`、`ability-projectile`、`effect-damage`、`effect-buff`、`attribute-set-base` |
| AI | 4 | `templates/ai/` | `behavior-tree-patrol`、`behavior-tree-combat`、`blackboard-npc`、`eqs-find-cover` |
| Build Config | 3 | `templates/build-configs/` | `development`、`shipping`、`test` |
| Platform Profile | 5 | `templates/platform-profiles/` | `windows`、`ps5`、`xbox-series-x`、`ios`、`android` |
| Architecture Rule | 3 | `templates/architecture-rules/` | `naming-conventions`、`folder-structure`、`dependency-rules` |
| Workflow | 3 | `templates/workflows/` | `asset-import-pipeline`、`build-and-test`、`performance-audit` |

---

## Steering Files（領域知識）

`steering/` 目錄下的 8 個 Markdown 文件，根據開發者的請求情境自動載入對應的領域知識：

| 文件 | 領域 | 載入時機 |
|------|------|----------|
| `performance.md` | 效能 | Draw Call 最佳化、記憶體管理、GPU 最佳化、反模式 |
| `architecture.md` | 架構 | Blueprint vs C++ 職責分配、模組化設計、命名規範 |
| `asset-pipeline.md` | 資產管線 | 資產匯入流程、貼圖設定、網格設定、音訊設定 |
| `blueprint-patterns.md` | Blueprint | Blueprint 設計模式、反模式、最佳實踐 |
| `ue5-features.md` | UE5 特性 | Nanite、Lumen、World Partition、Control Rig、Virtual Shadow Maps |
| `platform-compat.md` | 平台相容性 | 各平台限制、Shader Model 對照、記憶體預算 |
| `gas-patterns.md` | GAS | Ability/Effect/Attribute 設計模式、Tag 階層、堆疊策略 |
| `ui-patterns.md` | UI/UMG | Widget 設計模式、Common UI 整合、UI 效能 |

---

## 分析模組

TypeScript 模組提供深度分析能力，位於 `src/`。

| 模組 | 路徑 | 功能 |
|------|------|------|
| AssetAnalyzer | `src/analyzers/AssetAnalyzer.ts` | 資產類型偵測、Nanite 相容性驗證、預設套用、批次配置 |
| PerformanceAnalyzer | `src/analyzers/PerformanceAnalyzer.ts` | 場景分析、Draw Call/記憶體/GPU 分析、Nanite & Lumen 分析、反模式偵測 |
| CodeQualityAnalyzer | `src/analyzers/CodeQualityAnalyzer.ts` | 命名規範檢查、循環依賴偵測、Blueprint/C++ 平衡分析、重構建議 |
| DependencyAnalyzer | `src/analyzers/DependencyAnalyzer.ts` | 依賴樹建構、孤立資產偵測、Chunk 重複分析、刪除影響分析 |
| CompatibilityChecker | `src/analyzers/CompatibilityChecker.ts` | 平台相容性掃描、Shader Model 檢查、記憶體預算驗證、Scalability 驗證 |
| WorkflowEngine | `src/engine/WorkflowEngine.ts` | 工作流定義與儲存、循序步驟執行（stop/skip/retry）、條件分支、排程 |
| ReportGenerator | `src/generators/ReportGenerator.ts` | 多格式報告產生（JSON、Markdown）、儀表板輸出 |
| KnowledgeManager | `src/utils/knowledge-manager.ts` | 文件儲存/檢索、全文搜尋、過期偵測、API 變更追蹤 |

---

## Kiro Power 原理說明

### 架構

```
開發者（自然語言）→ Kiro（AI 大腦）→ MCP 協議 → Unreal Editor（執行層）
                        ↑
              Kiro Unreal Accelerator Power（智慧層）
              ├── POWER.md        → Kiro 讀取的主文件，定義工具映射與工作流
              ├── steering/       → 8 個領域知識文件，按情境自動載入
              ├── templates/      → 44 個預設範本（Preset、Scaffold、Blueprint 等）
              └── src/            → TypeScript 分析模組（效能、品質、依賴、相容性等）
```

### 三層分工

| 層級 | 角色 | 說明 |
|------|------|------|
| Kiro（AI 大腦） | 理解意圖、規劃策略 | 解析開發者的自然語言指令，決定要呼叫哪些 MCP 工具、以什麼順序執行 |
| Kiro Unreal Accelerator Power（智慧層） | 領域知識、範本、分析邏輯 | 提供 UE5 開發的專業知識（steering files）、預設範本（templates）、分析模組（src） |
| unreal-engine-mcp-server（執行層） | 操控 Unreal Editor | MCP Server，接收 Kiro 的工具呼叫並在 Unreal Editor 中執行實際操作 |

### 專案結構

```
kiro-unreal-accelerator/
├── POWER.md                          # Kiro 讀取的主文件
├── mcp.json                          # MCP Server 連線配置
├── steering/                         # 領域知識 Steering Files（8 個）
│   ├── performance.md
│   ├── architecture.md
│   ├── asset-pipeline.md
│   ├── blueprint-patterns.md
│   ├── ue5-features.md
│   ├── platform-compat.md
│   ├── gas-patterns.md
│   └── ui-patterns.md
├── templates/                        # 預設範本（44 個 JSON 檔案）
│   ├── presets/                      # Asset Preset（7 種）
│   ├── scaffolds/                    # Level Scaffold（4 種）
│   ├── blueprints/                   # Blueprint 範本（6 種）
│   ├── materials/                    # 材質範本（4 種）
│   ├── gas/                          # GAS 範本（5 種）
│   ├── ai/                           # AI 範本（4 種）
│   ├── build-configs/                # 建置配置（3 種）
│   ├── platform-profiles/            # 平台設定檔（5 種）
│   ├── architecture-rules/           # 架構規則（3 種）
│   └── workflows/                    # 工作流範本（3 種）
├── src/                              # TypeScript 分析模組
│   ├── analyzers/                    # 5 個分析器
│   │   ├── AssetAnalyzer.ts
│   │   ├── PerformanceAnalyzer.ts
│   │   ├── CodeQualityAnalyzer.ts
│   │   ├── DependencyAnalyzer.ts
│   │   └── CompatibilityChecker.ts
│   ├── engine/
│   │   └── WorkflowEngine.ts        # 工作流引擎
│   ├── generators/
│   │   └── ReportGenerator.ts        # 報告產生器
│   ├── types/                        # 型別定義
│   ├── utils/                        # 工具模組（MCP 客戶端、快取、日誌、知識管理）
│   ├── __tests__/                    # 測試（287 個）
│   └── index.ts                      # 模組入口
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 疑難排解

| 問題 | 解法 |
|------|------|
| Kiro 無法連線 Unreal | 確認 Unreal Editor 已開啟專案，且 MCP Server 正在執行 |
| MCP Server 啟動失敗 | 確認 `UE_PROJECT_PATH` 環境變數指向正確的 `.uproject` 所在目錄 |
| 資產操作無回應 | Unreal 可能正在編譯 Shader 或載入資產，等待完成後重試 |
| npx 找不到 | 若使用 nvm，在 `mcp.json` 的 `command` 填入 npx 完整路徑 |
| 測試失敗 | 執行 `npm test` 查看詳細錯誤訊息 |
| TypeScript 型別錯誤 | 執行 `npx tsc --noEmit` 檢查，確認 `npm install` 已安裝依賴 |

---

## 授權

MIT License
