# 平台相容性指引

本文件提供 Unreal Engine 5 跨平台開發的相容性指引，涵蓋各平台限制、Shader Model 對照、記憶體預算與特性支援矩陣。Kiro 在提供跨平台相關建議時應參照本文件。

---

## 平台規格概覽

### PC（Windows / Linux）

| 項目 | 最低規格 | 建議規格 | 高階規格 |
|------|---------|---------|---------|
| GPU | GTX 1060 / RX 580 | RTX 3060 / RX 6700 XT | RTX 4070+ / RX 7800 XT+ |
| VRAM | 4 GB | 8 GB | 12+ GB |
| RAM | 8 GB | 16 GB | 32 GB |
| CPU | 4 核心 | 6 核心 | 8+ 核心 |
| Feature Level | SM5 | SM5 / SM6 | SM6 |
| Nanite | ⚠️ 效能有限 | ✅ | ✅ |
| Lumen | ⚠️ Software RT | ✅ Software/Hardware RT | ✅ Hardware RT |
| Ray Tracing | ❌ | ✅（RTX/RDNA2） | ✅ |

### PlayStation 5

| 項目 | 規格 |
|------|------|
| GPU | AMD RDNA 2（10.28 TFLOPS） |
| VRAM | 16 GB 共享（遊戲可用 ~12 GB） |
| CPU | AMD Zen 2（8 核心 3.5 GHz） |
| Feature Level | SM6 等效 |
| 儲存 | 自訂 SSD（5.5 GB/s） |
| Nanite | ✅ 完全支援 |
| Lumen | ✅ 完全支援 |
| Hardware RT | ✅ 支援 |

### Xbox Series X

| 項目 | 規格 |
|------|------|
| GPU | AMD RDNA 2（12 TFLOPS） |
| VRAM | 16 GB 共享（遊戲可用 ~12 GB） |
| CPU | AMD Zen 2（8 核心 3.8 GHz） |
| Feature Level | SM6 等效 |
| 儲存 | 自訂 NVMe SSD（2.4 GB/s） |
| Nanite | ✅ 完全支援 |
| Lumen | ✅ 完全支援 |
| Hardware RT | ✅ 支援 |

### Xbox Series S

| 項目 | 規格 |
|------|------|
| GPU | AMD RDNA 2（4 TFLOPS） |
| VRAM | 10 GB 共享（遊戲可用 ~7 GB） |
| CPU | AMD Zen 2（8 核心 3.6 GHz） |
| Feature Level | SM6 等效 |
| Nanite | ✅ 支援（需降低品質） |
| Lumen | ✅ 支援（建議 Software RT） |
| 注意 | 記憶體與 GPU 效能顯著低於 Series X，需獨立最佳化 |

### Nintendo Switch

| 項目 | 規格 |
|------|------|
| GPU | NVIDIA Tegra X1（0.4-0.8 TFLOPS） |
| RAM | 4 GB（遊戲可用 ~2.5 GB） |
| CPU | ARM Cortex-A57（4 核心 1.02 GHz） |
| Feature Level | ES 3.1 / SM5 有限子集 |
| Nanite | ❌ 不支援 |
| Lumen | ❌ 不支援 |
| Ray Tracing | ❌ 不支援 |
| 注意 | 需大幅降低資產品質，使用烘焙光照，嚴格控制記憶體 |

### iOS（iPhone / iPad）

| 項目 | 中階（iPhone 12） | 高階（iPhone 15 Pro） |
|------|-------------------|---------------------|
| GPU | Apple A14 | Apple A17 Pro |
| RAM | 4 GB（遊戲可用 ~1.5 GB） | 8 GB（遊戲可用 ~3 GB） |
| Feature Level | Metal SM5 等效 | Metal SM6 部分 |
| Nanite | ❌ | ❌ |
| Lumen | ❌ | ❌ |
| Ray Tracing | ❌ | ⚠️ Metal RT（有限） |

### Android

| 項目 | 中階 | 高階 |
|------|------|------|
| GPU | Adreno 640 / Mali-G78 | Adreno 740 / Mali-G715 |
| RAM | 6 GB（遊戲可用 ~2 GB） | 12 GB（遊戲可用 ~4 GB） |
| Feature Level | Vulkan SM5 有限子集 | Vulkan SM5 |
| Nanite | ❌ | ❌ |
| Lumen | ❌ | ❌ |
| 注意 | 裝置碎片化嚴重，需針對多種 GPU 架構測試 |

---

## Shader Model / Feature Level 相容性

### Feature Level 對照表

| Feature Level | Shader Model | 支援平台 | 主要特性 |
|--------------|-------------|---------|---------|
| `SM5` | Shader Model 5.0 | PC（DX11）、PS4、Xbox One、Switch | 基礎 PBR、Compute Shader |
| `SM6` | Shader Model 6.x | PC（DX12）、PS5、Xbox Series X/S | Mesh Shader、Ray Tracing、Variable Rate Shading |
| `ES3_1` | OpenGL ES 3.1 | Android、Switch（部分） | 行動裝置基礎渲染 |
| `Metal` | Metal 2.x / 3.x | iOS、macOS | Apple 平台專用 |
| `Vulkan` | Vulkan 1.1+ | Android、Linux、Switch | 跨平台低階 API |

### Shader 功能支援矩陣

| Shader 功能 | SM5（DX11） | SM6（DX12） | ES3_1 | Metal | Vulkan |
|------------|-----------|-----------|-------|-------|--------|
| Compute Shader | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Tessellation | ✅ | ✅ | ❌ | ⚠️ | ⚠️ |
| Geometry Shader | ✅ | ✅ | ❌ | ❌ | ⚠️ |
| Mesh Shader | ❌ | ✅ | ❌ | ✅（Metal 3） | ❌ |
| Ray Tracing Shader | ❌ | ✅ | ❌ | ⚠️（Metal RT） | ⚠️ |
| Variable Rate Shading | ❌ | ✅ | ❌ | ❌ | ⚠️ |
| Wave Intrinsics | ❌ | ✅ | ❌ | ✅ | ⚠️ |
| 64-bit Atomics | ❌ | ✅ | ❌ | ✅ | ⚠️ |

> ✅ 完全支援 | ⚠️ 部分支援 / 有限制 | ❌ 不支援

### 跨平台 Shader 開發建議

1. **使用 Material Quality Switch**：為不同 Feature Level 提供不同複雜度的材質分支
2. **避免平台特定 Shader 功能**：除非有 Fallback 路徑
3. **測試所有目標平台的 Shader 編譯**：使用 `Cook Content` 驗證
4. **使用 `PLATFORM_*` 巨集**：在 Custom Expression 中處理平台差異
5. **Shader Permutation 控制**：減少不必要的 Shader 變體以縮短編譯時間

---

## 記憶體預算

### 各平台記憶體預算參考

| 平台 | 總記憶體 | 遊戲可用 | Texture Pool | Mesh Pool | Audio Pool | 其他 |
|------|---------|---------|-------------|-----------|------------|------|
| PC（中階） | 16 GB | ~8 GB | ~2 GB | ~1 GB | ~256 MB | ~4.7 GB |
| PC（高階） | 32 GB | ~12 GB | ~4 GB | ~2 GB | ~512 MB | ~5.5 GB |
| PS5 | 16 GB | ~12 GB | ~3 GB | ~2 GB | ~256 MB | ~6.7 GB |
| Xbox Series X | 16 GB | ~12 GB | ~3 GB | ~2 GB | ~256 MB | ~6.7 GB |
| Xbox Series S | 10 GB | ~7 GB | ~1.5 GB | ~1 GB | ~128 MB | ~4.4 GB |
| Switch | 4 GB | ~2.5 GB | ~512 MB | ~256 MB | ~64 MB | ~1.7 GB |
| iOS（高階） | 6-8 GB | ~2-3 GB | ~512 MB | ~256 MB | ~64 MB | ~1.2-2.2 GB |
| Android（中階） | 6 GB | ~2 GB | ~512 MB | ~256 MB | ~64 MB | ~1.2 GB |

### 記憶體管理策略

#### Texture 記憶體

- 使用 **Texture Streaming** 動態管理貼圖 Mip Level
- 設定 `Streaming Pool Size`：
  - PC：1000-2000 MB
  - 主機：1500-3000 MB
  - 行動裝置：256-512 MB
- 使用 **Virtual Texture** 處理超大貼圖（Landscape、Mega Texture）
- 貼圖尺寸上限建議：
  - PC / 主機：4096x4096
  - Switch：2048x2048
  - 行動裝置：1024x1024（特殊情況 2048x2048）

#### Mesh 記憶體

- Nanite 網格的記憶體佔用由引擎自動管理
- 非 Nanite 網格需手動設定 LOD 以控制記憶體
- 使用 `stat memory` 監控 Mesh 記憶體使用
- 行動裝置建議單一網格三角面數 < 50,000

#### Audio 記憶體

- 使用 **Sound Cue** 的 `Loading Behavior` 控制載入策略
- 背景音樂使用 Streaming 載入
- 短音效使用 Retain on Load 預載入
- 行動裝置建議音訊格式：OGG（Android）/ AAC（iOS），壓縮率 > 10:1

---

## 特性支援矩陣

### 渲染特性

| 特性 | PC（DX12） | PS5 | Xbox Series X | Xbox Series S | Switch | iOS | Android |
|------|-----------|-----|---------------|---------------|--------|-----|---------|
| Nanite | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lumen GI | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lumen Reflections | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Virtual Shadow Maps | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Hardware Ray Tracing | ✅* | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Baked Lightmap | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reflection Capture | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cascaded Shadow Maps | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Screen Space Reflections | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| Volumetric Fog | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Temporal Super Resolution | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

> \* PC Hardware RT 需要 RTX 2060+ / RX 6600+ 以上 GPU

### 系統特性

| 特性 | PC | PS5 | Xbox Series X | Xbox Series S | Switch | iOS | Android |
|------|-----|-----|---------------|---------------|--------|-----|---------|
| World Partition | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mass Entity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Control Rig | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Enhanced Input | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GAS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chaos Physics | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| Chaos Destruction | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| Niagara GPU Sim | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ | ⚠️ |
| PCG | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Motion Matching | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> ✅ 完全支援 | ⚠️ 部分支援 / 需降級 | ❌ 不支援

---

## 平台特定最佳化建議

### PC 最佳化

- **Scalability Settings**：提供 Low / Medium / High / Epic / Cinematic 五級品質設定
- **DLSS / FSR / XeSS**：使用超解析度技術提升效能
  - NVIDIA DLSS：RTX 20 系列以上
  - AMD FSR：所有 GPU 支援（品質略低於 DLSS）
  - Intel XeSS：Arc GPU 原生支援，其他 GPU 使用 DP4a Fallback
- **Variable Rate Shading（VRS）**：SM6 GPU 支援，降低畫面邊緣的著色率
- **Shader 預編譯**：首次啟動時編譯 Shader，使用 PSO Cache 減少卡頓
- **多執行緒渲染**：確保啟用 `r.RHICmdBypass 0` 使用多執行緒 RHI

### PS5 / Xbox Series X 最佳化

- **SSD 串流**：利用高速 SSD 減少載入時間，World Partition Cell 可設定較小
- **120 FPS 模式**：提供效能模式選項，降低解析度與特效品質
- **Activity Cards（PS5）**：整合 PS5 Activity 系統提供快速跳轉
- **Smart Delivery（Xbox）**：為 Series X 與 Series S 提供不同品質的資產包
- **Haptic Feedback（PS5 DualSense）**：利用觸覺回饋增強遊戲體驗
- **記憶體管理**：主機記憶體固定，需嚴格控制記憶體預算，避免 OOM Crash

### Nintendo Switch 最佳化

- **解析度**：
  - Docked 模式：720p-1080p
  - Handheld 模式：540p-720p
  - 使用動態解析度（Dynamic Resolution）自動調整
- **光照**：使用烘焙 Lightmap，不使用 Lumen
- **陰影**：使用 Cascaded Shadow Maps，限制陰影距離
- **材質**：簡化材質，減少 Texture Sample 數量（建議 < 4）
- **網格**：所有網格使用傳統 LOD（不支援 Nanite），嚴格控制面數
- **粒子**：使用 CPU 粒子模擬（不支援 GPU Sim），限制粒子數量
- **記憶體**：嚴格控制在 2.5 GB 以內，使用積極的 Texture Streaming
- **Draw Call**：目標 < 1,000 Draw Calls

### iOS 最佳化

- **Metal API**：使用 Metal 渲染後端，效能優於 OpenGL ES
- **Thermal Throttling**：長時間高負載會觸發降頻，需預留效能餘量
- **記憶體警告**：監聽 `didReceiveMemoryWarning`，主動釋放非必要資源
- **App Size**：App Store 限制下載大小（行動網路 200 MB），使用 On-Demand Resources
- **解析度**：
  - iPhone：使用 75-85% 的原生解析度
  - iPad：使用 50-75% 的原生解析度
- **幀率**：目標 30 FPS（穩定），高階裝置可嘗試 60 FPS
- **電池消耗**：降低 GPU 負載以延長電池壽命

### Android 最佳化

- **裝置碎片化**：需針對多種 GPU 架構測試（Adreno、Mali、PowerVR）
- **Vulkan vs OpenGL ES**：
  - Vulkan：效能更好，但部分舊裝置不支援
  - OpenGL ES 3.1：相容性更廣
  - 建議同時支援兩種後端
- **記憶體管理**：Android 記憶體管理較 iOS 寬鬆，但低記憶體裝置仍需注意
- **Texture 壓縮**：
  - ASTC：品質最佳，現代裝置支援
  - ETC2：廣泛支援，品質略低
  - 避免使用 PVRTC（僅 PowerVR 支援）
- **APK / AAB 大小**：Google Play 限制 AAB 150 MB，使用 Play Asset Delivery 分發大型資產
- **幀率**：目標 30 FPS，高階裝置可嘗試 60 FPS
- **散熱**：長時間遊玩需考慮散熱，避免持續高 GPU 負載

---

## Scalability Settings 指引

### 品質等級定義

| 等級 | 目標平台 | 說明 |
|------|---------|------|
| `Low` | Switch、低階行動裝置 | 最低品質，最大效能 |
| `Medium` | 中階行動裝置、低階 PC | 平衡品質與效能 |
| `High` | 中階 PC、Xbox Series S | 良好品質 |
| `Epic` | 高階 PC、PS5、Xbox Series X | 高品質 |
| `Cinematic` | 頂級 PC | 最高品質，適合截圖與預告片 |

### 各等級建議設定

| 設定項 | Low | Medium | High | Epic | Cinematic |
|--------|-----|--------|------|------|-----------|
| Shadow Quality | 0 | 1 | 2 | 3 | 4 |
| Texture Quality | 0 | 1 | 2 | 3 | 3 |
| Effects Quality | 0 | 1 | 2 | 3 | 4 |
| Post Process Quality | 0 | 1 | 2 | 3 | 4 |
| View Distance | 0 | 1 | 2 | 3 | 4 |
| Anti-Aliasing | 0 | 1 | 2 | 3 | 4 |
| Foliage Quality | 0 | 1 | 2 | 3 | 4 |
| Global Illumination | Baked | Baked | Lumen（Low） | Lumen（High） | Lumen（Ultra） |
| Reflections | SSR Off | SSR Low | Lumen | Lumen | Lumen + HW RT |
| Nanite | Off | Off | On | On | On |

### 自訂 Scalability 設定

在 `Config/DefaultScalability.ini` 中定義自訂品質等級：

```ini
[ShadowQuality@0]
r.Shadow.MaxResolution=512
r.Shadow.CSM.MaxCascades=1

[ShadowQuality@3]
r.Shadow.MaxResolution=2048
r.Shadow.CSM.MaxCascades=4
```

---

## 跨平台開發檢查清單

### 資產準備

- [ ] 所有 Static Mesh 設定 Fallback Mesh（供不支援 Nanite 的平台）
- [ ] 貼圖提供多種解析度版本（或依賴 Texture Streaming）
- [ ] 材質使用 Material Quality Switch 提供不同複雜度分支
- [ ] 音訊提供平台對應的壓縮格式

### 渲染設定

- [ ] 設定完整的 Scalability Settings（Low 到 Cinematic）
- [ ] 不支援 Lumen 的平台設定烘焙 Lightmap Fallback
- [ ] 不支援 Nanite 的平台設定傳統 LOD
- [ ] 不支援 VSM 的平台設定 Cascaded Shadow Maps

### 效能驗證

- [ ] 各平台記憶體使用在預算範圍內
- [ ] 各平台幀率達到目標（30/60 FPS）
- [ ] Shader 在所有目標平台編譯通過
- [ ] 行動裝置長時間運行無 Thermal Throttling 問題

### 輸入與 UI

- [ ] 支援各平台的輸入裝置（鍵鼠、手把、觸控）
- [ ] UI 適配不同解析度與螢幕比例
- [ ] 行動裝置 UI 元素大小適合觸控操作（最小 44x44 pt）
- [ ] 主機平台支援手把導航（Focus System）
