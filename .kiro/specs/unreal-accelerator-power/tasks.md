# 實作計畫：Kiro Unreal Accelerator Power

## 概述

將 Kiro Unreal Accelerator Power 的設計轉換為可執行的實作任務。專案使用 TypeScript 實作分析模組，搭配 Markdown/JSON 靜態文件（POWER.md、Steering Files、Templates）。任務按分層架構由底層向上推進：先建立型別與工具層，再實作分析模組，最後組裝靜態文件與整合測試。

## 任務

- [x] 1. 建立專案結構與核心型別定義
  - [x] 1.1 初始化 TypeScript 專案與測試框架
    - 建立 `package.json`、`tsconfig.json`
    - 安裝 `fast-check`、`vitest` 等依賴
    - 建立 `src/` 目錄結構（analyzers/、engine/、generators/、types/、utils/、__tests__/）
    - _需求: 18.1_

  - [x] 1.2 定義核心型別與介面
    - 建立 `src/types/asset.ts`：AssetType、AssetPreset、ValidationRule、RequirementCheck、AssetAnalysisResult、NaniteValidation、ApplyResult
    - 建立 `src/types/analysis.ts`：Issue、Recommendation、Severity、PerformanceReport、PerformanceSummary、AntiPattern、DrawCallAnalysis、MemoryAnalysis、GpuAnalysis、NaniteAnalysis、LumenAnalysis、CodeQualityReport、NamingViolation、CircularDependency、BalanceAnalysis、ArchitectureIssue、CompatibilityIssue、CompatibilityReport、TargetPlatform、DependencyTree、DependencyNode、OrphanedAsset、ChunkDuplicationReport、ImpactAnalysis
    - 建立 `src/types/workflow.ts`：WorkflowDefinition、WorkflowStep、StepCondition、WorkflowResult、StepResult
    - 建立 `src/types/report.ts`：ReportFormat、ReportConfig
    - 建立 `src/types/error.ts`：PowerError
    - _需求: 1.1–1.5, 5.1–5.4, 6.1–6.5, 7.1–7.5, 9.1–9.5, 10.1–10.5, 18.2_

  - [x] 1.3 實作 MCP 客戶端封裝與工具層
    - 建立 `src/utils/mcp-client.ts`：封裝 MCP 工具呼叫（manage_asset、manage_blueprint、control_actor 等）
    - 建立 `src/utils/logger.ts`：統一日誌模組
    - _需求: 18.1_

  - [x] 1.4 實作增量分析快取模組
    - 建立 `src/utils/cache.ts`：AnalysisCache、CachedAnalysis 型別與快取讀寫邏輯
    - 實作檔案雜湊比對、快取命中/失效判斷
    - _需求: 18.3_

  - [ ]* 1.5 撰寫增量分析快取的屬性測試
    - **Property 25: 增量分析效率**
    - 驗證僅變更檔案被重新分析，未變更檔案使用快取
    - **驗證: 需求 18.3**

- [x] 2. 檢查點 - 確認基礎架構
  - 確保所有測試通過，如有問題請詢問使用者。

- [x] 3. 實作 AssetAnalyzer 模組
  - [x] 3.1 實作 AssetAnalyzer 核心邏輯
    - 建立 `src/analyzers/AssetAnalyzer.ts`
    - 實作 `detectAssetType()`：根據資產元資料偵測 AssetType
    - 實作 `validateNaniteCompatibility()`：驗證網格是否符合 Nanite 需求（高面數、無骨骼綁定）
    - 實作 `analyzeAsset()`：分析單一資產並回傳 AssetAnalysisResult
    - 實作 `batchApplyPreset()`：批次套用預設設定，驗證不通過時回傳不相容原因與替代建議
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 3.2 撰寫 AssetAnalyzer 屬性測試 - 預設套用與驗證一致性
    - **Property 1: 資產預設套用與驗證一致性**
    - 隨機生成資產列表與預設設定，驗證通過的資產具有預設值，未通過的回傳原因與替代建議
    - **驗證: 需求 1.1, 1.3, 1.4**

  - [ ]* 3.3 撰寫 AssetAnalyzer 屬性測試 - 類型偵測正確性
    - **Property 2: 資產類型偵測正確性**
    - 隨機生成資產元資料，驗證回傳有效 AssetType 且建議預設與類型相容
    - **驗證: 需求 1.2**

  - [ ]* 3.4 撰寫 AssetAnalyzer 單元測試
    - 測試各資產類型（Texture、StaticMesh、SkeletalMesh、Material、Sound）的預設套用
    - 測試 Nanite 驗證的邊界情況
    - _需求: 1.5_

- [x] 4. 實作 PerformanceAnalyzer 模組
  - [x] 4.1 實作 PerformanceAnalyzer 核心邏輯
    - 建立 `src/analyzers/PerformanceAnalyzer.ts`
    - 實作 `analyzeScene()`：掃描場景並產出 PerformanceReport
    - 實作 `profileDrawCalls()`、`profileMemory()`
    - 實作 `analyzeNaniteUsage()`、`analyzeLumenSettings()`
    - 實作 `detectAntiPatterns()`：偵測過多動態光源、未合併網格、過大貼圖、過高材質指令數、過多 Tick 更新
    - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 4.2 撰寫 PerformanceAnalyzer 屬性測試 - 反模式偵測
    - **Property 10: 效能反模式偵測與建議**
    - 隨機生成場景配置並注入已知反模式，驗證分析器偵測到反模式並提供具體最佳化步驟與預期改善幅度
    - **驗證: 需求 6.3, 6.5, 12.4, 13.5, 15.4**

  - [ ]* 4.3 撰寫 PerformanceAnalyzer 單元測試
    - 測試 Nanite/Lumen 專屬建議
    - 測試過多 Tick 更新偵測
    - _需求: 6.4, 15.5_

- [x] 5. 實作 CodeQualityAnalyzer 模組
  - [x] 5.1 實作 CodeQualityAnalyzer 核心邏輯
    - 建立 `src/analyzers/CodeQualityAnalyzer.ts`
    - 實作 `analyzeProject()`：掃描專案並產出 CodeQualityReport
    - 實作 `checkNamingConventions()`：根據架構規則檢查命名規範
    - 實作 `detectCircularDependencies()`：偵測循環依賴並建議解耦
    - 實作 `analyzeBlueprintCppBalance()`：檢查 Blueprint/C++ 職責分配
    - 實作 `suggestRefactoring()`：提供重構建議
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 5.2 撰寫 CodeQualityAnalyzer 屬性測試 - 命名規範
    - **Property 11: 命名規範檢查**
    - 隨機生成資產名稱，驗證違規識別正確且提供建議名稱
    - **驗證: 需求 7.2**

  - [ ]* 5.3 撰寫 CodeQualityAnalyzer 屬性測試 - 循環依賴
    - **Property 12: 循環依賴偵測**
    - 隨機生成有向依賴圖，驗證所有環路被識別且提供解耦建議
    - **驗證: 需求 7.3**

  - [ ]* 5.4 撰寫 CodeQualityAnalyzer 屬性測試 - 架構問題建議
    - **Property 13: 架構問題建議完整性**
    - 隨機生成架構問題，驗證每個問題都有非空重構建議
    - **驗證: 需求 7.5**

- [x] 6. 實作 DependencyAnalyzer 模組
  - [x] 6.1 實作 DependencyAnalyzer 核心邏輯
    - 建立 `src/analyzers/DependencyAnalyzer.ts`
    - 實作 `buildDependencyTree()`：建立依賴樹
    - 實作 `findOrphanedAssets()`：偵測孤立資產
    - 實作 `analyzeChunkDuplication()`：檢查 Chunk 重複資產
    - 實作 `getImpactAnalysis()`：刪除影響分析
    - 實作 `analyzeWorldPartitionDependencies()`：World Partition Data Layer 依賴分析
    - _需求: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 6.2 撰寫 DependencyAnalyzer 屬性測試 - 依賴樹完整性
    - **Property 16: 依賴樹完整性與影響分析**
    - 隨機生成 DAG，驗證依賴樹包含所有可達節點，影響分析列出所有反向依賴
    - **驗證: 需求 10.1, 10.4**

  - [ ]* 6.3 撰寫 DependencyAnalyzer 屬性測試 - 孤立資產
    - **Property 17: 孤立資產偵測**
    - 隨機生成圖與邊集合，驗證無入邊的非根資產被識別為孤立
    - **驗證: 需求 10.2**

  - [ ]* 6.4 撰寫 DependencyAnalyzer 屬性測試 - Chunk 重複
    - **Property 18: Chunk 重複資產偵測**
    - 隨機生成 Chunk 分配方案，驗證跨 Chunk 重複資產被標記
    - **驗證: 需求 10.3**

  - [ ]* 6.5 撰寫 DependencyAnalyzer 單元測試
    - 測試 Data Layer 依賴分析邊界情況
    - _需求: 10.5_

- [x] 7. 實作 CompatibilityChecker 模組
  - [x] 7.1 實作 CompatibilityChecker 核心邏輯
    - 建立 `src/analyzers/CompatibilityChecker.ts`
    - 實作 `checkPlatform()`：掃描專案並產出 CompatibilityReport
    - 實作 `checkShaderCompatibility()`：檢查 Shader Feature Level / Shader Model 相容性
    - 實作 `checkMemoryBudget()`：驗證記憶體預算
    - 實作 `validateScalabilitySettings()`：驗證 Scalability Settings
    - 確保 Critical 問題時 canBuild 為 false
    - _需求: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 7.2 撰寫 CompatibilityChecker 屬性測試 - 平台相容性
    - **Property 15: 平台相容性檢查與建置阻擋**
    - 隨機生成配置與平台規格，驗證 Shader 不相容與記憶體超出被識別，Critical 問題時 canBuild 為 false
    - **驗證: 需求 9.2, 9.3, 9.4, 9.5**

- [x] 8. 檢查點 - 確認所有分析模組
  - 確保所有測試通過，如有問題請詢問使用者。

- [x] 9. 實作 WorkflowEngine 模組
  - [x] 9.1 實作 WorkflowEngine 核心邏輯
    - 建立 `src/engine/WorkflowEngine.ts`
    - 實作 `defineWorkflow()` / `listWorkflows()`：工作流定義的儲存與列表
    - 實作 `executeWorkflow()`：依序執行步驟，處理 onFailure（stop/skip/retry）
    - 實作條件分支評估邏輯（StepCondition）
    - 實作 `scheduleWorkflow()`：排程功能
    - 實作 `getWorkflowStatus()`：查詢執行狀態
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 9.2 撰寫 WorkflowEngine 屬性測試 - 定義往返
    - **Property 7: 工作流定義儲存往返**
    - 隨機生成工作流定義，驗證儲存後載入等價
    - **驗證: 需求 5.1**

  - [ ]* 9.3 撰寫 WorkflowEngine 屬性測試 - 執行順序與錯誤處理
    - **Property 8: 工作流執行順序與錯誤處理**
    - 隨機生成 N 步驟工作流與失敗位置，驗證產出 N 個結果且 stop 時後續步驟不執行
    - **驗證: 需求 5.2, 5.3**

  - [ ]* 9.4 撰寫 WorkflowEngine 屬性測試 - 條件分支
    - **Property 9: 工作流條件分支**
    - 隨機生成條件與步驟結果，驗證條件評估正確
    - **驗證: 需求 5.4**

- [x] 10. 實作 ReportGenerator 模組
  - [x] 10.1 實作 ReportGenerator 核心邏輯
    - 建立 `src/generators/ReportGenerator.ts`
    - 實作 `generateAssetReport()`、`generatePerformanceReport()`、`generateCodeQualityReport()`、`generateCompatibilityReport()`
    - 實作 `generateDashboard()`：產出儀表板
    - 支援 JSON 與 Markdown 兩種輸出格式
    - _需求: 18.2, 18.4_

  - [ ]* 10.2 撰寫 ReportGenerator 屬性測試 - 報告完整性
    - **Property 5: 分析報告完整性**
    - 隨機生成分析結果，驗證報告包含所有必要欄位，JSON 為有效 JSON，Markdown 為有效 Markdown
    - **驗證: 需求 3.2, 4.2, 6.2, 18.2**

  - [ ]* 10.3 撰寫 ReportGenerator 屬性測試 - 建置錯誤解析
    - **Property 6: 建置錯誤解析**
    - 隨機生成建置錯誤訊息，驗證回傳非空修復建議且包含具體步驟
    - **驗證: 需求 3.4**

- [x] 11. 實作模組入口與整合
  - [x] 11.1 建立模組入口 `src/index.ts`
    - 匯出所有分析模組、引擎、生成器
    - 整合 MCP 客戶端初始化邏輯
    - _需求: 18.1_

  - [ ]* 11.2 撰寫自訂分析規則屬性測試
    - **Property 26: 自訂分析規則套用**
    - 隨機生成自訂規則定義，驗證分析器套用規則並在結果中反映
    - **驗證: 需求 18.5**

- [x] 12. 檢查點 - 確認所有 TypeScript 模組
  - 確保所有測試通過，如有問題請詢問使用者。

- [x] 13. 建立 Steering Files
  - [x] 13.1 建立效能與架構 Steering Files
    - 建立 `steering/performance.md`：Draw Call 最佳化、記憶體管理、GPU 最佳化、常見反模式
    - 建立 `steering/architecture.md`：Blueprint vs C++ 職責分配、模組化設計、命名規範
    - _需求: 16.1, 16.2, 16.4_

  - [x] 13.2 建立資產管線與 Blueprint Steering Files
    - 建立 `steering/asset-pipeline.md`：資產匯入流程、貼圖設定、網格設定、音訊設定
    - 建立 `steering/blueprint-patterns.md`：Blueprint 設計模式、常見反模式、最佳實踐
    - _需求: 16.1, 16.2, 16.4_

  - [x] 13.3 建立 UE5 特性與平台相容性 Steering Files
    - 建立 `steering/ue5-features.md`：Nanite、Lumen、World Partition、Control Rig 指引
    - 建立 `steering/platform-compat.md`：各平台限制、Shader Model 對照、記憶體預算
    - _需求: 16.1, 16.2, 16.4_

  - [x] 13.4 建立 GAS 與 UI Steering Files
    - 建立 `steering/gas-patterns.md`：Ability/Effect/Attribute 設計模式、Tag 系統
    - 建立 `steering/ui-patterns.md`：Widget 設計模式、Common UI 整合、效能注意事項
    - _需求: 16.1, 16.2, 16.4_

  - [ ]* 13.5 撰寫 Steering File 載入屬性測試
    - **Property 22: Steering File 載入**
    - 隨機生成有效 Steering File，驗證系統能成功載入並解析
    - **驗證: 需求 16.1**

- [x] 14. 建立 Templates - 資產預設與關卡腳手架
  - [x] 14.1 建立資產預設範本
    - 建立 `templates/presets/` 下所有 JSON 範本：texture-2d-diffuse、texture-2d-normal、static-mesh-nanite、static-mesh-standard、skeletal-mesh-character、material-pbr、sound-sfx
    - 每個範本包含 settings、validations、requirements 欄位
    - _需求: 1.5, 17.1_

  - [x] 14.2 建立關卡腳手架範本
    - 建立 `templates/scaffolds/` 下所有 JSON 範本：open-world、linear-level、arena、interior
    - 包含 worldPartition、dataLayers、actors、folders 設定
    - _需求: 2.1, 2.4, 17.1_

  - [ ]* 14.3 撰寫關卡腳手架屬性測試
    - **Property 3: 關卡腳手架生成完整性**
    - 隨機生成關卡範本定義，驗證產出包含所有 Actor、設定與資料夾，命名符合規範
    - **驗證: 需求 2.1, 2.3**

  - [ ]* 14.4 撰寫外掛依賴檢查屬性測試
    - **Property 4: 外掛依賴檢查**
    - 隨機生成含外掛需求的範本，驗證缺失外掛時回傳明確提示
    - **驗證: 需求 2.5**

- [x] 15. 建立 Templates - Blueprint、材質與 GAS 範本
  - [x] 15.1 建立 Blueprint 範本
    - 建立 `templates/blueprints/` 下所有 JSON 範本：character-base、actor-interactable、component-health、widget-hud、gamemode-base、ai-controller
    - 每個範本包含 components、variables、functions、events 欄位
    - _需求: 11.1, 11.2, 11.3, 11.4, 17.1_

  - [x] 15.2 建立材質範本
    - 建立 `templates/materials/` 下所有 JSON 範本：pbr-standard、pbr-subsurface、landscape-blend、vfx-translucent
    - 每個範本包含 parameters、nodes 欄位
    - _需求: 12.1, 12.2, 17.1_

  - [x] 15.3 建立 GAS 範本
    - 建立 `templates/gas/` 下所有 JSON 範本：ability-melee、ability-projectile、effect-damage、effect-buff、attribute-set-base
    - 每個範本包含 Tag 設定、Effect 參數
    - _需求: 14.1, 14.2, 14.3, 17.1_

  - [ ]* 15.4 撰寫範本生成完整性屬性測試
    - **Property 19: 範本生成完整性**
    - 隨機生成元件類型，驗證範本包含該類型定義的所有必要元素
    - **驗證: 需求 11.1, 11.4, 12.1, 13.4, 14.4, 15.1**

  - [ ]* 15.5 撰寫材質實例批次建立屬性測試
    - **Property 20: 材質實例批次建立**
    - 隨機生成材質與參數覆寫，驗證批次建立的實例具有正確參數值
    - **驗證: 需求 12.3**

  - [ ]* 15.6 撰寫 GAS 一致性檢查屬性測試
    - **Property 21: GAS 設定一致性檢查**
    - 隨機生成 GAS 配置，驗證 Tag 衝突與矛盾 Effect 被偵測
    - **驗證: 需求 14.5**

- [x] 16. 建立 Templates - AI、建置、平台、架構規則與工作流範本
  - [x] 16.1 建立 AI 範本
    - 建立 `templates/ai/` 下所有 JSON 範本：behavior-tree-patrol、behavior-tree-combat、blackboard-npc、eqs-find-cover
    - _需求: 13.1, 13.2, 13.3, 13.4, 17.1_

  - [x] 16.2 建立建置配置、平台設定與架構規則範本
    - 建立 `templates/build-configs/`：development、shipping、test
    - 建立 `templates/platform-profiles/`：windows、ps5、xbox-series-x、ios、android
    - 建立 `templates/architecture-rules/`：naming-conventions、folder-structure、dependency-rules
    - _需求: 3.3, 8.5, 17.1_

  - [x] 16.3 建立工作流範本
    - 建立 `templates/workflows/`：asset-import-pipeline、build-and-test、performance-audit
    - _需求: 5.1, 17.1_

  - [ ]* 16.4 撰寫範本客製化與版本相容性屬性測試
    - **Property 23: 範本客製化與版本相容性**
    - 隨機生成範本與專案設定，驗證客製化輸出反映設定，版本驗證正確，棄用 API 被標記
    - **驗證: 需求 17.2, 17.4, 17.5**

  - [ ]* 16.5 撰寫自訂範本儲存往返屬性測試
    - **Property 24: 自訂範本儲存往返**
    - 隨機生成自訂範本，驗證儲存後載入等價
    - **驗證: 需求 17.3**

- [x] 17. 檢查點 - 確認所有範本與 Steering Files
  - 確保所有測試通過，如有問題請詢問使用者。

- [x] 18. 建立知識管理與文件系統
  - [x] 18.1 實作知識管理功能
    - 在適當模組中實作文件儲存、檢索、過期偵測邏輯
    - 實作 API 變更追蹤與受影響程式碼標記
    - _需求: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 18.2 撰寫文件過期偵測屬性測試
    - **Property 14: 文件過期偵測**
    - 隨機生成文件與時間戳，驗證超過閾值的文件被標記為過期
    - **驗證: 需求 8.3**

  - [ ]* 18.3 撰寫知識文件儲存往返屬性測試
    - **Property 27: 知識文件儲存往返**
    - 隨機生成文件，驗證儲存後查詢回傳等價內容
    - **驗證: 需求 8.1**

- [x] 19. 建立 POWER.md 主入口文件與 MCP 配置
  - [x] 19.1 建立 POWER.md
    - 撰寫能力宣告、MCP 工具映射表、Steering Files 索引、Templates 索引
    - 定義意圖識別與路由規則
    - 整合所有 Steering Files 與 Templates 的參照
    - _需求: 16.1, 16.3, 16.5, 17.1_

  - [x] 19.2 建立 MCP 連線配置
    - 建立 `mcp.json`：定義 Unreal Engine MCP Server 連線設定
    - _需求: 18.1_

- [x] 20. 最終整合與驗證
  - [x] 20.1 整合所有模組並驗證端對端流程
    - 確保 POWER.md 正確參照所有 Steering Files 與 Templates
    - 確保 TypeScript 模組入口正確匯出所有分析器
    - 驗證 MCP 工具映射表覆蓋所有 35 個工具
    - _需求: 1.1–18.5_

  - [ ]* 20.2 撰寫整合層屬性測試
    - 驗證跨模組整合的正確性
    - _需求: 18.1_

- [x] 21. 最終檢查點 - 確保所有測試通過
  - 確保所有測試通過，如有問題請詢問使用者。

## 備註

- 標記 `*` 的任務為選擇性任務，可跳過以加速 MVP 開發
- 每個任務參照具體需求以確保可追溯性
- 檢查點確保增量驗證
- 屬性測試驗證通用正確性屬性（共 27 個 Property）
- 單元測試驗證具體範例與邊界情況
- 所有 TypeScript 程式碼使用 fast-check 進行屬性測試、vitest 進行單元測試
