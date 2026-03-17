# UMG Widget Design Patterns

This document provides design patterns, best practices, and anti-patterns for Unreal Engine's UMG (Unreal Motion Graphics) UI system and Common UI plugin. Kiro should reference this document when providing UI-related guidance.

---

## Widget Architecture

### Widget Hierarchy

A well-structured widget hierarchy separates concerns and enables reuse:

```
HUD_Root (WBP_HUD_Main)
├── TopBar
│   ├── HealthBar (WBP_HealthBar)
│   ├── ManaBar (WBP_ManaBar)
│   └── BuffContainer (WBP_BuffContainer)
├── Crosshair (WBP_Crosshair)
├── BottomBar
│   ├── AbilityBar (WBP_AbilityBar)
│   ├── AmmoCounter (WBP_AmmoCounter)
│   └── InteractionPrompt (WBP_InteractionPrompt)
├── Minimap (WBP_Minimap)
├── DamageIndicator (WBP_DamageIndicator)
└── ObjectiveTracker (WBP_ObjectiveTracker)
```

**Guidelines**:

- Each widget should have a single responsibility
- Use composition over inheritance — combine small widgets into larger layouts
- Keep the widget tree shallow (target: < 5 levels deep)
- Name widgets with `WBP_` prefix following the naming conventions in `architecture.md`

### Widget Lifecycle

Understanding the widget lifecycle prevents common bugs:

```
Construct → Initialize → AddToViewport/AddToPlayerScreen
  → NativeConstruct (widget is visible)
    → Tick / Paint (per frame, if enabled)
      → NativeDestruct (widget removed)
        → RemoveFromParent → GC
```

**Key Lifecycle Events**:

| Event | When | Use For |
|-------|------|---------|
| `NativeConstruct` | Widget added to viewport | Initial setup, bind events, cache references |
| `NativeDestruct` | Widget removed from viewport | Unbind events, cleanup timers |
| `NativeTick` | Every frame (if enabled) | Animations, continuous updates (use sparingly) |
| `NativePaint` | Every frame during rendering | Custom draw calls (progress bars, graphs) |

**Best Practices**:

- Perform setup in `NativeConstruct`, not in the constructor
- Always unbind events in `NativeDestruct` to prevent memory leaks
- Disable Tick on widgets that don't need per-frame updates (`SetTickableWhenPaused`, `bCanEverTick`)
- Use `SetVisibility(Collapsed)` instead of `SetVisibility(Hidden)` — Collapsed widgets skip layout and rendering entirely

---

## Data Binding Patterns

### Property Binding

Bind widget properties directly to functions or variables for automatic updates:

```
WBP_HealthBar
├── ProgressBar.Percent → Bind to GetHealthPercent()
├── HealthText.Text → Bind to GetHealthText()
└── BarColor → Bind to GetHealthColor()
```

**Pros**: Simple, automatic updates
**Cons**: Called every frame — avoid expensive operations in bound functions

**When to Use**:
- Simple value displays that change frequently (health bar, ammo count)
- Values that are cheap to compute

**When to Avoid**:
- Complex calculations or string formatting
- Values that rarely change (use event-driven updates instead)

### Event-Driven Updates

Update widgets only when data changes:

```
Controller/ViewModel
  → OnHealthChanged Event
    → WBP_HealthBar.UpdateHealth(NewValue, MaxValue)
```

**Implementation**:

1. Define an Event Dispatcher on the data source (e.g., `HealthComponent`)
2. Bind to the event in the widget's `NativeConstruct`
3. Update widget visuals in the event handler
4. Unbind in `NativeDestruct`

**Pros**: Zero cost when data doesn't change, explicit update flow
**Cons**: Requires event infrastructure, more setup code

**When to Use**:
- Values that change infrequently (score, level, quest progress)
- Complex UI updates (inventory grid, skill tree)
- Any widget where performance matters

### ViewModel Pattern (MVVM)

Separate UI presentation from game logic using a ViewModel layer:

```
Model (Game Logic)          ViewModel              View (Widget)
HealthComponent    →    HUDViewModel      →    WBP_HealthBar
InventoryComponent →    InventoryViewModel →    WBP_Inventory
QuestSystem        →    QuestViewModel     →    WBP_QuestTracker
```

**Benefits**:
- Widgets don't reference game actors directly
- ViewModels can be tested independently
- Multiple widgets can share the same ViewModel
- Clean separation enables UI redesigns without touching game logic

**Implementation**:
- Create a `UObject`-derived ViewModel class
- ViewModel subscribes to game events and exposes UI-friendly properties
- Widgets bind to ViewModel properties or events
- PlayerController or HUD class owns and manages ViewModels

---

## Common UI Integration

### What is Common UI?

Common UI is an Epic-provided plugin that standardizes input handling, navigation, and widget activation across platforms (gamepad, keyboard, mouse, touch).

### Activatable Widgets

Common UI introduces the concept of **Activatable Widgets** — widgets that manage their own activation state and input routing.

```
UCommonActivatableWidget
├── OnActivated()     — Widget becomes the active input handler
├── OnDeactivated()   — Widget loses input focus
├── GetDesiredInputConfig() — Declares input mode (Game, Menu, GameAndMenu)
└── GetDesiredFocusTarget() — Returns the widget to focus on activation
```

**Widget Stack**:

Common UI uses a widget stack to manage activation order:

```
Stack (top = active)
├── WBP_PauseMenu (top — receives input)
├── WBP_Inventory
└── WBP_HUD (bottom — no input while menus are open)
```

- Pushing a widget onto the stack activates it and deactivates the previous top
- Popping a widget reactivates the widget below it
- The stack handles input mode switching automatically

### Input Routing

Common UI handles input routing based on the active widget:

| Input Config | Mouse Cursor | Game Input | UI Navigation |
|-------------|-------------|------------|---------------|
| `Game` | Hidden | Active | Inactive |
| `Menu` | Visible | Inactive | Active |
| `GameAndMenu` | Visible | Active | Active |

**Best Practices**:

- Use `Menu` for pause menus, inventory, settings
- Use `Game` for HUD elements that don't capture input
- Use `GameAndMenu` for in-game UI that coexists with gameplay (minimap interaction, radial menu)
- Override `GetDesiredInputConfig()` in each activatable widget

### Common UI Button and Navigation

```
UCommonButtonBase
├── Handles gamepad, keyboard, mouse, and touch input uniformly
├── Supports button styles per input type
├── Built-in sound and animation hooks
└── Automatic focus navigation
```

**Navigation Setup**:

- Use `UCommonActivatableWidget::SetBindVisibilities` to show/hide input prompts
- Common UI auto-generates navigation between focusable widgets
- Override navigation with explicit `SetNavigationRule` when auto-navigation fails
- Test navigation with gamepad — keyboard navigation often works but gamepad may not

---

## HUD Design Patterns

### Layered HUD Architecture

Organize HUD elements into layers with different update frequencies:

| Layer | Update Frequency | Examples |
|-------|-----------------|----------|
| Static | Never (until state change) | Minimap frame, ability icons |
| Low Frequency | 0.5–1.0s interval | Score, timer, objective text |
| Medium Frequency | 0.1–0.25s interval | Health bar, ammo counter |
| High Frequency | Per frame | Crosshair spread, damage indicators |

**Implementation**:

- Use `Invalidation Box` to wrap static and low-frequency layers
- Use Timer-based updates for medium-frequency elements
- Reserve per-frame updates (Tick/Paint) for elements that truly need it
- Group elements by update frequency to optimize invalidation

### Anchoring and Responsive Layout

Design widgets to adapt to different screen resolutions and aspect ratios:

**Anchor Presets**:

| Element | Anchor | Alignment |
|---------|--------|-----------|
| Health Bar | Top-Left | (0, 0) |
| Minimap | Top-Right | (1, 0) |
| Ability Bar | Bottom-Center | (0.5, 1) |
| Crosshair | Center | (0.5, 0.5) |
| Interaction Prompt | Bottom-Center | (0.5, 0.8) |

**Guidelines**:

- Always use anchors — never use absolute positioning
- Use `Size Box` to constrain widget dimensions
- Use `Scale Box` with `ScaleToFit` for elements that should scale with resolution
- Test at multiple resolutions: 1920×1080, 2560×1440, 3840×2160, and ultrawide (21:9)
- Use DPI scaling for consistent physical size across displays

---

## Menu System Architecture

### Menu Stack Pattern

Use a stack-based navigation model for menu systems:

```
MainMenu
  → SettingsMenu (push)
    → AudioSettings (push)
    ← Back (pop → SettingsMenu)
  ← Back (pop → MainMenu)
```

**Implementation with Common UI**:

```
UCommonActivatableWidgetStack
├── Push(WBP_MainMenu)
├── Push(WBP_SettingsMenu)    — MainMenu deactivated
├── Push(WBP_AudioSettings)   — SettingsMenu deactivated
├── Pop()                     — AudioSettings removed, SettingsMenu reactivated
└── Pop()                     — SettingsMenu removed, MainMenu reactivated
```

### Settings Menu Pattern

Structure settings menus with tabs and categories:

```
WBP_SettingsMenu
├── TabBar
│   ├── Video Tab
│   ├── Audio Tab
│   ├── Controls Tab
│   └── Gameplay Tab
├── ContentSwitcher (Widget Switcher)
│   ├── WBP_VideoSettings
│   ├── WBP_AudioSettings
│   ├── WBP_ControlSettings
│   └── WBP_GameplaySettings
└── ButtonBar
    ├── Apply Button
    ├── Reset Button
    └── Back Button
```

**Best Practices**:

- Use `UGameUserSettings` for video/audio settings persistence
- Apply settings on "Apply" button press, not immediately on change
- Show a confirmation dialog for resolution changes with a revert timer
- Support both mouse and gamepad navigation for all settings

### Dialog and Confirmation Pattern

```
WBP_ConfirmDialog
├── Title Text
├── Message Text
├── Button Container
│   ├── Confirm Button
│   └── Cancel Button
└── Input: OnConfirmed / OnCancelled delegates
```

- Use delegates for dialog results — don't hardcode behavior
- Support keyboard shortcuts (Enter = Confirm, Escape = Cancel)
- Auto-focus the safest option (Cancel for destructive actions)

---

## Performance Considerations

### Widget Invalidation Box

The `Invalidation Box` caches widget rendering and only redraws when explicitly invalidated.

**When to Use**:

- Static UI elements (borders, backgrounds, labels that rarely change)
- Complex widget trees that are expensive to render
- Any widget subtree that updates less frequently than every frame

**How It Works**:

```
InvalidationBox
├── Child widgets are rendered to a cached texture
├── Cache is reused until Invalidate() is called
└── Reduces Slate rendering cost significantly
```

**Guidelines**:

- Wrap large static sections in Invalidation Boxes
- Call `Invalidate(EInvalidateWidgetReason::Paint)` when content changes
- Don't wrap frequently-updating widgets — the invalidation overhead negates the benefit
- Nest Invalidation Boxes for fine-grained control (outer box for layout, inner for content)

### Widget Pooling

For lists with many items (inventory, leaderboard, chat), use widget pooling to avoid create/destroy overhead:

**Pattern**:

```
WidgetPool
├── ActiveWidgets[] — currently visible widgets
├── InactiveWidgets[] — recycled widgets ready for reuse
├── GetOrCreateWidget() — returns pooled widget or creates new one
└── ReturnToPool(Widget) — deactivates and stores for reuse
```

**Implementation**:

- Use `UListView` or `UTileView` with `EntryWidgetClass` — these have built-in pooling
- For custom lists, implement a pool manager that recycles widget instances
- Set pooled widgets to `Collapsed` visibility when inactive
- Reset widget state when recycling (clear text, reset colors, unbind old data)

**Performance Impact**:

| Approach | 100 Items | 1000 Items |
|----------|-----------|------------|
| Create all widgets | ~50ms | ~500ms |
| Pooled (visible only) | ~5ms | ~5ms |

### Reducing Widget Count

Every widget in the tree has a rendering cost. Minimize the total widget count:

| Strategy | Savings |
|----------|---------|
| Use `RichTextBlock` instead of multiple `TextBlock` + `Image` | 3-5 widgets per instance |
| Use `NativePaint` for custom drawing instead of widget composition | Significant for complex visuals |
| Collapse invisible widgets instead of hiding them | Skips layout calculation |
| Use `ListView` / `TileView` for scrollable lists | Only renders visible entries |
| Merge decorative elements into background textures | 1 widget instead of many |

### Tick and Update Optimization

**Widget Tick Cost**:

- Each ticking widget adds CPU overhead even if the tick function is empty
- Target: < 10 widgets with active Tick in the entire HUD

**Optimization Strategies**:

| Problem | Solution |
|---------|----------|
| Tick updates UI text | Use Event Dispatcher or Timer |
| Tick checks game state | Bind to state change events |
| Tick animates widget | Use UMG Animations or `FTimerManager` |
| Tick polls input | Use Enhanced Input Action events |
| Tick updates progress bar | Use Property Binding (acceptable for simple reads) |

**Timer-Based Updates**:

```
// Update health bar 4 times per second instead of every frame
SetTimerByFunction("UpdateHealthDisplay", 0.25, true)
```

### Rendering Optimization

- **Avoid Transparency Overdraw**: Minimize overlapping translucent widgets — each layer costs a full-screen draw
- **Use Retainer Box**: For complex widgets that don't change every frame, `RetainerBox` renders to a texture at a configurable interval
- **Texture Atlasing**: Combine small UI textures into atlases to reduce draw calls
- **Material Complexity**: Keep UI materials simple — avoid expensive shader operations in widget materials
- **Visibility Management**: Set unused widgets to `Collapsed` (not `Hidden`) — `Hidden` still calculates layout

---

## Common Anti-Patterns

### ❌ Tick-Driven UI Updates

**Problem**: Using `NativeTick` or `Event Tick` to update UI elements that don't change every frame.

**Symptoms**:
- Widget Tick functions contain `GetPlayerCharacter()` → `GetHealth()` → `SetText()`
- CPU profiler shows significant time in Slate Tick
- UI updates even when values haven't changed

**Fix**:
1. Use Event Dispatchers from game logic to push updates to UI
2. Use Timers for periodic updates (0.1–0.5s interval)
3. Use Property Binding only for cheap, frequently-changing values
4. Disable Tick on all widgets that don't need per-frame updates

### ❌ Deep Widget Nesting

**Problem**: Excessive nesting of layout widgets (Canvas Panel → Overlay → Vertical Box → Horizontal Box → Size Box → Border → ...).

**Symptoms**:
- Widget tree depth exceeds 10 levels
- Layout calculations become expensive
- Small changes cause large portions of the tree to re-layout

**Fix**:
1. Flatten the hierarchy — combine layout panels where possible
2. Use `Canvas Panel` for absolute positioning instead of nested boxes
3. Use `NativePaint` for complex custom layouts
4. Profile with `stat slate` to identify expensive layout passes

### ❌ Creating Widgets at Runtime

**Problem**: Frequently creating and destroying widgets (e.g., damage numbers, chat messages) instead of pooling.

**Symptoms**:
- GC spikes during gameplay
- Frame hitches when many widgets are created simultaneously
- Memory fragmentation over time

**Fix**:
1. Pre-create a pool of widgets at initialization
2. Recycle widgets by resetting state and re-parenting
3. Use `UListView` for scrollable content (built-in virtualization)
4. For damage numbers, consider using a Niagara particle system instead of widgets

### ❌ Hard References to Game Actors

**Problem**: Widgets directly reference game actors (e.g., `Cast to BP_Character_Player` in widget Blueprint).

**Symptoms**:
- Changing the character Blueprint breaks UI
- Widget Blueprint has large reference chain
- Cannot reuse widget in different contexts

**Fix**:
1. Use a ViewModel or Interface pattern
2. Pass data through function parameters, not direct references
3. Use Event Dispatchers for loose coupling
4. Widgets should only know about data structures, not game actors

### ❌ Ignoring Gamepad Navigation

**Problem**: UI works with mouse but is unusable with gamepad or keyboard.

**Symptoms**:
- No focus visual on buttons
- Cannot navigate between UI elements with D-pad
- Input gets stuck in UI mode

**Fix**:
1. Use Common UI for automatic input routing
2. Set explicit focus targets for each activatable widget
3. Test all menus with gamepad before shipping
4. Provide visible focus indicators on all interactive elements
5. Handle Back/Cancel button (B on gamepad, Escape on keyboard)

### ❌ Not Testing Multiple Resolutions

**Problem**: UI designed at 1080p breaks at other resolutions or aspect ratios.

**Symptoms**:
- Elements overlap or clip at 720p
- Excessive empty space at 4K
- Broken layout at ultrawide (21:9) or portrait orientations

**Fix**:
1. Use anchors and relative positioning for all elements
2. Use `Scale Box` and `Size Box` for resolution-independent sizing
3. Test at minimum: 1280×720, 1920×1080, 2560×1440, 3840×2160
4. Test ultrawide (2560×1080) if targeting PC
5. Use DPI scaling settings in Project Settings

---

## Performance Monitoring Commands

| Command | Purpose |
|---------|---------|
| `stat slate` | Slate rendering statistics (widget count, draw time) |
| `stat ui` | UI rendering statistics |
| `SlateDebugger.Start` | Start Slate debugger for widget inspection |
| `WidgetReflector` | Open Widget Reflector for hierarchy inspection |
| `stat game` | Game thread time (includes UI Tick) |

**Performance Targets**:

| Metric | Target | Warning |
|--------|--------|---------|
| Total widget count | < 200 | > 500 |
| Ticking widgets | < 10 | > 30 |
| Slate render time | < 2ms | > 5ms |
| Widget tree depth | < 8 | > 12 |
| Invalidation Box hit rate | > 80% | < 50% |
