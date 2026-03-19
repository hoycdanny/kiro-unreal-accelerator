# 材質管理工作流指南

本文件定義 Kiro Power 中材質管理的通用工作流與最佳實踐。

---

## 核心概念

MaterialManager 提供四大通用能力：

| 能力 | 說明 | 對應方法 |
|------|------|---------|
| 搜尋材質 | 探索專案中所有可用材質 | `searchMaterials()` |
| 套用材質 | 將材質套用到 Actor | `applyMaterialToActor()` / `batchApplyMaterial()` |
| 建立材質 | 建立新材質或材質實例 | `createMaterial()` / `createMaterialInstance()` |
| 替換材質 | 批次替換場景中的材質 | `replaceMaterial()` |

---

## 工作流模式

### 模式 1：搜尋並套用（最常用）

適用於：使用者想把某些物件換成特定材質

```
1. searchMaterials({ keyword: "grass" })     → 找到可用的草皮材質
2. findActors({ tag: "ground" })             → 找到地面 Actor
3. batchApplyMaterial(actors, { materialPath }) → 批次套用
```

### 模式 2：建立並套用

適用於：專案中沒有需要的材質，需要先建立

```
1. createMaterial({ name, baseColor, roughness }) → 建立新材質
2. findActors(...)                                → 找到目標 Actor
3. batchApplyMaterial(actors, { materialPath })   → 批次套用
```

### 模式 3：材質實例變體

適用於：基於現有材質建立顏色/參數變體

```
1. searchMaterials(...)                           → 找到父材質
2. createMaterialInstance({ parentMaterial, ... }) → 建立實例
3. batchApplyMaterial(actors, { materialPath })   → 套用實例
```

### 模式 4：全場景材質替換

適用於：將場景中所有使用材質 A 的物件換成材質 B

```
1. findActors({ currentMaterial: "old_material" }) → 找到使用舊材質的 Actor
2. replaceMaterial(actors, oldPath, newPath)        → 批次替換
```

---

## MCP 工具對應

MaterialManager 內部使用以下 MCP 工具：

| 操作 | 主要工具 | 輔助工具 |
|------|---------|---------|
| 搜尋材質 | `manage_asset` (search_assets) | `inspect` |
| 取得材質資訊 | `manage_material_authoring` (get_material_info) | `inspect` (get_material_details) |
| 套用材質到 Actor | `control_actor` (set_component_property) | — |
| 建立材質 | `manage_material_authoring` (create_material) | `manage_asset` (connect_material_pins) |
| 建立材質實例 | `manage_material_authoring` (create_material_instance) | — |
| 編譯材質 | `manage_material_authoring` (compile_material) | — |

---

## MCP API 注意事項

### 連接材質節點到主輸出

連接到材質結果節點（Base Color、Roughness 等）時，使用 `manage_asset` 的 `connect_material_pins`，
只需指定 `fromNodeId` 和 `toPin`，不需要 `toNodeId`：

```
manage_asset.connect_material_pins({
  assetPath: "/Game/Path/M_Material",
  fromNodeId: "節點ID",
  toPin: "Base Color"    // 或 "Roughness", "Normal", "Metallic" 等
})
```

### 連接兩個節點之間

連接兩個普通節點時，需要指定 `fromNodeId`、`toNodeId` 和 `toPin`：

```
manage_asset.connect_material_pins({
  assetPath: "/Game/Path/M_Material",
  fromNodeId: "來源節點ID",
  toNodeId: "目標節點ID",
  toPin: "Coordinates"   // 或 "A", "B", "Alpha" 等
})
```

### 材質實例 vs 材質

- `get_material_info` 只能用於 Material，不能用於 MaterialInstanceConstant
- 查詢 MaterialInstance 資訊需要用 `inspect` 的 `get_material_details`

---

## 常見材質類型速查

| 場景 | 建議材質設定 |
|------|------------|
| 草地 | BaseColor: 深淺綠混合, Roughness: 0.8-0.9, Normal: 有 |
| 石頭 | BaseColor: 灰色系, Roughness: 0.7-0.9, Normal: 強 |
| 金屬 | BaseColor: 暗色, Metallic: 0.9-1.0, Roughness: 0.1-0.4 |
| 木材 | BaseColor: 棕色系, Roughness: 0.6-0.8, Normal: 中等 |
| 水面 | BlendMode: Translucent, Roughness: 0.0-0.1, Metallic: 0 |
| 玻璃 | BlendMode: Translucent, Roughness: 0.0, Opacity: 0.1-0.3 |

---

## 故障排除

| 問題 | 原因 | 解決方案 |
|------|------|---------|
| 材質套用後看不到變化 | OverrideMaterials 索引錯誤 | 使用 `overrideAllSlots: true` |
| 搜尋不到材質 | 搜尋路徑不正確 | 確認 searchPaths 包含正確的資料夾 |
| 材質看起來不對 | 缺少貼圖資源 | 專案需要有對應的貼圖，或使用程序化方式 |
| 連接節點失敗 | Pin 名稱不正確 | 參考上方 MCP API 注意事項 |
