# Unreal Engine Blueprint 設計模式

本文件定義 Unreal Engine 5 專案的 Blueprint 設計模式、常見反模式與最佳實踐。Kiro 在提供 Blueprint 相關建議時應參照本文件。

---

## 設計模式

### Component Pattern（元件模式）

將功能拆分為獨立的 Actor Component，每個 Component 負責單一職責。

**適用場景**：角色系統、武器系統、互動系統等需要模組化組合的功能。

**結構**：

```
BP_Character_Player
├── HealthComponent        # 生命值管理
├── CombatComponent        # 戰鬥邏輯
├── InventoryComponent     # 背包系統
├── InteractionComponent   # 互動偵測
└── MovementComponent      # 移動邏輯（引擎內建）
```

**實作要點**：

- 每個 Component 只負責一個功能領域
- Component 之間透過 **Event Dispatcher** 或 **Interface** 通訊，不直接引用
- Component 可在不同 Actor 之間重用（如 HealthComponent 可用於玩家與敵人）
- 使用 `GetComponentByClass` 動態取得 Component，避免硬編碼引用

**範例：HealthComponent**

```
HealthComponent
├── Variables
│   ├── MaxHealth (Float, EditAnywhere)
│   ├── CurrentHealth (Float, BlueprintReadOnly)
│   └── bIsDead (Boolean, BlueprintReadOnly)
├── Functions
│   ├── TakeDamage(Amount, DamageType) → Float
│   ├── Heal(Amount) → Float
│   └── GetHealthPercent() → Float
└── Event Dispatchers
    ├── OnHealthChanged(NewHealth, MaxHealth)
    ├── OnDamaged(Amount, DamageType)
    └── OnDeath()
```

**優點**：高重用性、易於測試、職責清晰
**缺點**：Component 過多時管理複雜度增加

---

### Interface Pattern（介面模式）

使用 Blueprint Interface 定義通訊契約，解耦 Actor 之間的依賴。

**適用場景**：不同類型的 Actor 需要共同行為（如可互動、可受傷、可拾取）。

**常用 Interface 定義**：

| Interface | 函數 | 用途 |
|-----------|------|------|
| `BPI_Interactable` | `Interact(Caller)`, `GetInteractionText()` | 可互動物件 |
| `BPI_Damageable` | `TakeDamage(Amount, Type)`, `IsAlive()` | 可受傷物件 |
| `BPI_Pickupable` | `Pickup(Collector)`, `GetItemData()` | 可拾取物件 |
| `BPI_Saveable` | `SaveState()`, `LoadState(Data)` | 可存檔物件 |
| `BPI_Targetable` | `GetTargetLocation()`, `IsValidTarget()` | 可鎖定目標 |

**實作要點**：

- Interface 只定義「做什麼」，不定義「怎麼做」
- 使用 `Does Implement Interface` 節點檢查 Actor 是否實作特定 Interface
- 優先使用 Interface Message（非同步）而非 Interface Call（同步），避免 Cast 開銷
- Interface 函數可有回傳值，用於查詢型操作

**呼叫方式比較**：

| 方式 | 效能 | 耦合度 | 適用場景 |
|------|------|--------|---------|
| Direct Cast | 最快 | 高 | 確定類型時 |
| Interface Message | 快 | 低 | 跨類型通訊 |
| Interface Call | 快 | 低 | 需要回傳值 |
| Event Dispatcher | 中 | 最低 | 一對多通知 |

---

### Event-Driven Pattern（事件驅動模式）

使用 Event Dispatcher 與 Delegate 實現鬆耦合的事件通知機制。

**適用場景**：狀態變更通知、UI 更新、成就系統、音效觸發等一對多通訊。

**結構**：

```
事件發送者（Publisher）
  └── Event Dispatcher: OnStateChanged

事件接收者（Subscriber）
  └── Bind Event → 執行回應邏輯
```

**常見事件模式**：

| 事件 | 發送者 | 接收者 | 用途 |
|------|--------|--------|------|
| `OnHealthChanged` | HealthComponent | HUD Widget、音效系統 | 更新血條、播放受傷音效 |
| `OnItemPickedUp` | PickupActor | InventoryComponent、UI | 加入背包、顯示提示 |
| `OnEnemyDied` | EnemyActor | ScoreManager、QuestSystem | 計分、任務進度 |
| `OnLevelLoaded` | GameMode | UI、AudioManager | 顯示載入畫面、播放音樂 |

**實作要點**：

- Event Dispatcher 定義在發送者，接收者負責 Bind/Unbind
- 在 `BeginPlay` 中 Bind，在 `EndPlay` 中 Unbind，避免記憶體洩漏
- 避免在 Event Dispatcher 中傳遞過多參數（建議 < 4 個）
- 使用 `IsValid` 檢查 Bind 的目標是否仍然存在

**與 Gameplay Tag Event 的搭配**：

- 使用 Gameplay Tag 作為事件的識別標籤
- 透過 `Ability System Component` 的 Tag Event 實現 GAS 層級的事件通知
- 適合技能系統、Buff/Debuff 狀態變更等場景

---

### Data-Driven Pattern（資料驅動模式）

將遊戲數據與邏輯分離，使用 Data Asset 或 Data Table 管理配置。

**適用場景**：武器數值、技能參數、物品資料庫、敵人配置等需要頻繁調整的資料。

**資料來源選擇**：

| 資料來源 | 適用場景 | 優點 | 缺點 |
|---------|---------|------|------|
| Data Table | 大量同類型資料（物品列表、敵人列表） | Excel 匯入、批次編輯 | 結構固定 |
| Data Asset | 單一複雜配置（武器定義、技能定義） | 結構靈活、Blueprint 友善 | 不適合大量資料 |
| Curve Table | 數值曲線（傷害衰減、經驗曲線） | 視覺化編輯 | 僅限數值 |
| Gameplay Tag | 標籤系統（狀態標記、技能分類） | 階層式管理、高效查詢 | 僅限標籤 |

**Data Asset 範例：武器定義**

```
DA_Weapon_Rifle (UPrimaryDataAsset)
├── DisplayName: "突擊步槍"
├── WeaponMesh: SM_Rifle_01
├── BaseDamage: 25.0
├── FireRate: 600 RPM
├── MagazineSize: 30
├── ReloadTime: 2.5s
├── SpreadPattern: Random
├── DamageType: GE_Damage_Bullet
├── MuzzleFlash: NS_MuzzleFlash_Rifle
├── FireSound: SC_Rifle_Fire
└── ReloadSound: SC_Rifle_Reload
```

**實作要點**：

- 遊戲數值全部放在 Data Asset / Data Table，Blueprint 只負責讀取與執行
- 使用 `Asset Manager` 管理 Data Asset 的載入與卸載
- Data Table 使用 `Row Handle` 引用，避免硬編碼 Row Name
- 設計師可直接在 Editor 中修改資料，無需修改 Blueprint

---

## 常見反模式

### ❌ God Blueprint（上帝 Blueprint）

**問題**：單一 Blueprint 包含過多邏輯，節點數超過 500 個，難以維護與除錯。

**症狀**：
- Event Graph 需要大量縮放才能看到全貌
- 單一 Blueprint 檔案超過 1 MB
- 多人協作時頻繁發生合併衝突
- 修改一個功能可能影響其他不相關的功能

**修復策略**：
1. **拆分為 Component**：將獨立功能移至 Actor Component
2. **使用 Function Library**：將通用邏輯移至 Blueprint Function Library
3. **使用 Macro Library**：將重複的節點組合封裝為 Macro
4. **遵循單一職責原則**：每個 Blueprint 只負責一個功能領域

**判斷標準**：
- 節點數 > 200：考慮拆分
- 節點數 > 500：必須拆分
- 變數數 > 30：考慮拆分
- Event Graph 超過 3 個：考慮拆分

---

### ❌ Spaghetti Nodes（義大利麵節點）

**問題**：節點連線雜亂無章，執行流程難以追蹤，維護成本極高。

**症狀**：
- 連線交叉超過 10 處
- 無法一眼看出執行流程
- 大量使用 Reroute Node 但仍然混亂
- 缺少 Comment Box 分組

**修復策略**：
1. **使用 Comment Box**：將相關節點用 Comment Box 分組並標註用途
2. **使用 Function**：將複雜邏輯封裝為 Function，保持 Event Graph 簡潔
3. **使用 Reroute Node**：整理連線路徑，避免交叉
4. **左到右排列**：執行流程從左到右，資料流從上到下
5. **對齊節點**：使用 Editor 的對齊功能保持整齊

**排版規則**：
- 執行流程（白線）：水平方向，從左到右
- 資料流（彩色線）：盡量垂直方向
- 每個 Comment Box 內的節點不超過 15 個
- Function 的輸入/輸出參數不超過 6 個

---

### ❌ Cast Abuse（Cast 濫用）

**問題**：過度使用 `Cast To` 節點造成類別之間的強耦合，且 Cast 失敗時產生效能開銷。

**症狀**：
- 大量 `Cast To` 節點指向具體的 Blueprint 類別
- Cast 失敗時沒有處理邏輯
- 不同模組的 Blueprint 互相 Cast
- 載入一個 Blueprint 時連帶載入大量其他 Blueprint（Reference Chain）

**修復策略**：
1. **使用 Interface**：透過 Interface 通訊，避免直接 Cast
2. **使用 Gameplay Tag**：用 Tag 查詢替代類型檢查
3. **使用 Component 查詢**：`GetComponentByClass` 替代 Cast 到具體 Actor
4. **快取 Cast 結果**：必須 Cast 時，將結果存為變數避免重複 Cast

**效能影響**：
- Cast 成功：幾乎無開銷
- Cast 失敗：產生 Warning Log，頻繁失敗會影響效能
- Cast 造成的 Hard Reference：增加記憶體佔用與載入時間

---

### ❌ Tick Abuse（Tick 濫用）

**問題**：在 `Event Tick` 中執行不需要每幀更新的邏輯，浪費 CPU 資源。

**症狀**：
- Event Tick 中包含 Line Trace、Get All Actors、Asset Loading 等重操作
- 場景中超過 50 個 Actor 啟用 Tick
- Tick 中執行條件檢查但大多數幀都不滿足條件
- UI Widget 使用 Tick 更新顯示內容

**修復策略**：
1. **使用 Timer**：`Set Timer by Function Name` 設定合理的更新間隔
2. **使用 Event-Driven**：狀態變更時才執行邏輯
3. **設定 Tick Interval**：降低 Tick 頻率（如 0.1 秒一次）
4. **停用不需要的 Tick**：`Set Actor Tick Enabled = false`
5. **使用 Significance Manager**：根據距離動態調整 Tick 頻率

**替代方案對照**：

| Tick 中的操作 | 替代方案 |
|-------------|---------|
| 檢查玩家距離 | Timer（0.2-0.5 秒間隔） |
| 更新 UI 數值 | Event Dispatcher / Property Binding |
| 檢查輸入狀態 | Enhanced Input Action Event |
| 偵測周圍物件 | Overlap Event / Timer + Sphere Trace |
| 動畫狀態更新 | Animation Blueprint 的 Event Graph |
| 檢查 Gameplay Tag | Tag Change Delegate |

---

## 最佳實踐

### 命名規範

#### Blueprint 資產命名

| 類型 | 前綴 | 範例 |
|------|------|------|
| Actor Blueprint | `BP_` | `BP_Pickup_HealthPotion` |
| Actor Component | `BPC_` | `BPC_Health` |
| Widget Blueprint | `WBP_` | `WBP_HUD_HealthBar` |
| Animation Blueprint | `ABP_` | `ABP_Character_Player` |
| Blueprint Interface | `BPI_` | `BPI_Interactable` |
| Blueprint Function Library | `BPFL_` | `BPFL_MathUtils` |
| Blueprint Macro Library | `BPML_` | `BPML_CommonMacros` |
| Enum | `E_` | `E_WeaponType` |
| Struct | `F_` | `F_ItemData` |

#### 變數命名

| 類型 | 規則 | 範例 |
|------|------|------|
| Boolean | `b` 前綴 + 正面描述 | `bIsAlive`, `bCanJump`, `bHasWeapon` |
| Integer / Float | 描述性名稱 | `CurrentHealth`, `MaxAmmo`, `MoveSpeed` |
| Array | 複數名稱 | `Enemies`, `InventoryItems`, `WaypointLocations` |
| Map | Key + Value 描述 | `ItemCountMap`, `PlayerScoreMap` |
| Object Reference | 類型 + 用途 | `TargetActor`, `EquippedWeapon`, `OwnerCharacter` |
| Component Reference | 類型名稱 | `HealthComp`, `CombatComp`, `MeshComp` |

#### Function 命名

| 動作 | 前綴 | 範例 |
|------|------|------|
| 取得資料 | `Get` | `GetHealthPercent`, `GetEquippedWeapon` |
| 設定資料 | `Set` | `SetMaxHealth`, `SetMoveSpeed` |
| 檢查條件 | `Is` / `Has` / `Can` | `IsAlive`, `HasAmmo`, `CanAttack` |
| 執行動作 | 動詞開頭 | `TakeDamage`, `FireWeapon`, `OpenDoor` |
| 初始化 | `Init` / `Setup` | `InitInventory`, `SetupWeapon` |
| 事件處理 | `Handle` / `On` | `HandleDamage`, `OnItemPickedUp` |

### 組織結構

#### Event Graph 組織

- **一個 Event Graph 只處理一個主題**：如 Combat、Movement、Interaction
- **使用 Comment Box 分組**：每個邏輯區塊用 Comment Box 標註
- **複雜邏輯封裝為 Function**：Event Graph 只負責事件路由
- **保持 Event Graph 簡潔**：理想狀態下一個 Event Graph 不超過 30 個節點

#### Function 組織

- **按功能分類**：使用 Category 將 Function 分組（如 Combat、Movement、UI）
- **單一職責**：每個 Function 只做一件事
- **參數數量**：輸入參數不超過 6 個，超過時考慮使用 Struct
- **回傳值**：優先使用 Return Node，避免使用 Output Parameter 模擬多回傳值
- **Pure Function**：無副作用的查詢函數標記為 Pure（綠色節點）

#### Variable 組織

- **使用 Category 分組**：如 Stats、References、Config、State
- **設定存取權限**：
  - `Private`：僅本 Blueprint 存取
  - `BlueprintReadOnly`：外部只能讀取
  - `BlueprintReadWrite`：外部可讀寫（謹慎使用）
  - `EditAnywhere`：可在 Editor 中編輯
  - `EditDefaultsOnly`：僅在 Class Default 中編輯
  - `EditInstanceOnly`：僅在實例上編輯

### 效能注意事項

#### 避免的操作

| 操作 | 效能影響 | 替代方案 |
|------|---------|---------|
| `Get All Actors of Class` | 🔴 高 | 使用 Tag 查詢或快取引用 |
| `Cast To`（頻繁失敗） | 🟡 中 | 使用 Interface |
| `Tick` 中的 Line Trace | 🔴 高 | Timer + 降低頻率 |
| `Tick` 中的 Get Component | 🟡 中 | BeginPlay 時快取 |
| `For Each Loop`（大量元素） | 🟡 中 | 考慮移至 C++ |
| `Delay` 節點大量使用 | 🟡 中 | 使用 Timer Manager |
| `Print String`（正式版本） | 🟡 中 | 使用 Log 系統或移除 |

#### 快取策略

- **BeginPlay 快取**：在 `BeginPlay` 中取得並快取常用的 Component、Actor 引用
- **避免重複查詢**：同一幀內不要多次呼叫 `GetComponentByClass` 或 `GetActorOfClass`
- **使用 Soft Reference**：非立即需要的資產使用 `Soft Object Reference` 延遲載入
- **Validated Get**：使用 `Validated Get` 節點避免重複的 `IsValid` 檢查

### 除錯技巧

#### Blueprint Debugger

- **Breakpoint**：在節點上按 `F9` 設定斷點，執行到該節點時暫停
- **Watch Value**：在 Debug 模式下監看變數值的即時變化
- **Step Into / Step Over**：逐步執行節點，追蹤執行流程
- **Call Stack**：查看函數呼叫堆疊，追蹤事件來源

#### 常用除錯節點

| 節點 | 用途 | 注意事項 |
|------|------|---------|
| `Print String` | 快速輸出除錯訊息 | 正式版本前移除 |
| `Draw Debug Line/Sphere` | 視覺化空間資訊 | 僅 Development Build |
| `Log` | 輸出至 Output Log | 設定適當的 Verbosity |
| `Ensure` / `Check` | 斷言檢查 | 僅 Debug Build 生效 |

#### 效能分析

- 使用 `stat game` 查看 Blueprint 的 CPU 時間
- 使用 **Blueprint Profiler**（Window → Developer Tools → Blueprint Profiler）分析各 Blueprint 的執行時間
- 使用 `stat startfile` / `stat stopfile` 錄製效能追蹤檔，在 Unreal Insights 中分析

---

## Blueprint 通訊模式

### Interface 通訊

**適用場景**：不同類型的 Actor 之間的標準化通訊。

```
發送者                          接收者
[Any Actor] → Interface Message → [實作 Interface 的 Actor]
```

**優點**：低耦合、無需知道接收者的具體類型
**缺點**：需要預先定義 Interface、單向通訊

**使用時機**：
- 玩家與可互動物件的互動
- 傷害系統（任何物件都可受傷）
- 存檔系統（任何物件都可存檔）

---

### Event Dispatcher 通訊

**適用場景**：一對多的事件通知，發送者不需要知道接收者。

```
發送者                              接收者（多個）
[Publisher] → Event Dispatcher → [Subscriber A]
                               → [Subscriber B]
                               → [Subscriber C]
```

**優點**：完全解耦、支援一對多、動態 Bind/Unbind
**缺點**：需要管理 Bind/Unbind 生命週期、除錯較困難

**使用時機**：
- 生命值變更通知 UI、音效、特效
- 遊戲狀態變更通知所有相關系統
- 物品拾取通知背包、任務、成就系統

**生命週期管理**：

```
BeginPlay:
  → Get Reference to Publisher
  → Bind Event to Publisher's Dispatcher

EndPlay:
  → Unbind Event（避免記憶體洩漏）
```

---

### Gameplay Tag 通訊

**適用場景**：基於標籤的狀態查詢與事件通知，特別適合 GAS 系統。

```
[Actor A] → Add Tag "State.Burning"
[Actor B] → Listen for Tag "State.Burning" → 執行回應
```

**優點**：階層式管理、高效查詢、與 GAS 深度整合
**缺點**：僅適合狀態標記，不適合傳遞複雜資料

**常見 Tag 階層**：

```
State
├── State.Alive
├── State.Dead
├── State.Stunned
├── State.Burning
└── State.Frozen

Ability
├── Ability.Melee
├── Ability.Ranged
├── Ability.Magic
└── Ability.Ultimate

Damage
├── Damage.Physical
├── Damage.Fire
├── Damage.Ice
└── Damage.Electric
```

**使用時機**：
- 技能系統的狀態管理（免疫、增益、減益）
- 技能互斥與前置條件檢查
- AI 行為樹的條件判斷

---

### 通訊模式選擇指南

| 需求 | 推薦模式 | 原因 |
|------|---------|------|
| A 呼叫 B 的功能 | Interface | 低耦合，B 的類型可變 |
| A 通知多個物件 | Event Dispatcher | 一對多，完全解耦 |
| 查詢物件狀態 | Gameplay Tag | 高效查詢，階層式管理 |
| 全域事件通知 | Game Instance Subsystem + Event | 跨 Level 持久 |
| 父子 Actor 通訊 | Direct Reference | 已知關係，效能最佳 |
| UI 與遊戲邏輯 | Event Dispatcher / ViewModel | MVC 分離 |
