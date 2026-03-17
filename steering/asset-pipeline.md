# Unreal Engine 資產管線最佳實踐

本文件定義 Unreal Engine 5 專案的資產匯入流程、貼圖設定、網格設定與音訊設定。Kiro 在提供資產相關建議時應參照本文件。

---

## 資產匯入流程

### 匯入前準備

1. **確認資產命名**：匯入前確保檔案名稱符合專案命名規範（參照 `steering/architecture.md`）
2. **確認目標資料夾**：按功能分類放置，非按資產類型（如 `Characters/Player/Textures/` 而非 `Textures/Characters/`）
3. **確認來源格式**：
   - 網格：FBX（推薦）、OBJ、glTF
   - 貼圖：PNG（無損）、TGA、EXR（HDR）
   - 音訊：WAV（無損來源）、OGG

### 匯入工作流

```
來源檔案準備 → 命名規範檢查 → 匯入至正確資料夾
    → 自動偵測資產類型 → 套用預設設定
    → 驗證設定相容性 → 產出匯入報告
```

**自動偵測規則**：

| 檔案特徵 | 偵測結果 | 建議預設 |
|---------|---------|---------|
| 圖片檔 + 檔名含 `_N` | Normal Map | `TC_Normalmap`、sRGB Off |
| 圖片檔 + 檔名含 `_D` | Diffuse Map | `TC_Default`、sRGB On |
| 圖片檔 + 檔名含 `_ORM` | Packed Mask | `TC_Masks`、sRGB Off |
| FBX + 面數 > 10,000 | 高面數 Static Mesh | 啟用 Nanite |
| FBX + 含骨骼資料 | Skeletal Mesh | 設定 Physics Asset |
| WAV / OGG | Sound Wave | 根據時長設定壓縮 |

### 匯入後驗證

匯入完成後應執行以下驗證：

- [ ] 資產命名符合 `[Prefix]_[Name]_[Variant]` 規範
- [ ] 貼圖尺寸為 2 的冪次（256, 512, 1024, 2048, 4096）
- [ ] 網格無破面、法線方向正確
- [ ] 材質引用路徑正確，無 Missing Reference
- [ ] 音訊取樣率與專案設定一致

### 批次匯入策略

- 大量資產匯入時使用 **Import Queue** 避免 Editor 卡頓
- 匯入後執行 `Asset Validation` 批次檢查所有新資產
- 使用 **Asset Import Data** 記錄匯入設定，方便後續重新匯入

---

## 貼圖設定

### Compression Settings

根據貼圖用途選擇正確的壓縮格式：

| 用途 | Compression Setting | 說明 |
|------|-------------------|------|
| Diffuse / Base Color | `TC_Default`（DXT1/BC1） | 標準色彩貼圖，4:1 壓縮比 |
| Normal Map | `TC_Normalmap`（BC5） | 雙通道壓縮，保留法線精度 |
| Mask / Packed Texture | `TC_Masks`（BC4/BC5） | 無 sRGB，保留線性數值 |
| Grayscale（單通道） | `TC_Grayscale`（BC4） | 單通道資料，如 Height Map |
| HDR | `TC_HDR`（BC6H） | 高動態範圍，如 HDRI 環境貼圖 |
| UI | `TC_EditorIcon` 或 `TC_Default` | UI 貼圖需保持清晰度 |
| Alpha（透明度） | `TC_Alpha`（BC4） | 單通道 Alpha 資料 |
| Displacement | `TC_Displacementmap` | 位移貼圖 |
| Vector Displacement | `TC_VectorDisplacementmap` | 向量位移貼圖 |

### Mipmap 設定

- **預設啟用 Mipmap**：所有 3D 場景使用的貼圖都應啟用 Mipmap
- **停用 Mipmap 的情況**：
  - UI 貼圖（固定螢幕尺寸顯示）
  - Render Target（動態生成）
  - Lookup Table（LUT）
- **Mip Gen Settings**：
  - `SimpleAverage`：預設，適合大多數情況
  - `Sharpen`：適合需要保持細節的貼圖（如文字、圖標）
  - `NoMipmaps`：停用 Mipmap
- **LOD Bias**：設定 Mipmap 偏移量，正值降低品質節省記憶體，負值提升品質

### Texture Group

Texture Group 決定 Streaming 優先級與記憶體分配：

| Texture Group | 用途 | 建議 Max Size |
|--------------|------|--------------|
| `TEXTUREGROUP_World` | 環境貼圖 | 2048 |
| `TEXTUREGROUP_WorldNormalMap` | 環境法線 | 2048 |
| `TEXTUREGROUP_WorldSpecular` | 環境高光 | 2048 |
| `TEXTUREGROUP_Character` | 角色貼圖 | 4096（主角）/ 2048（NPC） |
| `TEXTUREGROUP_CharacterNormalMap` | 角色法線 | 4096 / 2048 |
| `TEXTUREGROUP_Weapon` | 武器貼圖 | 2048 |
| `TEXTUREGROUP_Vehicle` | 載具貼圖 | 2048 |
| `TEXTUREGROUP_UI` | UI 貼圖 | 依實際顯示尺寸 |
| `TEXTUREGROUP_Lightmap` | Lightmap | 由引擎管理 |
| `TEXTUREGROUP_Shadowmap` | Shadowmap | 由引擎管理 |
| `TEXTUREGROUP_Effects` | 特效貼圖 | 1024 |
| `TEXTUREGROUP_Skybox` | 天空盒 | 2048 |

### sRGB 設定

| 貼圖類型 | sRGB | 原因 |
|---------|------|------|
| Diffuse / Base Color | ✅ On | 色彩空間需要 Gamma 校正 |
| Normal Map | ❌ Off | 線性數值，不需 Gamma 校正 |
| Roughness / Metallic | ❌ Off | 線性數值 |
| ORM Packed | ❌ Off | 線性數值 |
| Emissive | ✅ On | 色彩空間 |
| Opacity / Alpha | ❌ Off | 線性數值 |
| Height / Displacement | ❌ Off | 線性數值 |
| Mask | ❌ Off | 線性數值 |
| UI 圖標 | ✅ On | 色彩空間 |

### Max Texture Size

根據平台設定最大貼圖尺寸限制：

| 平台 | 環境貼圖 | 角色貼圖 | UI 貼圖 | 特效貼圖 |
|------|---------|---------|---------|---------|
| PC（高階） | 4096 | 4096 | 2048 | 2048 |
| PC（中階） | 2048 | 2048 | 1024 | 1024 |
| PS5 / Xbox Series X | 4096 | 4096 | 2048 | 2048 |
| Nintendo Switch | 1024 | 1024 | 512 | 512 |
| iOS / Android | 1024 | 2048 | 512 | 512 |

### 貼圖最佳實踐

- **尺寸必須為 2 的冪次**：256, 512, 1024, 2048, 4096
- **使用 Texture Packing**：將 Occlusion、Roughness、Metallic 打包至單一貼圖的 R/G/B 通道（ORM Map）
- **啟用 Virtual Texture**：超大貼圖（如 Landscape）使用 Virtual Texture 減少記憶體佔用
- **避免不必要的 Alpha 通道**：無透明需求的貼圖不要包含 Alpha，節省 25% 記憶體
- **使用 Texture Streaming**：確保所有 3D 場景貼圖啟用 Streaming

---

## 網格設定

### Nanite 設定

Nanite 是 UE5 的虛擬化幾何系統，自動處理 LOD 與 Draw Call 合併。

**啟用條件**：

| 條件 | 要求 |
|------|------|
| 資產類型 | Static Mesh（不支援 Skeletal Mesh） |
| 面數 | 建議 > 10,000 三角面 |
| 材質 | 不支援透明材質（Translucent） |
| 動畫 | 不支援 World Position Offset（WPO）動畫 |
| Morph Target | 不支援 |

**Nanite 設定項目**：

- `Enable Nanite Support`：啟用 Nanite
- `Position Precision`：預設 Auto，僅在出現精度問題時手動調整
- `Fallback Triangle Percent`：Fallback Mesh 的三角面百分比，供不支援 Nanite 的平台使用
- `Trim Relative Error`：裁剪相對誤差，控制 Nanite 的簡化精度

**Nanite 最佳實踐**：

- 大量高面數環境物件（岩石、建築、地形裝飾）優先啟用 Nanite
- 少量低面數物件（< 1,000 面）不建議啟用，Nanite 的固定開銷可能超過收益
- 設定合理的 Fallback Mesh 確保跨平台相容性
- 搭配 Virtual Shadow Maps（VSM）使用效果最佳

### LOD 設定

非 Nanite 網格必須設定 LOD：

**LOD 級數建議**：至少 3-4 級

**LOD 切換距離**：

| 物件大小 | LOD0 | LOD1 | LOD2 | LOD3 |
|---------|------|------|------|------|
| 小型（< 1m） | 0-500 | 500-1500 | 1500-3000 | 3000+ |
| 中型（1-5m） | 0-2000 | 2000-5000 | 5000-10000 | 10000+ |
| 大型（> 5m） | 0-5000 | 5000-15000 | 15000-30000 | 30000+ |

**LOD Reduction 建議**：

- 每級 LOD 三角面數遞減約 **50%**
- LOD0：100%（原始網格）
- LOD1：50%
- LOD2：25%
- LOD3：12%

**LOD 最佳實踐**：

- 使用 `Generate LODs` 自動生成，再手動微調
- 確保 LOD 切換時無明顯的視覺跳變（Popping）
- 為最低級 LOD 設定 `Screen Size` 門檻，超出距離直接 Cull

### Collision 設定

| Collision 類型 | 用途 | 效能 |
|---------------|------|------|
| Simple Collision（Box/Sphere/Capsule） | 快速碰撞檢測，適合大多數情況 | ⭐⭐⭐ 最佳 |
| Convex Decomposition | 較精確的碰撞，自動生成凸包 | ⭐⭐ 良好 |
| Complex Collision（Use Complex as Simple） | 使用原始網格做碰撞，最精確但最耗效能 | ⭐ 較差 |

**Collision 最佳實踐**：

- **預設使用 Simple Collision**：Box、Sphere、Capsule 組合即可滿足大多數需求
- **避免 Complex as Simple**：僅在需要精確碰撞的特殊情況使用（如地形、複雜建築內部）
- **Convex Decomposition**：設定合理的 Hull Count（建議 4-8），過多會影響效能
- **碰撞通道設定**：為不同類型的物件設定專用的 Collision Channel，避免不必要的碰撞檢測

### Lightmap UV 設定

- **Lightmap UV Channel**：通常為 UV Channel 1（UV0 為材質 UV，UV1 為 Lightmap UV）
- **Lightmap Resolution**：
  - 小型物件：32-64
  - 中型物件：64-128
  - 大型物件：128-256
  - 地板/牆壁：256-512
- **Generate Lightmap UVs**：匯入時勾選自動生成，確保無重疊
- **Lightmap UV 規則**：
  - 所有面必須在 0-1 UV 空間內
  - 面與面之間需要足夠的 Padding（至少 2 像素）
  - 避免過度拉伸（Stretch）

### 網格匯入檢查清單

- [ ] 面數合理（環境物件 < 100K，角色 < 50K）
- [ ] 法線方向正確，無翻轉面
- [ ] UV 無重疊（UV0 材質用，UV1 Lightmap 用）
- [ ] Pivot Point 位置正確（通常在物件底部中心）
- [ ] Scale 為 1:1（1 UU = 1 cm）
- [ ] 已設定適當的 Collision
- [ ] 高面數網格已啟用 Nanite 或設定 LOD

---

## 音訊設定

### 壓縮設定

| 平台 | 推薦格式 | 品質 | 說明 |
|------|---------|------|------|
| PC | OGG Vorbis | Quality 40-60 | 平衡品質與檔案大小 |
| PS5 / Xbox | ADPCM 或 OGG | Quality 50-70 | 主機有專用解碼硬體 |
| iOS | AAC | Quality 50-60 | iOS 原生支援 |
| Android | OGG Vorbis | Quality 40-50 | 廣泛支援 |
| Nintendo Switch | ADPCM | Quality 40-50 | 記憶體受限 |

### 品質設定

根據音訊用途設定品質等級：

| 音訊類型 | 取樣率 | 位元深度 | 通道 | 品質 |
|---------|--------|---------|------|------|
| 音樂（BGM） | 44100 Hz | 16-bit | Stereo | 60-80 |
| 音效（SFX） | 44100 Hz | 16-bit | Mono | 40-60 |
| 環境音（Ambient） | 44100 Hz | 16-bit | Mono/Stereo | 40-60 |
| 語音（Voice） | 22050 Hz | 16-bit | Mono | 50-70 |
| UI 音效 | 22050 Hz | 16-bit | Mono | 40-50 |

### Streaming 設定

音訊 Streaming 決定音訊資料的載入方式：

| 載入方式 | 適用場景 | 記憶體影響 |
|---------|---------|----------|
| 完全載入（Non-Streaming） | 短音效（< 5 秒）、UI 音效 | 高（全部載入記憶體） |
| Streaming | 長音樂（> 10 秒）、環境音 | 低（按需載入） |
| Load on Demand | 不常用的音效 | 最低（使用時才載入） |

**Streaming 規則**：

- **短音效（< 5 秒）**：完全載入，避免 Streaming 延遲
- **中等長度（5-30 秒）**：視記憶體預算決定
- **長音樂（> 30 秒）**：必須啟用 Streaming
- **Streaming Chunk Size**：預設 64 KB，可根據需求調整

### Attenuation 設定

Sound Attenuation 控制音訊的空間衰減：

**衰減模型**：

| 模型 | 說明 | 適用場景 |
|------|------|---------|
| Linear | 線性衰減 | 簡單場景、UI 音效 |
| Logarithmic | 對數衰減（最接近真實物理） | 大多數 3D 音效 |
| Inverse | 反比衰減 | 室內環境 |
| Natural Sound | 自然衰減（UE5 推薦） | 寫實場景 |
| Custom Curve | 自訂衰減曲線 | 特殊需求 |

**衰減距離建議**：

| 音訊類型 | Inner Radius | Falloff Distance | Max Distance |
|---------|-------------|-----------------|-------------|
| 腳步聲 | 50 | 500 | 1500 |
| 武器射擊 | 100 | 2000 | 5000 |
| 環境音（小型） | 200 | 1000 | 3000 |
| 環境音（大型） | 500 | 3000 | 8000 |
| 爆炸 | 200 | 5000 | 10000 |
| NPC 語音 | 50 | 300 | 1000 |

**Attenuation 最佳實踐**：

- 使用 **Attenuation Settings Asset** 統一管理衰減設定，避免逐一設定
- 啟用 **Spatialization**（空間化）讓音訊具有方向感
- 設定 **Occlusion**（遮蔽）讓牆壁等障礙物影響音訊傳播
- 使用 **Reverb Send** 根據環境自動調整混響效果
- 設定合理的 **Max Distance**，超出距離的音訊不佔用 Voice Channel

### 音訊最佳實踐

- **Sound Cue vs MetaSound**：
  - Sound Cue：簡單的音訊播放與混合，適合快速原型
  - MetaSound：程序化音訊生成，適合複雜的動態音效系統
- **Sound Class 分層**：
  - Master → Music、SFX、Voice、Ambient、UI
  - 每個 Sound Class 可獨立控制音量與優先級
- **Sound Concurrency**：限制同時播放的相同音效數量，避免音訊堆疊
  - 腳步聲：Max Count 2-3
  - 武器射擊：Max Count 4-6
  - 環境音：Max Count 8-12
- **Voice Management**：
  - 設定全域最大 Voice 數量（PC: 64-128, 主機: 48-64, 行動裝置: 24-32）
  - 使用 Priority 系統確保重要音效不被截斷

---

## 資產驗證規則

### 通用規則

| 規則 | 嚴重度 | 說明 |
|------|--------|------|
| 命名規範 | Warning | 資產名稱必須符合 `[Prefix]_[Name]_[Variant]` 格式 |
| 資料夾位置 | Warning | 資產必須放在正確的功能資料夾下 |
| Missing Reference | Critical | 不得有斷裂的資產引用 |
| 重複資產 | Warning | 偵測內容相同但名稱不同的資產 |

### 貼圖驗證規則

| 規則 | 嚴重度 | 說明 |
|------|--------|------|
| 尺寸為 2 的冪次 | Critical | 非 2 的冪次無法正確生成 Mipmap 與壓縮 |
| 最大尺寸限制 | Warning | 超過平台建議的最大尺寸 |
| sRGB 設定正確 | Warning | Normal Map 等線性資料不應啟用 sRGB |
| Compression 設定正確 | Warning | 根據用途使用正確的壓縮格式 |
| 不必要的 Alpha 通道 | Info | 無透明需求的貼圖不應包含 Alpha |

### 網格驗證規則

| 規則 | 嚴重度 | 說明 |
|------|--------|------|
| 面數合理 | Warning | 超過建議面數上限 |
| 有 Collision | Warning | 需要碰撞的網格必須設定 Collision |
| 有 Lightmap UV | Warning | 使用 Static Lighting 的網格需要 Lightmap UV |
| Nanite 相容性 | Info | 高面數 Static Mesh 建議啟用 Nanite |
| LOD 設定 | Warning | 非 Nanite 網格必須設定 LOD |
| Scale 正確 | Warning | 匯入 Scale 應為 1.0（1 UU = 1 cm） |

### 音訊驗證規則

| 規則 | 嚴重度 | 說明 |
|------|--------|------|
| 取樣率一致 | Warning | 專案內音訊取樣率應統一 |
| 長音訊啟用 Streaming | Warning | 超過 10 秒的音訊應啟用 Streaming |
| 有 Attenuation 設定 | Warning | 3D 音效必須設定 Attenuation |
| Sound Class 已指定 | Info | 音訊應歸類至正確的 Sound Class |
| 壓縮品質合理 | Info | 品質設定應符合音訊類型的建議範圍 |
