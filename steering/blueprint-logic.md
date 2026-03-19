# Blueprint 邏輯生成工作流指南

本文件定義 Kiro Power 中 Blueprint 邏輯生成的通用工作流與最佳實踐。

---

## 核心概念

BlueprintManager 解決的痛點：
- AI 只能生 C++ code，無法直接操作 Blueprint 節點圖
- BP 原型轉 C++ 時 reference 更新是噩夢
- AI 直接在 BP 裡建好節點、連好線，開發者不用再走「BP → C++」的轉換路

BlueprintManager 提供五大通用能力：

| 能力 | 說明 | 對應方法 |
|------|------|---------|
| 建立 Blueprint | 從零建立完整 BP（元件、變數、函數） | `createBlueprint()` |
| 模板生成 | 從 JSON 模板一鍵生成 BP 結構 | `createFromTemplate()` |
| 節點圖操作 | 在圖中建立節點並連線 | `buildGraphLogic()` |
| 查詢檢查 | 取得 BP 資訊、圖詳情、節點詳情 | `getBlueprintInfo()` / `getGraphDetails()` |
| 編譯驗證 | 編譯 BP 並檢查錯誤 | `compileBlueprint()` |

---

## 工作流模式

### 模式 1：從模板建立（最常用）

適用於：建立標準的角色、互動物件、GameMode 等

```
1. 讀取模板 templates/blueprints/*.json
2. createFromTemplate({ template, path })  → 建立 BP 結構
3. buildGraphLogic(bp, eventGraphLogic)    → 填入事件邏輯
4. compileBlueprint(bp)                    → 編譯驗證
```

### 模式 2：從零建立

適用於：自訂結構的 Blueprint

```
1. createBlueprint({ name, path, parentClass, variables, functions, components })
2. buildGraphLogic(bp, graphLogic)  → 建立節點邏輯
3. compileBlueprint(bp)
```

### 模式 3：修改現有 Blueprint

適用於：在已有的 BP 上加入新邏輯

```
1. getBlueprintInfo(bp)              → 確認 BP 存在
2. addVariable(bp, variable)         → 加變數
3. addFunction(bp, func)             → 加函數
4. buildGraphLogic(bp, newLogic)     → 加入新的節點邏輯
5. compileBlueprint(bp)
```

### 模式 4：建立完整邏輯圖

適用於：在 Event Graph 或函數圖中建立一段完整的邏輯

```
buildGraphLogic(bp, {
  graphName: "EventGraph",
  nodes: [
    { nodeType: "K2Node_Event", name: "BeginPlay", memberName: "ReceiveBeginPlay" },
    { nodeType: "K2Node_CallFunction", name: "PrintHello", memberClass: "KismetSystemLibrary", memberName: "PrintString" },
  ],
  connections: [
    { fromNodeId: "BeginPlay", fromPin: "Then", toNodeId: "PrintHello", toPin: "Execute" },
  ],
})
```

節點名稱在 connections 中會自動解析為實際的 nodeId。

---

## MCP 工具對應

BlueprintManager 內部使用以下 MCP 工具：

| 操作 | MCP 工具 | Action |
|------|---------|--------|
| 建立 Blueprint | `manage_blueprint` | `create` |
| 加入 SCS 元件 | `manage_blueprint` | `add_scs_component` |
| 設定元件屬性 | `manage_blueprint` | `set_scs_property` |
| 加入變數 | `manage_blueprint` | `add_variable` |
| 加入函數 | `manage_blueprint` | `add_function` |
| 加入事件 | `manage_blueprint` | `add_event` |
| 建立節點 | `manage_blueprint` | `add_node` |
| 連接 Pin | `manage_blueprint` | `connect_pins` |
| 設定 Pin 預設值 | `manage_blueprint` | `set_pin_default_value` |
| 刪除節點 | `manage_blueprint` | `delete_node` |
| 取得圖詳情 | `manage_blueprint` | `get_graph_details` |
| 取得節點詳情 | `manage_blueprint` | `get_node_details` |
| 列出節點類型 | `manage_blueprint` | `list_node_types` |
| 編譯 | `manage_blueprint` | `compile` |

---

## 常見節點類型速查

| 節點類型 | 用途 | 常用 Pin |
|---------|------|---------|
| `K2Node_Event` | 事件節點（BeginPlay, Tick 等） | Then (exec out) |
| `K2Node_CallFunction` | 函數呼叫 | Execute (exec in), Then (exec out) |
| `K2Node_IfThenElse` | Branch 條件分支 | Condition (bool in), True/False (exec out) |
| `K2Node_VariableGet` | 取得變數值 | 變數名稱 (data out) |
| `K2Node_VariableSet` | 設定變數值 | Execute (exec in), 變數名稱 (data in) |
| `K2Node_CustomEvent` | 自訂事件 | Then (exec out) |
| `K2Node_FunctionEntry` | 函數入口 | Then (exec out) |
| `K2Node_FunctionResult` | 函數回傳 | Execute (exec in) |
| `K2Node_MacroInstance` | Macro 實例 | 依 Macro 定義 |
| `K2Node_Timeline` | Timeline 節點 | Play/Stop (exec in), Update/Finished (exec out) |
| `K2Node_SpawnActorFromClass` | 生成 Actor | Execute (exec in), Class (class in) |
| `K2Node_DynamicCast` | 動態 Cast | Object (object in), As XXX (object out) |

---

## 常見 memberClass 速查

| 類別 | 常用函數 |
|------|---------|
| `KismetSystemLibrary` | PrintString, Delay, SetTimer, IsValid, GetDisplayName |
| `KismetMathLibrary` | Add, Subtract, Multiply, Clamp, Lerp, RandomFloat |
| `KismetStringLibrary` | Concat, Contains, Replace, ToUpper, ToLower |
| `GameplayStatics` | GetPlayerCharacter, GetPlayerController, OpenLevel, SpawnSound |
| `KismetArrayLibrary` | Array_Add, Array_Remove, Array_Length, Array_Contains |
| `Actor` | GetActorLocation, SetActorLocation, Destroy, GetComponentByClass |
| `CharacterMovementComponent` | SetMovementMode, GetMaxSpeed |

---

## 故障排除

| 問題 | 原因 | 解決方案 |
|------|------|---------|
| 節點建立失敗 | nodeType 名稱不正確 | 用 `listNodeTypes()` 查詢可用類型 |
| 連線失敗 | Pin 名稱不正確 | 用 `getNodeDetails()` 查詢節點的 Pin 列表 |
| 編譯失敗 | 節點連線不完整或類型不匹配 | 檢查所有必要的 exec 和 data 連線 |
| 模板套用後缺少元件 | isDefault 元件被跳過 | isDefault 元件是引擎預設的，不需要手動建立 |
| 函數參數類型錯誤 | UE 型別名稱不匹配 | 使用 UE 標準型別名：Float, Integer, Boolean, Vector, String |
