# Unreal Engine 架構規範

本文件定義 Unreal Engine 5 專案的架構規範，涵蓋 Blueprint 與 C++ 的職責分配、模組化設計原則與命名規範。Kiro 在提供架構相關建議時應參照本文件。

---

## Blueprint vs C++ 職責分配

### 核心原則

Blueprint 與 C++ 各有優勢，正確的職責分配是專案可維護性的關鍵。基本原則：**C++ 負責「怎麼做」，Blueprint 負責「做什麼」**。

### C++ 適用場景

以下邏輯應使用 C++ 實作：

- **效能敏感程式碼**：每幀執行的計算、大量迭代、複雜演算法
- **核心系統基礎類別**：Character Base、GameMode Base、GameState Base
- **底層框架**：網路同步邏輯、資料序列化、檔案 I/O
- **數學與物理計算**：自訂碰撞檢測、路徑計算、程序化生成演算法
- **第三方程式庫整合**：SDK 整合、平台特定 API
- **GAS 核心**：Gameplay Effect Execution Calculation、自訂 Ability Task
- **資料結構與管理**：Subsystem、Data Asset 定義、Save Game 結構

### Blueprint 適用場景

以下邏輯適合使用 Blueprint 實作：

- **遊戲邏輯與行為**：任務系統流程、對話觸發、關卡事件
- **設計師可調參數**：數值平衡、技能參數、AI 行為配置
- **快速原型與迭代**：新功能原型、遊戲機制實驗
- **視覺化邏輯**：動畫 Blueprint（AnimBP）、UI Widget 邏輯
- **關卡腳本**：觸發器邏輯、過場動畫控制、環境互動
- **AI 行為樹**：Behavior Tree 的 Task、Decorator、Service
- **材質與特效**：Material Blueprint、Niagara 模組

### 混合架構模式

推薦的 C++ / Blueprint 混合架構：

```
C++ Base Class（核心邏輯）
  └── Blueprint Child Class（遊戲邏輯 + 設計師參數）
        └── Blueprint Instance（關卡特定設定）
```

**範例：角色系統**

```
ACharacterBase (C++)
├── 移動系統核心邏輯
├── GAS 初始化
├── 網路同步
└── 效能敏感計算

  └── BP_Character_Player (Blueprint)
      ├── 技能配置（DataTable 引用）
      ├── 動畫設定（AnimBP 引用）
      ├── 視覺效果（Niagara 引用）
      └── 設計師可調參數（MaxHealth, MoveSpeed 等）
```

**範例：武器系統**

```
AWeaponBase (C++)
├── 射擊邏輯（Hitscan / Projectile）
├── 彈道計算
├── 網路同步
└── 傷害計算

  └── BP_Weapon_Rifle (Blueprint)
      ├── 武器數值（Damage, FireRate, Spread）
      ├── 視覺效果（MuzzleFlash, Tracer）
      ├── 音效設定
      └── 動畫 Montage 引用
```

### 職責分配檢查清單

| 問題 | 是 → C++ | 否 → Blueprint |
|------|----------|---------------|
| 每幀執行且效能敏感？ | ✅ | |
| 需要多執行緒？ | ✅ | |
| 涉及底層引擎 API？ | ✅ | |
| 設計師需要調整參數？ | | ✅ |
| 需要快速迭代？ | | ✅ |
| 涉及視覺化流程？ | | ✅ |
| 需要網路同步？ | ✅（核心） | ✅（觸發） |
| 資料結構定義？ | ✅ | |

### 常見錯誤

- ❌ 在 Blueprint 中實作複雜的數學計算或大量迴圈
- ❌ 在 C++ 中硬編碼遊戲數值（應暴露為 `UPROPERTY` 讓 Blueprint 覆寫）
- ❌ Blueprint 直接存取其他 Blueprint 的內部變數（應透過 Interface 或 Event）
- ❌ 所有邏輯都放在 C++（降低設計師的迭代速度）
- ❌ 所有邏輯都放在 Blueprint（效能問題且難以版本控制）

---

## 模組化設計

### 功能模組劃分原則

Unreal Engine 專案應按功能領域劃分為獨立模組（Module / Plugin）：

```
MyGame/
├── Core/              # 核心框架（不依賴任何遊戲模組）
│   ├── Types/         # 共用型別定義
│   ├── Interfaces/    # 共用介面
│   └── Utilities/     # 工具函數
├── Character/         # 角色系統
│   ├── Movement/
│   ├── Combat/
│   └── Animation/
├── AI/                # AI 系統
│   ├── BehaviorTree/
│   ├── EQS/
│   └── Perception/
├── UI/                # UI 系統
│   ├── HUD/
│   ├── Menus/
│   └── CommonUI/
├── World/             # 世界系統
│   ├── Levels/
│   ├── Environment/
│   └── Streaming/
└── GameFramework/     # 遊戲框架
    ├── GameMode/
    ├── GameState/
    └── SaveSystem/
```

### 依賴方向規則

模組之間的依賴必須遵循單向原則，避免循環依賴：

```
GameFramework → Character → Core
GameFramework → AI → Core
GameFramework → UI → Core
World → Core

❌ Core → Character（反向依賴）
❌ Character ↔ AI（循環依賴）
```

**依賴規則**：

1. **Core 模組不依賴任何遊戲模組**：Core 只包含型別、介面與工具
2. **高層模組可依賴低層模組**：GameFramework 可依賴 Character，反之不行
3. **同層模組透過介面通訊**：Character 與 AI 透過 Interface 互動，不直接引用
4. **避免跨模組的 Hard Reference**：使用 Soft Reference 或 Event/Delegate 解耦

### 介面設計模式

使用 Unreal Interface（`UInterface`）解耦模組間的依賴：

```cpp
// Core/Interfaces/IDamageable.h
UINTERFACE(MinimalAPI)
class UDamageable : public UInterface { GENERATED_BODY() };

class IDamageable {
    GENERATED_BODY()
public:
    virtual float TakeDamage(float Amount, const FDamageInfo& Info) = 0;
    virtual bool IsAlive() const = 0;
};
```

```cpp
// Character 模組實作 IDamageable
// AI 模組透過 IDamageable 介面與 Character 互動，無需直接引用 Character 模組
if (IDamageable* Target = Cast<IDamageable>(HitActor)) {
    Target->TakeDamage(Damage, DamageInfo);
}
```

### Subsystem 模式

使用 **Subsystem** 管理全域服務，避免 Singleton 反模式：

- `UGameInstanceSubsystem`：遊戲全域服務（Save System、Audio Manager）
- `UWorldSubsystem`：世界級服務（Spawn Manager、Weather System）
- `ULocalPlayerSubsystem`：玩家級服務（Input Manager、Settings）

```cpp
// 存取 Subsystem（無需手動管理生命週期）
UMySaveSubsystem* SaveSystem = GetGameInstance()->GetSubsystem<UMySaveSubsystem>();
```

### 模組化檢查清單

- [ ] 每個模組有明確的職責邊界
- [ ] 模組間無循環依賴
- [ ] 跨模組通訊使用 Interface 或 Event
- [ ] Core 模組不依賴遊戲模組
- [ ] 全域服務使用 Subsystem 而非 Singleton
- [ ] 模組可獨立編譯與測試

---

## 命名規範

### 資產命名規則

所有資產遵循 `[Prefix]_[Name]_[Variant/Suffix]` 格式：

#### 通用前綴表

| 資產類型 | 前綴 | 範例 |
|---------|------|------|
| Blueprint | `BP_` | `BP_Character_Player` |
| Static Mesh | `SM_` | `SM_Rock_Large` |
| Skeletal Mesh | `SK_` | `SK_Character_Male` |
| Material | `M_` | `M_Metal_Rusty` |
| Material Instance | `MI_` | `MI_Metal_Rusty_Dark` |
| Texture（Diffuse） | `T_` | `T_Rock_D` |
| Texture（Normal） | `T_` | `T_Rock_N` |
| Texture（ORM） | `T_` | `T_Rock_ORM` |
| Animation Sequence | `AS_` | `AS_Character_Run` |
| Animation Montage | `AM_` | `AM_Character_Attack01` |
| Animation Blueprint | `ABP_` | `ABP_Character_Player` |
| Sound Wave | `SW_` | `SW_Footstep_Concrete` |
| Sound Cue | `SC_` | `SC_Footstep_Concrete` |
| Particle System（Niagara） | `NS_` | `NS_Fire_Campfire` |
| Widget Blueprint | `WBP_` | `WBP_HUD_Main` |
| Data Asset | `DA_` | `DA_Weapon_Rifle` |
| Data Table | `DT_` | `DT_ItemDatabase` |
| Enum | `E_` | `E_WeaponType` |
| Struct | `F_` | `F_WeaponData` |
| Interface | `I_` | `I_Damageable` |
| Game Mode | `GM_` | `GM_Battle` |
| Game State | `GS_` | `GS_Battle` |
| Player Controller | `PC_` | `PC_Default` |
| Player State | `PS_` | `PS_Default` |
| AI Controller | `AIC_` | `AIC_Enemy_Melee` |
| Behavior Tree | `BT_` | `BT_Enemy_Patrol` |
| Blackboard | `BB_` | `BB_Enemy_Default` |
| EQS Query | `EQS_` | `EQS_FindCover` |
| Gameplay Ability | `GA_` | `GA_FireBall` |
| Gameplay Effect | `GE_` | `GE_Damage_Fire` |
| Gameplay Cue | `GC_` | `GC_Impact_Fire` |
| Input Action | `IA_` | `IA_Move` |
| Input Mapping Context | `IMC_` | `IMC_Default` |
| Level Sequence | `LS_` | `LS_Intro_Cutscene` |
| Render Target | `RT_` | `RT_Minimap` |
| Physical Material | `PM_` | `PM_Concrete` |
| Curve | `C_` | `C_Damage_Falloff` |

#### 貼圖後綴規則

| 用途 | 後綴 | 範例 |
|------|------|------|
| Diffuse / Base Color | `_D` | `T_Rock_D` |
| Normal Map | `_N` | `T_Rock_N` |
| Roughness | `_R` | `T_Rock_R` |
| Metallic | `_M` | `T_Rock_M` |
| Occlusion/Roughness/Metallic | `_ORM` | `T_Rock_ORM` |
| Emissive | `_E` | `T_Rock_E` |
| Opacity / Alpha | `_A` | `T_Leaf_A` |
| Height / Displacement | `_H` | `T_Rock_H` |
| Flowmap | `_F` | `T_Water_F` |
| Mask | `_Mask` | `T_Character_Mask` |

### Blueprint 命名規則

```
BP_[Category]_[Name]
```

- **Category** 表示功能分類：Character、Weapon、Pickup、Interactable、Vehicle 等
- **Name** 使用 PascalCase，描述具體用途

**範例**：
- `BP_Character_Player`
- `BP_Weapon_Rifle`
- `BP_Pickup_HealthPotion`
- `BP_Interactable_Door`
- `BP_Vehicle_Car`

### C++ 命名規則

遵循 Unreal Engine 編碼標準：

| 類型 | 前綴 | 範例 |
|------|------|------|
| UObject 衍生類別 | `U` | `UHealthComponent` |
| AActor 衍生類別 | `A` | `AWeaponBase` |
| SWidget 衍生類別 | `S` | `SInventorySlot` |
| Interface | `I` | `IDamageable` |
| Enum | `E` | `EWeaponType` |
| Struct | `F` | `FWeaponData` |
| Template | `T` | `TWeaponArray` |
| Boolean 變數 | `b` | `bIsAlive` |
| Delegate | `F...Delegate` | `FOnHealthChanged` |

### 資料夾結構規範

```
Content/
├── _Core/                    # 核心共用資產
│   ├── Materials/
│   ├── Textures/
│   └── Meshes/
├── Characters/               # 角色相關
│   ├── Player/
│   │   ├── Meshes/
│   │   ├── Textures/
│   │   ├── Materials/
│   │   ├── Animations/
│   │   └── Blueprints/
│   └── Enemies/
│       ├── Goblin/
│       └── Dragon/
├── Weapons/                  # 武器系統
│   ├── Rifle/
│   └── Sword/
├── Environment/              # 環境資產
│   ├── Nature/
│   ├── Buildings/
│   └── Props/
├── UI/                       # UI 資產
│   ├── HUD/
│   ├── Menus/
│   └── Icons/
├── Audio/                    # 音訊資產
│   ├── Music/
│   ├── SFX/
│   └── Ambient/
├── VFX/                      # 視覺特效
│   ├── Niagara/
│   └── Materials/
├── Levels/                   # 關卡
│   ├── MainMenu/
│   ├── Level01/
│   └── TestMaps/
├── Data/                     # 資料資產
│   ├── DataTables/
│   ├── DataAssets/
│   └── Curves/
├── AI/                       # AI 資產
│   ├── BehaviorTrees/
│   ├── Blackboards/
│   └── EQS/
├── GAS/                      # GAS 資產
│   ├── Abilities/
│   ├── Effects/
│   └── Cues/
├── Input/                    # 輸入設定
│   ├── Actions/
│   └── MappingContexts/
└── _Dev/                     # 開發用（不打包）
    ├── TestAssets/
    └── Prototypes/
```

### 資料夾規則

1. **按功能分類，非按資產類型**：`Characters/Player/Textures/` 而非 `Textures/Characters/Player/`
2. **使用 `_` 前綴的資料夾排在最前**：`_Core/`、`_Dev/`
3. **開發用資產放在 `_Dev/`**：測試地圖、原型資產等，可在打包時排除
4. **避免過深的資料夾層級**：建議不超過 **5 層**
5. **每個功能模組自包含**：角色的 Mesh、Texture、Material、Animation 放在同一資料夾下

---

## 架構反模式

### ❌ God Blueprint

- **問題**：單一 Blueprint 包含過多邏輯（> 500 個節點）
- **修復**：拆分為多個 Component，每個 Component 負責單一職責
- **範例**：將 `BP_Character` 中的戰鬥邏輯拆分為 `BP_CombatComponent`

### ❌ 直接引用（Tight Coupling）

- **問題**：Blueprint A 直接 Cast 到 Blueprint B 存取變數
- **修復**：使用 Interface、Event Dispatcher 或 Gameplay Tag 解耦
- **範例**：敵人不直接引用玩家 Blueprint，而是透過 `IDamageable` 介面互動

### ❌ 過度使用 Level Blueprint

- **問題**：關卡邏輯全部寫在 Level Blueprint 中，無法重用
- **修復**：將邏輯移至可重用的 Actor Blueprint 或 Component
- **範例**：門的開關邏輯應在 `BP_Interactable_Door` 中，而非 Level Blueprint

### ❌ Singleton 濫用

- **問題**：使用靜態變數或全域函數管理遊戲狀態
- **修復**：使用 Unreal 的 Subsystem 系統管理全域服務
- **範例**：Save System 應使用 `UGameInstanceSubsystem` 而非靜態類別

### ❌ 忽略網路架構

- **問題**：開發時未考慮多人遊戲架構，後期難以加入網路同步
- **修復**：從一開始就使用 Server-Authoritative 架構設計
- **範例**：傷害計算在 Server 執行，Client 只負責顯示效果
