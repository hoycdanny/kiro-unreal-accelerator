# 需求文件

## 簡介

Kiro Unreal Accelerator Power 是一個專為 Unreal Engine 開發者設計的智慧加速工具。透過整合 Unreal Engine MCP（35 個可用工具），讓 Kiro 成為 Unreal Engine 開發的智慧大腦，開發者可以使用自然語言下達指令操控 Unreal Editor，大幅提升開發效率。

本專案參考 Unity 版本（kiro-unity-accelerator）的架構，但針對 Unreal Engine 的特性（Blueprint、Nanite、Lumen、World Partition、GAS 等）進行調整與優化。

## 詞彙表

- **Accelerator_Power**: Kiro 的擴展功能模組，提供領域知識、範本與分析工具
- **Steering_File**: 提供 Kiro 領域知識的指引文件，幫助 AI 理解特定領域的最佳實踐
- **MCP_Tool**: Unreal Engine MCP 提供的工具，用於操控 Unreal Editor
- **Blueprint_System**: Unreal Engine 的視覺化腳本系統
- **Nanite**: Unreal Engine 5 的虛擬化幾何系統，支援電影級資產
- **Lumen**: Unreal Engine 5 的全域光照與反射系統
- **World_Partition**: Unreal Engine 的大型世界分區串流系統
- **GAS**: Gameplay Ability System，Unreal Engine 的遊戲能力框架
- **Asset_Analyzer**: 資產分析模組，負責資產依賴與相容性檢查
- **Performance_Analyzer**: 效能分析模組，負責效能瓶頸偵測與最佳化建議
- **Code_Quality_Analyzer**: 程式碼品質分析模組，負責架構檢查與反模式偵測
- **Workflow_Engine**: 工作流引擎，負責多步驟任務的自動化執行

## 需求

### 需求 1：資產設定自動化

**使用者故事：** 身為 Unreal 開發者，我想要批次套用資產預設設定，以便快速統一專案資產的匯入設定。

#### 驗收條件

1. WHEN 使用者指定資產類型與預設設定，THE Asset_Configurator SHALL 批次套用設定至所有符合條件的資產
2. WHEN 資產被匯入專案，THE Asset_Detector SHALL 自動偵測資產類型並建議適當的預設設定
3. WHEN 套用 Nanite 設定至靜態網格，THE Asset_Configurator SHALL 驗證網格是否符合 Nanite 需求
4. IF 資產不符合預設設定的需求，THEN THE Asset_Configurator SHALL 回報不相容原因並提供替代建議
5. THE Asset_Configurator SHALL 支援 Texture、Static Mesh、Skeletal Mesh、Material、Sound 等資產類型的預設設定

### 需求 2：關卡建置加速

**使用者故事：** 身為關卡設計師，我想要從範本一鍵生成關卡結構，以便快速建立標準化的關卡框架。

#### 驗收條件

1. WHEN 使用者選擇關卡範本，THE Level_Scaffolder SHALL 生成完整的關卡結構包含必要的 Actor 與設定
2. WHEN 使用 World Partition 範本，THE Level_Scaffolder SHALL 自動設定分區網格與串流距離
3. WHEN 生成關卡結構，THE Level_Scaffolder SHALL 建立標準的資料夾階層與命名規範
4. THE Level_Scaffolder SHALL 提供多種預設範本包含開放世界、線性關卡、競技場等類型
5. IF 關卡範本需要特定外掛，THEN THE Level_Scaffolder SHALL 檢查外掛是否啟用並提示使用者

### 需求 3：建置自動化

**使用者故事：** 身為開發者，我想要一鍵執行本地建置，以便快速產出可測試的遊戲版本。

#### 驗收條件

1. WHEN 使用者觸發建置指令，THE Build_Automator SHALL 執行完整的建置流程並回報進度
2. WHEN 建置完成，THE Build_Automator SHALL 產出建置報告包含檔案大小、建置時間與警告統計
3. THE Build_Automator SHALL 支援 Windows、Mac、Linux、iOS、Android、主機平台的建置設定
4. IF 建置過程發生錯誤，THEN THE Build_Automator SHALL 解析錯誤訊息並提供修復建議
5. WHERE 使用者啟用 Shader 預編譯，THE Build_Automator SHALL 執行目標平台的 Shader 編譯

### 需求 4：跨平台測試

**使用者故事：** 身為 QA 工程師，我想要在本地模擬不同平台的執行環境，以便快速驗證跨平台相容性。

#### 驗收條件

1. WHEN 使用者指定目標平台，THE Platform_Tester SHALL 模擬該平台的執行環境進行測試
2. WHEN 測試完成，THE Platform_Tester SHALL 產出測試報告包含效能數據與相容性問題
3. THE Platform_Tester SHALL 支援模擬不同的記憶體限制、GPU 功能等級與輸入裝置
4. IF 偵測到平台特定問題，THEN THE Platform_Tester SHALL 標記問題嚴重度並提供修復建議
5. THE Platform_Tester SHALL 驗證 Scalability Settings 在不同品質等級下的表現

### 需求 5：工作流自動化

**使用者故事：** 身為技術美術，我想要定義多步驟工作流並自動執行，以便減少重複性操作。

#### 驗收條件

1. WHEN 使用者定義工作流步驟，THE Workflow_Engine SHALL 儲存工作流定義供後續執行
2. WHEN 使用者觸發工作流，THE Workflow_Engine SHALL 依序執行所有步驟並回報每步驟的結果
3. IF 工作流步驟執行失敗，THEN THE Workflow_Engine SHALL 暫停執行並提供錯誤詳情與復原選項
4. THE Workflow_Engine SHALL 支援條件分支讓工作流根據前一步驟結果決定後續動作
5. THE Workflow_Engine SHALL 支援排程執行讓工作流在指定時間自動觸發

### 需求 6：效能分析

**使用者故事：** 身為效能工程師，我想要分析專案的效能瓶頸，以便針對性地進行最佳化。

#### 驗收條件

1. WHEN 使用者觸發效能分析，THE Performance_Analyzer SHALL 掃描專案並識別效能瓶頸
2. WHEN 分析完成，THE Performance_Analyzer SHALL 產出報告包含 Draw Call 統計、記憶體使用與 GPU 時間
3. THE Performance_Analyzer SHALL 偵測常見的效能反模式包含過多動態光源、未合併網格、過大貼圖等
4. THE Performance_Analyzer SHALL 針對 Nanite 與 Lumen 提供專屬的效能建議
5. IF 偵測到效能問題，THEN THE Performance_Analyzer SHALL 提供具體的最佳化步驟與預期改善幅度

### 需求 7：程式碼品質

**使用者故事：** 身為程式設計師，我想要檢查程式碼架構與品質，以便維持專案的可維護性。

#### 驗收條件

1. WHEN 使用者觸發程式碼檢查，THE Code_Quality_Analyzer SHALL 掃描 C++ 與 Blueprint 程式碼
2. THE Code_Quality_Analyzer SHALL 檢查是否遵循 Unreal Engine 編碼規範包含命名慣例與註解標準
3. THE Code_Quality_Analyzer SHALL 偵測循環依賴並建議解耦方案
4. THE Code_Quality_Analyzer SHALL 檢查 Blueprint 與 C++ 的職責分配是否合理
5. IF 偵測到架構問題，THEN THE Code_Quality_Analyzer SHALL 提供重構建議與範例程式碼

### 需求 8：知識管理

**使用者故事：** 身為團隊主管，我想要集中管理團隊文件與 API 變更，以便團隊成員快速取得最新資訊。

#### 驗收條件

1. THE Knowledge_Manager SHALL 提供團隊文件的集中儲存與檢索功能
2. WHEN Unreal Engine 版本更新，THE Knowledge_Manager SHALL 追蹤 API 變更並標記受影響的程式碼
3. THE Knowledge_Manager SHALL 偵測過期的文件並提醒維護者更新
4. WHEN 使用者查詢特定功能，THE Knowledge_Manager SHALL 回傳相關的文件、範例與最佳實踐
5. THE Knowledge_Manager SHALL 整合 Steering File 提供 Unreal Engine 特定領域的知識指引

### 需求 9：平台相容性

**使用者故事：** 身為跨平台開發者，我想要檢查資產與程式碼的平台相容性，以便提前發現相容性問題。

#### 驗收條件

1. WHEN 使用者觸發相容性檢查，THE Compatibility_Checker SHALL 掃描專案並識別平台特定問題
2. THE Compatibility_Checker SHALL 檢查 Shader 在不同平台的相容性包含 Feature Level 與 Shader Model
3. THE Compatibility_Checker SHALL 驗證記憶體使用是否符合目標平台的預算限制
4. THE Compatibility_Checker SHALL 將問題分為三級嚴重度：Critical、Warning、Info
5. IF 偵測到 Critical 問題，THEN THE Compatibility_Checker SHALL 阻止建置並要求修復

### 需求 10：資產依賴管理

**使用者故事：** 身為資產管理員，我想要視覺化資產依賴關係，以便管理資產的組織與打包。

#### 驗收條件

1. WHEN 使用者查詢資產依賴，THE Dependency_Analyzer SHALL 產出依賴樹顯示所有直接與間接依賴
2. THE Dependency_Analyzer SHALL 偵測孤立資產並建議刪除或重新連結
3. THE Dependency_Analyzer SHALL 檢查 Chunk 分配是否有重複資產造成包體膨脹
4. WHEN 使用者計畫刪除資產，THE Dependency_Analyzer SHALL 列出所有受影響的參照
5. THE Dependency_Analyzer SHALL 支援 World Partition 的 Data Layer 依賴分析

### 需求 11：Blueprint 工具鏈

**使用者故事：** 身為 Blueprint 開發者，我想要快速生成常用的 Blueprint 範本，以便加速開發流程。

#### 驗收條件

1. WHEN 使用者指定 Blueprint 類型，THE Blueprint_Generator SHALL 生成符合最佳實踐的 Blueprint 範本
2. THE Blueprint_Generator SHALL 支援 Actor、Component、Widget、AnimInstance、GameMode 等類型
3. THE Blueprint_Generator SHALL 生成 GAS 相關的 Blueprint 包含 Ability、Effect、Cue 等
4. WHEN 生成 Blueprint，THE Blueprint_Generator SHALL 自動建立必要的函數、變數與事件綁定
5. THE Blueprint_Generator SHALL 提供 Blueprint 與 C++ 混合架構的範本與指引

### 需求 12：材質工作流

**使用者故事：** 身為技術美術，我想要快速建立標準化的材質，以便維持專案的視覺一致性。

#### 驗收條件

1. WHEN 使用者指定材質類型，THE Material_Workflow SHALL 生成符合專案規範的材質範本
2. THE Material_Workflow SHALL 支援 PBR、Subsurface、Cloth、Hair 等材質類型
3. THE Material_Workflow SHALL 提供 Material Instance 的批次建立與參數設定
4. THE Material_Workflow SHALL 檢查材質複雜度並提供 Shader 指令數最佳化建議
5. IF 材質使用過多貼圖取樣，THEN THE Material_Workflow SHALL 建議使用 Virtual Texture 或合併貼圖

### 需求 13：AI 系統輔助

**使用者故事：** 身為遊戲設計師，我想要快速建立 AI 行為，以便實現複雜的 NPC 邏輯。

#### 驗收條件

1. WHEN 使用者描述 AI 行為需求，THE AI_Assistant SHALL 生成對應的 Behavior Tree 結構
2. THE AI_Assistant SHALL 支援生成 Blackboard、Task、Decorator、Service 等 AI 元件
3. THE AI_Assistant SHALL 提供 EQS（Environment Query System）查詢的範本與設定
4. WHEN 生成 AI 系統，THE AI_Assistant SHALL 自動設定 AI Controller 與 Navigation 相關元件
5. THE AI_Assistant SHALL 檢查 AI 系統的效能影響並提供最佳化建議

### 需求 14：GAS 整合

**使用者故事：** 身為戰鬥系統設計師，我想要快速建立 Gameplay Ability System 元件，以便實現複雜的技能系統。

#### 驗收條件

1. WHEN 使用者描述技能需求，THE GAS_Integrator SHALL 生成對應的 Gameplay Ability Blueprint
2. THE GAS_Integrator SHALL 支援生成 Gameplay Effect、Gameplay Cue、Attribute Set 等元件
3. THE GAS_Integrator SHALL 提供技能連招、冷卻、消耗等常見機制的範本
4. WHEN 生成 GAS 元件，THE GAS_Integrator SHALL 自動設定 Ability System Component 與 Tag 系統
5. THE GAS_Integrator SHALL 檢查 GAS 設定的一致性並偵測潛在的衝突

### 需求 15：UI Widget 工具鏈

**使用者故事：** 身為 UI 設計師，我想要快速建立標準化的 UI Widget，以便維持介面的一致性。

#### 驗收條件

1. WHEN 使用者指定 UI 類型，THE Widget_Toolchain SHALL 生成符合專案規範的 Widget Blueprint
2. THE Widget_Toolchain SHALL 支援 HUD、Menu、Dialog、Inventory 等常見 UI 類型
3. THE Widget_Toolchain SHALL 提供 Common UI 框架的整合範本
4. THE Widget_Toolchain SHALL 檢查 UI 的效能影響包含 Widget 數量與更新頻率
5. IF UI 使用過多的 Tick 更新，THEN THE Widget_Toolchain SHALL 建議使用事件驅動或 Timer 替代

### 需求 16：Steering File 系統

**使用者故事：** 身為團隊架構師，我想要定義專案的開發規範與最佳實踐，以便 Kiro 能夠提供符合團隊標準的建議。

#### 驗收條件

1. THE Steering_System SHALL 載入專案定義的 Steering File 作為 Kiro 的領域知識
2. THE Steering_System SHALL 支援多個 Steering File 涵蓋不同領域包含效能、架構、資產等
3. WHEN Kiro 提供建議，THE Steering_System SHALL 確保建議符合 Steering File 定義的規範
4. THE Steering_System SHALL 提供預設的 Unreal Engine 最佳實踐 Steering File
5. THE Steering_System SHALL 支援 Steering File 的版本控制與團隊共享

### 需求 17：範本系統

**使用者故事：** 身為開發者，我想要使用預設範本快速建立常用元件，以便減少重複性工作。

#### 驗收條件

1. THE Template_System SHALL 提供多種預設範本涵蓋 Blueprint、Material、Level、UI 等類型
2. WHEN 使用者選擇範本，THE Template_System SHALL 根據專案設定客製化範本內容
3. THE Template_System SHALL 支援使用者自訂範本並儲存供團隊共享
4. THE Template_System SHALL 驗證範本與當前 Unreal Engine 版本的相容性
5. IF 範本使用已棄用的 API，THEN THE Template_System SHALL 提示使用者並建議替代方案

### 需求 18：分析工具模組

**使用者故事：** 身為技術主管，我想要使用 TypeScript 工具模組進行深度分析，以便取得詳細的專案健康報告。

#### 驗收條件

1. THE Analysis_Module SHALL 提供 TypeScript 實作的分析工具包含資產、效能、程式碼品質分析
2. THE Analysis_Module SHALL 產出結構化的分析報告支援 JSON 與 Markdown 格式
3. THE Analysis_Module SHALL 支援增量分析只處理變更的檔案以提升效率
4. WHEN 分析完成，THE Analysis_Module SHALL 提供可視化的儀表板顯示專案健康狀態
5. THE Analysis_Module SHALL 支援自訂分析規則讓團隊定義專案特定的檢查項目
