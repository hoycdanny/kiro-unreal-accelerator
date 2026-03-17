# Unreal Engine 5 特性指引

本文件提供 Unreal Engine 5 核心特性的使用指引，涵蓋 Nanite、Lumen、World Partition、Control Rig、Virtual Shadow Maps 等系統。Kiro 在提供 UE5 特性相關建議時應參照本文件。

---

## Nanite 虛擬化幾何系統

### 適用場景

- **高面數靜態環境物件**：岩石、建築、地形裝飾等（建議三角面數 > 10,000）
- **電影級資產直接匯入**：無需手動製作 LOD，Nanite 自動處理細節層級
- **大量重複物件的場景**：Nanite 搭配 ISM/HISM 可高效處理數百萬三角面
- **掃描資產（Photogrammetry）**：高面數掃描模型直接使用，無需減面

### 限制與不支援項目

| 不支援項目 | 說明 | 替代方案 |
|-----------|------|---------|
| Skeletal Mesh | 骨骼網格無法啟用 Nanite | 使用傳統 LOD 系統 |
| Morph Target | 變形目標不相容 | 使用 Vertex Animation Texture（VAT） |
| World Position Offset（WPO） | 頂點動畫不支援 | 使用 Vertex Animation 或 Niagara Mesh |
| 透明材質 | Nanite 僅支援 Opaque 與 Masked | 透明物件使用傳統網格 |
| Spline Mesh | 樣條網格不支援 | 使用傳統 Static Mesh |
| 程序化網格（Procedural Mesh） | 運行時生成的網格不支援 | 預先生成為 Static Mesh |

### 設定建議

- **啟用方式**：Static Mesh Editor → Nanite Settings → Enable Nanite Support
- **Fallback Mesh**：務必設定 Fallback Mesh，供不支援 Nanite 的平台使用
  - Fallback Relative Error：預設 `1.0`，數值越低品質越高但面數越多
  - Fallback Trim Relative Error：控制 Fallback 的裁剪精度
- **Position Precision**：預設 `Auto`，僅在出現浮點精度問題（如大型世界中的閃爍）時手動調整
- **Nanite Displacement**（UE 5.4+）：支援 Displacement Map，適合地形細節增強

### Nanite 效能監控

- 使用 `stat nanite` 查看 Nanite 渲染統計
- 關注指標：
  - **Triangles**：實際渲染的三角面數
  - **Instances**：Nanite 實例數量
  - **Rasterize Time**：光柵化時間（應 < 3ms）
- Nanite 與 **Virtual Shadow Maps（VSM）** 搭配使用效果最佳

### 最佳實踐

1. 低面數物件（< 1,000 三角面）不建議啟用 Nanite，固定開銷可能超過收益
2. 場景中混合使用 Nanite 與傳統網格時，注意 Draw Call 分離的額外開銷
3. 大量使用 Nanite 時，確保 GPU 記憶體充足（建議 > 6 GB VRAM）
4. 使用 `r.Nanite.MaxPixelsPerEdge` 控制 Nanite 的最小像素精度

---

## Lumen 全域光照與反射系統

### Global Illumination 設定

Lumen GI 提供動態全域光照，無需烘焙 Lightmap。

| 設定項 | 說明 | 預設值 | 效能影響 |
|--------|------|--------|---------|
| `Lumen Scene Detail` | 場景細節精度 | `1.0` | 高 — 降低可大幅提升效能 |
| `Final Gather Quality` | 最終收集品質 | `1.0` | 高 — `0.5` 可節省 2-4ms GPU |
| `Lumen Scene Lighting Update Speed` | 光照更新速度 | `1.0` | 中 — 降低可減少 GPU 負擔 |
| `Max Trace Distance` | 最大追蹤距離 | `20000` | 中 — 室內場景可降低 |
| `Scene Capture Cache Resolution Scale` | 場景捕捉快取解析度 | `1.0` | 中 |

### Reflection 設定

| 設定項 | 說明 | 預設值 | 效能影響 |
|--------|------|--------|---------|
| `Reflection Quality` | 反射品質 | `1.0` | 高 |
| `Ray Lighting Mode` | 光線照明模式 | `Surface Cache` | `Hit Lighting` 品質高但更耗效能 |
| `Max Reflection Bounces` | 最大反射彈跳次數 | `1` | 增加會顯著影響效能 |

### 效能 vs 品質權衡

| 場景類型 | 建議設定 | 說明 |
|---------|---------|------|
| 開放世界 | GI Quality: 0.5-0.75, Software RT | 優先效能，大場景光照變化不明顯 |
| 室內場景 | GI Quality: 1.0, Surface Cache | 室內光照細節重要，保持品質 |
| 高階 PC / 次世代主機 | GI Quality: 1.0, Hardware RT | 最高品質，需 RTX/RDNA2 GPU |
| 行動裝置 | 不支援 Lumen | 使用烘焙 Lightmap + Reflection Capture |

### Software RT vs Hardware RT

- **Software Ray Tracing**：所有支援 SM5 的平台可用，效能較好，品質略低
- **Hardware Ray Tracing**：需要 RTX 2060+ / RX 6600+ 以上 GPU
  - 提供更精確的反射與陰影
  - GPU 開銷增加 30-50%
  - 建議僅在高階 PC 配置中啟用

### Lumen 限制

- 不支援行動裝置平台（iOS / Android）
- 不支援 Nintendo Switch
- 透明物件不接收 Lumen GI（需使用 Translucency Lighting Volume）
- 非常小的物件可能無法被 Lumen Scene 正確捕捉（需調整 `Lumen Scene Detail`）
- 快速移動的光源可能出現延遲（受 `Lighting Update Speed` 影響）

---

## World Partition 大型世界分區系統

### 分區網格大小設定

World Partition 將世界分割為 Grid Cell，根據玩家位置動態串流載入/卸載。

| 場景類型 | 建議 Cell Size | 說明 |
|---------|---------------|------|
| 開放世界 | 12800-25600 UU（128-256m） | 大型場景，平衡載入頻率與記憶體 |
| 城市場景 | 6400-12800 UU（64-128m） | 建築密集，需較小 Cell 控制記憶體 |
| 室內場景 | 3200-6400 UU（32-64m） | 精細控制，避免載入不必要的房間 |
| 線性關卡 | 12800 UU（128m） | 沿路徑方向分割 |

### 串流距離設定

- **Loading Range** 應大於 Cell Size 的 **2 倍**，確保玩家移動時無明顯載入
- 設定範例：Cell Size = 12800 UU → Loading Range ≥ 25600 UU
- 使用 `World Partition Editor` 視覺化檢查 Cell 載入範圍
- 可為不同 Grid 設定不同的 Loading Range（如 Landscape Grid vs Actor Grid）

### Data Layer 使用時機

Data Layer 用於分離不同類型的內容，支援獨立的載入/卸載控制。

| Data Layer 類型 | 說明 | 使用場景 |
|----------------|------|---------|
| **Runtime Data Layer** | 運行時可動態切換 | 日夜切換、季節變化、任務觸發的場景變化 |
| **Editor Data Layer** | 僅編輯器可見 | 開發用標記、測試物件、關卡設計輔助線 |

**建議的 Data Layer 劃分**：

```
Landscape          # 地形（始終載入）
Buildings          # 建築結構
Foliage            # 植被
Audio              # 音訊觸發器與環境音
Gameplay           # 遊戲邏輯 Actor（觸發器、Spawn Point）
Lighting           # 光源與後處理
VFX                # 視覺特效
Cinematic          # 過場動畫相關
Debug              # 開發除錯用（Editor Only）
```

### World Partition 最佳實踐

1. **避免跨 Cell 的大型 Actor**：會導致多個 Cell 同時載入，增加記憶體壓力
2. **使用 Level Instance**：將重複使用的場景片段（如建築內部）封裝為 Level Instance
3. **HLOD（Hierarchical Level of Detail）**：為遠處 Cell 生成 HLOD，減少遠景渲染開銷
4. **One File Per Actor（OFPA）**：World Partition 預設每個 Actor 獨立檔案，利於多人協作
5. **Minimap Volume**：設定 Minimap Volume 定義世界邊界，避免 Cell 無限擴展

---

## Control Rig 程序化動畫系統

### 程序化動畫設定

Control Rig 提供在引擎內建立程序化動畫邏輯的能力，無需回到 DCC 工具。

**適用場景**：

- **IK（Inverse Kinematics）**：腳部 IK、手部 IK、瞄準 IK
- **程序化動畫層疊**：呼吸、搖擺、物理模擬後的修正
- **動畫後處理**：骨骼位置微調、Look At、Aim Offset 增強
- **Full Body IK**：全身 IK 解算，適合攀爬、互動動畫

### IK 設定指引

#### Foot IK（腳部 IK）

```
設定步驟：
1. 建立 Control Rig Blueprint
2. 新增 Two Bone IK 節點（左腳、右腳）
3. 設定 Effector：foot_l / foot_r
4. 設定 Pole Vector：knee_l / knee_r
5. 在 AnimBP 中使用 Control Rig 節點套用
```

| 參數 | 建議值 | 說明 |
|------|--------|------|
| `Trace Distance` | 50-100 UU | 地面偵測射線距離 |
| `Foot Offset` | 根據角色腳底高度 | 腳底與地面的偏移 |
| `Interpolation Speed` | 10-20 | IK 插值速度，過快會抖動 |
| `Enable Pelvis Adjustment` | `true` | 骨盆高度自動調整 |

#### Look At / Aim IK

```
設定步驟：
1. 新增 Aim 節點
2. 設定 Target Bone：head / spine_03
3. 設定 Aim Axis 與 Up Axis
4. 設定角度限制（Clamp）避免不自然的旋轉
```

| 參數 | 建議值 | 說明 |
|------|--------|------|
| `Aim Clamp Angle` | 70-90° | 最大旋轉角度 |
| `Interpolation Speed` | 5-15 | 轉頭速度 |
| `Weight` | 0.0-1.0 | IK 權重，可動態調整 |

#### Full Body IK（FBIK）

- UE5 內建 Full Body IK Solver，適合複雜的全身 IK 需求
- 設定 Effector 於手、腳、骨盆、頭部
- 使用 `Stiffness` 控制各關節的抗性
- 適合：攀爬牆壁、撿拾物品、坐下等互動動畫

### Control Rig 效能考量

- Control Rig 在 **Animation Thread** 執行，不阻塞 Game Thread
- 複雜的 Control Rig 圖表仍會增加 CPU 開銷
- 建議：
  - 遠處角色降低 Control Rig 更新頻率或停用
  - 使用 `LOD Threshold` 控制 Control Rig 的啟用距離
  - 避免在 Control Rig 中使用過多的 Trace 操作

---

## Virtual Shadow Maps（VSM）

### 概述

Virtual Shadow Maps 是 UE5 的預設陰影系統，取代傳統的 Cascaded Shadow Maps（CSM）。

### 特性

- **像素級精度**：陰影解析度與螢幕像素對齊，近處陰影極為銳利
- **與 Nanite 深度整合**：Nanite 網格的陰影計算高效且精確
- **支援大量光源**：每個光源獨立的 Virtual Shadow Map，無需共享 Shadow Map
- **快取機制**：靜態物件的陰影被快取，僅動態物件需要每幀更新

### 設定建議

| 設定項 | 說明 | 建議值 |
|--------|------|--------|
| `Shadow Resolution Scale` | 陰影解析度縮放 | `1.0`（降低可提升效能） |
| `Contact Shadow Length` | 接觸陰影長度 | `0.02-0.05` |
| `Virtual Shadow Map Cache` | 啟用快取 | `true`（大幅提升效能） |
| `One Pass Projection` | 單次投影 | `true`（減少 Draw Call） |

### VSM 限制

- GPU 記憶體需求較高（建議 > 4 GB VRAM）
- 半透明物件不投射 VSM 陰影
- 極遠距離的陰影可能出現精度問題
- 使用 `stat shadowrendering` 監控陰影效能

---

## Substrate 材質系統（前身 Strata）

### 概述

Substrate（UE 5.4+ 實驗性功能）是新一代材質系統，取代傳統的 Shading Model 選擇。

### 核心概念

- **Slab Node**：統一的材質描述節點，取代 DefaultLit、Subsurface 等獨立 Shading Model
- **材質層疊（Layering）**：透過 Horizontal/Vertical Mixing 組合多層材質
- **統一 BSDF**：所有材質特性（金屬、次表面散射、布料等）在同一框架下描述

### 使用建議

- Substrate 目前為**實驗性功能**，生產專案建議謹慎評估
- 啟用方式：Project Settings → Rendering → Substrate → Enable Substrate
- 啟用後所有材質需要重新編譯
- 與 Nanite 完全相容
- 效能開銷可能高於傳統材質系統（視材質複雜度而定）

---

## Mass Entity 系統

### 概述

Mass Entity 是 UE5 的 Entity Component System（ECS）框架，適合處理大量相似實體。

### 適用場景

- **大量 NPC / 群眾模擬**：數千個簡單行為的 NPC
- **子彈 / 投射物管理**：大量同類投射物的批次處理
- **環境互動物件**：可破壞物、收集物等大量同類物件
- **RTS / 策略遊戲單位**：大量單位的移動與行為

### 核心元件

| 元件 | 說明 |
|------|------|
| `Mass Entity Config` | 定義實體的 Fragment（資料）與 Trait（初始化邏輯） |
| `Mass Spawner` | 批次生成 Mass Entity |
| `Mass Processor` | 處理實體邏輯的系統（類似 ECS 的 System） |
| `Mass Observer` | 監聽實體狀態變化 |
| `Mass Signal` | 實體間的訊號通訊 |

### 效能優勢

- **資料導向設計**：Fragment 連續儲存在記憶體中，Cache 友好
- **批次處理**：Processor 一次處理所有符合條件的實體
- **與 AI 整合**：Mass AI 提供 State Tree 驅動的 AI 行為
- **與 Animation 整合**：Mass Animation 支援大量實體的動畫播放

### 使用建議

1. Mass Entity 適合**大量同質實體**，少量複雜 Actor 仍建議使用傳統 Actor 系統
2. 學習曲線較陡，建議先熟悉 ECS 概念
3. 除錯工具有限，建議搭配 `Mass Debugger` 使用
4. 與 Gameplay Ability System（GAS）的整合需要額外工作

---

## 其他 UE5 特性

### PCG（Procedural Content Generation）框架

- UE 5.2+ 內建的程序化內容生成框架
- 適合：自動佈置植被、岩石、道具等環境物件
- 使用 PCG Graph 定義生成規則
- 支援 Runtime 與 Editor 兩種生成模式
- 與 World Partition 整合，支援分區生成

### Motion Matching

- UE 5.4+ 內建的動畫匹配系統
- 從動畫資料庫中即時選擇最匹配的動畫片段
- 適合：角色移動、戰鬥動畫等需要流暢過渡的場景
- 取代傳統的 State Machine 動畫架構
- 需要大量高品質的動畫資料

### Enhanced Input System

- UE5 預設的輸入系統，取代舊版 Input System
- **Input Action**：定義輸入動作（如 Move、Jump、Fire）
- **Input Mapping Context**：定義按鍵綁定，支援優先級與動態切換
- **Modifier**：輸入修飾器（Dead Zone、Negate、Swizzle 等）
- **Trigger**：輸入觸發條件（Pressed、Released、Hold、Tap 等）

### Chaos Physics

- UE5 的物理引擎，取代 PhysX
- 支援：剛體模擬、布料模擬、破壞系統
- **Chaos Destruction**：程序化破壞系統
  - Geometry Collection：定義破碎模式
  - 支援多層級破壞（外層 → 內層）
  - 與 Nanite 相容（破碎前）
- **Chaos Cloth**：布料模擬
  - 在 Skeletal Mesh 上定義布料區域
  - 支援風力、碰撞、自碰撞

### Niagara VFX 系統

- UE5 的粒子特效系統，取代 Cascade
- **模組化設計**：Emitter → System → Component
- **GPU Simulation**：大量粒子在 GPU 端模擬
- **Data Interface**：與場景互動（碰撞、流體、音訊反應）
- **Mesh Renderer**：使用 Mesh 替代 Sprite 渲染粒子
- 效能建議：
  - 限制同時活躍的粒子系統數量（建議 < 50）
  - 使用 `Scalability` 設定不同平台的粒子品質
  - 遠處粒子使用 `Cull Distance` 停用

---

## UE5 特性相容性速查

| 特性 | PC（DX12） | PS5 | Xbox Series X | Switch | iOS | Android |
|------|-----------|-----|---------------|--------|-----|---------|
| Nanite | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lumen | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Virtual Shadow Maps | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Hardware Ray Tracing | ✅（RTX/RDNA2） | ✅ | ✅ | ❌ | ❌ | ❌ |
| World Partition | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mass Entity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Control Rig | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Substrate | ✅（實驗性） | ⚠️ | ⚠️ | ❌ | ❌ | ❌ |
| PCG | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chaos Destruction | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| Niagara GPU Sim | ✅ | ✅ | ✅ | ❌ | ⚠️ | ⚠️ |
| Enhanced Input | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Motion Matching | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> ✅ 完全支援 | ⚠️ 部分支援 / 有限制 | ❌ 不支援
