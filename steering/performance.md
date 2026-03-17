# Unreal Engine 效能最佳實踐

本文件提供 Unreal Engine 5 專案的效能最佳化指引，涵蓋 Draw Call、記憶體、GPU 與常見反模式。Kiro 在提供效能相關建議時應參照本文件。

---

## Draw Call 最佳化

### Instanced Static Mesh（ISM / HISM）

- 場景中重複出現的相同 Static Mesh（如樹木、岩石、路燈）應使用 **Instanced Static Mesh Component** 或 **Hierarchical Instanced Static Mesh Component（HISM）** 合併繪製
- HISM 支援 LOD 與 Culling，適合大量分佈的環境物件
- 使用 `Add Instance` 動態新增實例，避免逐一 Spawn 獨立 Actor
- 每個 ISM Component 的實例數建議不超過 **10,000**，超過時考慮分割為多個 Component

### Nanite 虛擬化幾何

- Nanite 自動處理 LOD 與 Draw Call 合併，適用於 **高面數靜態網格**（建議 > 10,000 三角面）
- 啟用 Nanite 後無需手動設定 LOD，引擎會自動根據螢幕像素密度調整細節
- Nanite **不支援**：Skeletal Mesh、Morph Target、World Position Offset（WPO）動畫、透明材質
- 啟用方式：Static Mesh Editor → Nanite Settings → Enable Nanite Support
- 建議為 Nanite 網格設定 **Fallback Mesh**，供不支援 Nanite 的平台使用
- Nanite Position Precision 預設為 Auto，僅在出現精度問題時手動調整

### LOD（Level of Detail）

- 非 Nanite 網格必須設定 LOD，建議至少 **3-4 級** LOD
- LOD 切換距離根據物件大小設定：
  - 小型物件（< 1m）：LOD0 = 0-500, LOD1 = 500-1500, LOD2 = 1500+
  - 中型物件（1-5m）：LOD0 = 0-2000, LOD1 = 2000-5000, LOD2 = 5000+
  - 大型物件（> 5m）：LOD0 = 0-5000, LOD1 = 5000-15000, LOD2 = 15000+
- 使用 `Generate LODs` 自動生成，再手動微調 Reduction 百分比
- LOD 之間的三角面數建議遞減 **50%** 左右

### Mesh Merging 與 Actor Merging

- 靜態且不需要獨立互動的相鄰物件可使用 **Merge Actors** 合併
- 合併後減少 Draw Call，但會增加單一 Mesh 的記憶體佔用
- 適合場景裝飾物、建築結構等不需要動態操作的物件
- 注意：合併後無法單獨移動或刪除子物件

### 其他 Draw Call 策略

- 減少材質數量：共用材質的物件可合併 Draw Call
- 使用 **Material Instance** 而非獨立 Material，共享 Shader 編譯結果
- 開啟 **Hardware Instancing**（Project Settings → Rendering → Instanced Stereo / Instancing）
- 使用 `stat scenerendering` 指令監控 Draw Call 數量，目標：
  - PC：< 5,000 Draw Calls
  - 主機：< 3,000 Draw Calls
  - 行動裝置：< 1,000 Draw Calls

---

## 記憶體管理

### Texture Streaming

- 啟用 Texture Streaming 讓引擎根據距離動態載入不同 Mip Level
- 設定 `Texture Group` 分類貼圖用途（World、Character、UI 等），每個群組有獨立的 Streaming 優先級
- 貼圖尺寸建議：
  - 環境貼圖：最大 **2048x2048**
  - 角色貼圖：最大 **4096x4096**（主角）/ **2048x2048**（NPC）
  - UI 貼圖：依實際顯示尺寸設定，避免過大
- 使用 `stat streaming` 與 `stat streamingdetails` 監控 Streaming Pool 使用量
- Streaming Pool 預設大小為 **1000 MB**，可在 Project Settings 調整
- 設定 `LOD Bias` 降低遠處貼圖品質以節省記憶體

### Asset 載入策略

- **Soft Reference**（`TSoftObjectPtr`）：延遲載入，適合非立即需要的資產（如遠處關卡、可選內容）
- **Hard Reference**（直接引用）：立即載入，適合核心資產（如玩家角色、主要 UI）
- 避免在 Blueprint 中使用 Hard Reference 引用大型資產，改用 Soft Reference + `Async Load`
- 使用 **Asset Manager** 管理資產載入優先級與分組
- Primary Asset 與 Secondary Asset 的區分：
  - Primary Asset：可被 Asset Manager 直接管理（如 Map、GameMode）
  - Secondary Asset：透過 Primary Asset 間接載入（如 Texture、Mesh）

### World Partition 串流

- World Partition 將大型世界分割為 Cell，根據玩家位置動態載入/卸載
- **Cell Size** 設定建議：
  - 開放世界：**12800-25600 UU**（128-256m）
  - 室內場景：**6400-12800 UU**（64-128m）
- **Loading Range** 應大於 Cell Size 的 **2 倍**，確保玩家移動時無明顯載入
- 使用 **Data Layer** 分離不同類型的內容（Landscape、Buildings、Foliage、Audio）
- Data Layer 可設定為 Runtime（運行時可切換）或 Editor（僅編輯器可見）
- 避免跨 Cell 的大型 Actor，會導致多個 Cell 同時載入

### 記憶體預算參考

| 平台 | 總記憶體 | 遊戲可用 | Texture Pool | Mesh Pool |
|------|---------|---------|-------------|-----------|
| PC（中階） | 16 GB | ~8 GB | ~2 GB | ~1 GB |
| PS5 | 16 GB | ~12 GB | ~3 GB | ~2 GB |
| Xbox Series X | 16 GB | ~12 GB | ~3 GB | ~2 GB |
| Nintendo Switch | 4 GB | ~2.5 GB | ~512 MB | ~256 MB |
| iOS（高階） | 6 GB | ~2 GB | ~512 MB | ~256 MB |
| Android（中階） | 6 GB | ~2 GB | ~512 MB | ~256 MB |

---

## GPU 最佳化

### Lumen 設定與效能權衡

- **Lumen Global Illumination**：提供動態全域光照，無需烘焙 Lightmap
  - `Lumen Scene Detail`：控制場景細節精度，降低可提升效能
  - `Final Gather Quality`：控制最終收集品質，1.0 為預設，0.5 可大幅提升效能
  - `Lumen Scene Lighting Update Speed`：控制光照更新速度，降低可減少 GPU 負擔
- **Lumen Reflections**：動態反射系統
  - `Reflection Quality`：控制反射品質，降低可提升效能
  - `Ray Lighting Mode`：`Surface Cache` 較快，`Hit Lighting` 品質較高但更耗效能
- **Software Ray Tracing vs Hardware Ray Tracing**：
  - Software RT：所有平台支援，效能較好，品質略低
  - Hardware RT：需要 RTX/RDNA2 GPU，品質更高但效能開銷更大
  - 建議預設使用 Software RT，僅在高階 PC 啟用 Hardware RT
- 使用 `stat gpu` 監控 Lumen 的 GPU 時間佔比

### Nanite 效能考量

- Nanite 在 GPU 端處理幾何裁剪與 LOD，減少 CPU 端 Draw Call 開銷
- Nanite 的 GPU 開銷主要來自 **Rasterization** 與 **Material Evaluation**
- 適用場景：大量高面數靜態環境物件
- 不適用場景：少量低面數物件（Nanite 的固定開銷可能超過收益）
- 使用 `stat nanite` 監控 Nanite 效能指標
- Nanite 與 Virtual Shadow Maps（VSM）搭配使用效果最佳

### Shader 複雜度控制

- 使用 **Shader Complexity** 視圖模式檢查材質複雜度
- 材質指令數建議：
  - 環境物件：< **200** 指令
  - 角色：< **300** 指令
  - 特效：< **150** 指令
- 減少 Shader 複雜度的策略：
  - 使用 **Material Instance** 共享基礎 Shader
  - 將複雜計算移至 **Vertex Shader**（如 UV 動畫）
  - 使用 **Texture Packing**（將 Occlusion/Roughness/Metallic 打包至單一貼圖的 RGB 通道）
  - 避免過多的 Texture Sample（建議 < **8** 個）
  - 使用 **Material Quality Switch** 為不同平台提供不同複雜度的材質
- 使用 `stat material` 監控材質效能

### 其他 GPU 最佳化

- **Occlusion Culling**：確保啟用，減少不可見物件的渲染
- **Distance Cull**：為小型物件設定最大可見距離
- **Precomputed Visibility Volume**：在室內場景使用預計算可見性
- **Virtual Shadow Maps（VSM）**：UE5 預設陰影系統，與 Nanite 搭配效果最佳
  - 調整 `Shadow Resolution Scale` 控制品質與效能
  - 使用 `stat shadowrendering` 監控陰影效能

---

## 常見反模式

### 🔴 過多動態光源

- **問題**：每個動態光源增加額外的 Draw Call 與 Shadow Map 計算
- **偵測**：場景中動態光源（Movable）超過 **4 個**
- **修復**：
  1. 將不需要移動的光源設為 **Stationary** 或 **Static**
  2. 使用 **Light Channel** 限制光源影響範圍
  3. 減小光源的 **Attenuation Radius**
  4. 對小型光源停用 **Cast Shadows**
- **預期改善**：每減少一個動態陰影光源，可節省 **1-3ms** GPU 時間

### 🔴 Tick 函數濫用

- **問題**：`Tick` 每幀執行，大量 Tick 邏輯會嚴重影響 CPU 效能
- **偵測**：
  - 場景中超過 **50 個** Actor 啟用 Tick
  - Tick 函數中包含複雜邏輯（如 Line Trace、Asset Loading）
- **修復**：
  1. 使用 **Timer**（`SetTimerByFunction`）替代 Tick，設定合理的更新間隔
  2. 使用 **Event-Driven** 架構，僅在狀態變更時執行邏輯
  3. 設定 `Tick Interval` 降低更新頻率（如 0.1 秒一次）
  4. 對不需要 Tick 的 Actor 停用 `PrimaryActorTick.bCanEverTick`
  5. 使用 `Significance Manager` 根據距離調整 Tick 頻率
- **預期改善**：減少 50% 的 Tick Actor 可節省 **2-5ms** CPU 時間

### 🔴 未壓縮的貼圖

- **問題**：未壓縮貼圖佔用大量記憶體與頻寬
- **偵測**：
  - 貼圖 Compression Settings 為 `UserInterface2D`（無壓縮）但非 UI 用途
  - 貼圖尺寸超過 **4096x4096** 且非特殊用途
  - 貼圖尺寸非 2 的冪次（無法有效壓縮與生成 Mipmap）
- **修復**：
  1. 設定正確的 **Compression Settings**：
     - Diffuse/Albedo：`TC_Default`（DXT1/BC1）
     - Normal Map：`TC_Normalmap`（BC5）
     - Mask/Packed：`TC_Masks`（BC4/BC5）
     - HDR：`TC_HDR`（BC6H）
  2. 確保貼圖尺寸為 **2 的冪次**（256, 512, 1024, 2048, 4096）
  3. 設定合理的 `Max Texture Size` 限制最大解析度
  4. 啟用 **Virtual Texture** 處理超大貼圖（如 Landscape）
- **預期改善**：正確壓縮可減少 **50-75%** 的貼圖記憶體佔用

### 🟡 未合併的網格

- **問題**：大量小型獨立 Static Mesh 產生過多 Draw Call
- **偵測**：場景中相鄰的小型 Static Mesh 超過 **100 個** 且未使用 ISM/HISM
- **修復**：
  1. 使用 **Merge Actors** 合併靜態裝飾物
  2. 將重複物件轉換為 **HISM**
  3. 啟用 **Nanite** 自動合併高面數網格
- **預期改善**：合併後可減少 **30-60%** 的 Draw Call

### 🟡 過高的材質指令數

- **問題**：複雜材質增加 GPU Shader 計算時間
- **偵測**：材質指令數超過 **300**
- **修復**：
  1. 使用 **Texture Packing** 減少 Texture Sample 數量
  2. 將靜態計算移至 **Custom UV** 或 **Vertex Shader**
  3. 使用 **Material Quality Switch** 為低階平台提供簡化版本
  4. 考慮使用 **Material Layer** 組合替代複雜的單一材質
- **預期改善**：降低指令數 50% 可節省 **0.5-2ms** GPU 時間

### 🟡 過多 Tick 更新的 Widget

- **問題**：UI Widget 使用 Tick 更新內容，造成不必要的 CPU 開銷
- **偵測**：Widget 中使用 `Tick` 或 `NativeTick` 更新顯示內容
- **修復**：
  1. 使用 **Property Binding** 或 **Event-Driven** 更新 UI
  2. 使用 `SetTimerByFunction` 設定合理的更新間隔
  3. 對不可見的 Widget 停用 Tick（`SetVisibility(Collapsed)` 會自動停用）
  4. 使用 **Invalidation Box** 減少 Widget 重繪頻率
- **預期改善**：改用事件驅動可減少 **1-3ms** CPU 時間

---

## 效能監控指令速查

| 指令 | 用途 |
|------|------|
| `stat fps` | 顯示 FPS |
| `stat unit` | 顯示 Game/Draw/GPU 時間 |
| `stat gpu` | 顯示 GPU 各階段時間 |
| `stat scenerendering` | 顯示 Draw Call 與渲染統計 |
| `stat nanite` | 顯示 Nanite 效能指標 |
| `stat streaming` | 顯示 Texture Streaming 狀態 |
| `stat memory` | 顯示記憶體使用 |
| `stat shadowrendering` | 顯示陰影渲染統計 |
| `stat material` | 顯示材質效能統計 |
| `profilegpu` | GPU 效能分析（單幀） |
| `stat startfile` / `stat stopfile` | 錄製效能追蹤檔 |

---

## 效能目標參考

| 平台 | 目標 FPS | Game Thread | Draw Thread | GPU |
|------|---------|-------------|-------------|-----|
| PC（高階） | 60+ | < 10ms | < 10ms | < 12ms |
| PC（中階） | 30-60 | < 16ms | < 16ms | < 20ms |
| PS5 / Xbox Series X | 60 | < 12ms | < 12ms | < 14ms |
| Nintendo Switch | 30 | < 28ms | < 28ms | < 30ms |
| iOS / Android | 30-60 | < 20ms | < 20ms | < 25ms |
