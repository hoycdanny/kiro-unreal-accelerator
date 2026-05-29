# Kiro Unreal Accelerator

An intelligent Unreal Engine development accelerator Power that integrates 50+ MCP tools (via [flopperam/unreal-engine-mcp](https://github.com/flopperam/unreal-engine-mcp)) to provide natural-language-driven control over Unreal Editor. Automates asset management, level building, performance analysis, Blueprint generation, material workflows, VFX, animation, landscape, AI/BT, cinematics, PCG, and more. Supports Unreal Engine 5.5 / 5.6 / 5.7.

**Keywords:** unreal, ue5, ue5.7, blueprint, nanite, lumen, material, level, performance, asset, game, flopperam

---

## Capabilities

- **Asset Management & Automated Configuration** — Batch-apply asset presets, auto-detect asset types, validate Nanite compatibility
- **Level Building & Scaffolding** — Generate complete level structures from templates (open world, linear, arena, interior)
- **Blueprint Generation & Optimization** — Create best-practice Blueprint templates for characters, actors, widgets, game modes, AI controllers
- **Material Workflow Automation** — Generate PBR, subsurface, landscape blend, and VFX material templates with parameter presets
- **Performance Analysis & Optimization** — Detect anti-patterns (excessive dynamic lights, unmerged meshes, oversized textures), profile draw calls, memory, GPU
- **Code Quality Checking** — Enforce naming conventions, detect circular dependencies, analyze Blueprint/C++ responsibility balance
- **Cross-Platform Compatibility Verification** — Check shader model compatibility, memory budgets, scalability settings per platform
- **GAS (Gameplay Ability System) Integration** — Generate abilities, effects, attribute sets, cues with proper tag configuration
- **AI Behavior Tree Generation** — Create behavior trees, blackboards, EQS queries, AI controllers from templates
- **UI Widget Toolchain** — Generate HUD, menu, dialog, inventory widgets following Common UI patterns
- **Knowledge Management & Documentation** — Store/retrieve team docs, detect stale documentation, track API changes across UE versions

---

## MCP Tool Mapping

Maps user intents to the appropriate MCP tools. All tools are prefixed `mcp_unreal_engine_` at runtime.

| User Intent | Primary MCP Tool | Supporting Tools |
|---|---|---|
| Import/configure assets | `manage_asset` | `inspect`, `manage_texture` |
| Create/modify Blueprints | `manage_blueprint` | `inspect`, `manage_asset` |
| Spawn/transform actors | `control_actor` | `inspect`, `manage_level` |
| Play/stop PIE, screenshots | `control_editor` | `system_control` |
| Load/save/stream levels | `manage_level` | `manage_level_structure`, `manage_volumes` |
| Create landscapes, foliage | `build_environment` | `manage_asset`, `manage_material_authoring` |
| Animation, physics, ragdoll | `animation_physics` | `manage_skeleton`, `manage_asset` |
| Edit Level Sequences | `manage_sequence` | `control_actor`, `control_editor` |
| Create input actions/mappings | `manage_input` | `manage_blueprint` |
| Inspect UObject properties | `inspect` | — |
| Play/configure audio | `manage_audio` | `manage_asset`, `inspect` |
| Create Behavior Trees | `manage_behavior_tree` | `manage_ai`, `manage_blueprint` |
| Spawn/configure lights | `manage_lighting` | `manage_level`, `build_environment` |
| Profile/optimize performance | `manage_performance` | `system_control`, `inspect` |
| Create procedural geometry | `manage_geometry` | `manage_asset`, `manage_material_authoring` |
| Edit skeletal meshes/sockets | `manage_skeleton` | `animation_physics`, `manage_asset` |
| Find/apply materials | `control_actor` | `manage_asset`, `manage_material_authoring` |
| Author materials/graphs | `manage_material_authoring` | `manage_asset`, `manage_texture` |
| Create/process textures | `manage_texture` | `manage_asset` |
| Create GAS abilities/effects | `manage_gas` | `manage_blueprint`, `manage_character` |
| Create character Blueprints | `manage_character` | `manage_blueprint`, `animation_physics` |
| Configure weapons/combat | `manage_combat` | `manage_blueprint`, `manage_gas` |
| Create AI controllers/EQS | `manage_ai` | `manage_behavior_tree`, `manage_blueprint` |
| Create inventory/items | `manage_inventory` | `manage_blueprint`, `manage_asset` |
| Create doors/switches/triggers | `manage_interaction` | `control_actor`, `manage_blueprint` |
| Create UMG widgets/HUD | `manage_widget_authoring` | `manage_blueprint`, `manage_asset` |
| Configure replication/RPCs | `manage_networking` | `manage_blueprint`, `manage_game_framework` |
| Create GameMode/GameState | `manage_game_framework` | `manage_blueprint`, `manage_networking` |
| Configure split-screen/LAN | `manage_sessions` | `manage_game_framework`, `manage_networking` |
| Create sublevels/World Partition | `manage_level_structure` | `manage_level`, `manage_volumes` |
| Create trigger/physics volumes | `manage_volumes` | `manage_level`, `control_actor` |
| Configure NavMesh/pathfinding | `manage_navigation` | `manage_volumes`, `control_actor` |
| Create/edit splines | `manage_splines` | `manage_asset`, `manage_material_authoring` |
| Run console commands, CVars | `system_control` | `control_editor` |
| Enable/disable MCP tools | `manage_tools` | — |

---

## Steering Files Index

Steering files provide domain-specific knowledge and best practices. Kiro should consult the relevant steering file before giving advice in that domain.

| File | Domain | Purpose |
|---|---|---|
| `steering/material-workflow.md` | Material Workflow | Material search, apply, create, replace workflows, MCP API notes |
| `steering/blueprint-logic.md` | Blueprint Logic | Blueprint creation, node graph generation, template system, node type reference |
| `steering/performance.md` | Performance | Draw Call optimization, memory management, GPU optimization, common anti-patterns |
| `steering/architecture.md` | Architecture | Blueprint vs C++ responsibility split, modular design, naming conventions |
| `steering/asset-pipeline.md` | Asset Pipeline | Asset import workflows, texture settings, mesh settings, audio settings |
| `steering/blueprint-patterns.md` | Blueprints | Blueprint design patterns, anti-patterns, best practices |
| `steering/ue5-features.md` | UE5 Features | Nanite, Lumen, World Partition, Control Rig, Virtual Shadow Maps |
| `steering/platform-compat.md` | Platform Compatibility | Per-platform limitations, Shader Model mapping, memory budgets |
| `steering/gas-patterns.md` | GAS | Ability/Effect/Attribute design patterns, Tag hierarchy, stacking strategies |
| `steering/ui-patterns.md` | UI/UMG | Widget design patterns, Common UI integration, UI performance |

---

## Templates Index

Templates are JSON definitions used to generate Unreal Engine assets, levels, and configurations.

| Directory | Count | Contents |
|---|---|---|
| `templates/presets/` | 7 | Asset presets — `texture-2d-diffuse`, `texture-2d-normal`, `static-mesh-nanite`, `static-mesh-standard`, `skeletal-mesh-character`, `material-pbr`, `sound-sfx` |
| `templates/scaffolds/` | 4 | Level scaffolds — `open-world`, `linear-level`, `arena`, `interior` |
| `templates/blueprints/` | 6 | Blueprint templates — `character-base`, `actor-interactable`, `component-health`, `widget-hud`, `gamemode-base`, `ai-controller` |
| `templates/materials/` | 4 | Material templates — `pbr-standard`, `pbr-subsurface`, `landscape-blend`, `vfx-translucent` |
| `templates/gas/` | 5 | GAS templates — `ability-melee`, `ability-projectile`, `effect-damage`, `effect-buff`, `attribute-set-base` |
| `templates/ai/` | 4 | AI templates — `behavior-tree-patrol`, `behavior-tree-combat`, `blackboard-npc`, `eqs-find-cover` |
| `templates/build-configs/` | 3 | Build configurations — `development`, `shipping`, `test` |
| `templates/platform-profiles/` | 5 | Platform profiles — `windows`, `ps5`, `xbox-series-x`, `ios`, `android` |
| `templates/architecture-rules/` | 3 | Architecture rules — `naming-conventions`, `folder-structure`, `dependency-rules` |
| `templates/workflows/` | 4 | Workflow templates — `asset-import-pipeline`, `build-and-test`, `performance-audit`, `material-swap` |

---

## Intent Routing Rules

When a user request arrives, route it through these rules to select the right combination of tools, steering files, and templates.

### Asset Workflows
- **"import/configure assets"** → `steering/asset-pipeline.md` → `templates/presets/*` → `manage_asset`
- **"apply Nanite to mesh"** → `steering/ue5-features.md` → `templates/presets/static-mesh-nanite.json` → `manage_asset` + `inspect`
- **"set up textures"** → `steering/asset-pipeline.md` → `templates/presets/texture-2d-*.json` → `manage_texture` + `manage_asset`

### Level Building
- **"create a level / build a map"** → `steering/architecture.md` → `templates/scaffolds/*` → `manage_level` + `manage_level_structure` + `manage_lighting`
- **"set up World Partition"** → `steering/ue5-features.md` → `templates/scaffolds/open-world.json` → `manage_level_structure`
- **"add landscape/foliage"** → `steering/ue5-features.md` → `build_environment`

### Blueprint Generation
- **"create a character"** → `steering/blueprint-patterns.md` → `templates/blueprints/character-base.json` → `manage_blueprint` + `manage_character`
- **"create an interactable"** → `steering/blueprint-patterns.md` → `templates/blueprints/actor-interactable.json` → `manage_blueprint` + `manage_interaction`
- **"create a game mode"** → `templates/blueprints/gamemode-base.json` → `manage_game_framework` + `manage_blueprint`
- **"create a widget / HUD"** → `steering/ui-patterns.md` → `templates/blueprints/widget-hud.json` → `manage_widget_authoring`

### Blueprint Logic Generation
- **"build blueprint logic / add nodes"** → `steering/blueprint-logic.md` → BlueprintManager.buildGraphLogic → `manage_blueprint`
- **"create blueprint from template"** → `steering/blueprint-logic.md` → `templates/blueprints/*` → BlueprintManager.createFromTemplate → `manage_blueprint`
- **"add variable/function to blueprint"** → `steering/blueprint-logic.md` → BlueprintManager.addVariable / addFunction → `manage_blueprint`
- **"connect blueprint nodes"** → `steering/blueprint-logic.md` → BlueprintManager.connectPins → `manage_blueprint`
- **"add BeginPlay / Tick event"** → `steering/blueprint-logic.md` → BlueprintManager.addBeginPlayEvent / addTickEvent → `manage_blueprint`
- **"compile blueprint"** → BlueprintManager.compileBlueprint → `manage_blueprint`

### Material Workflows
- **"find/search materials"** → `steering/material-workflow.md` → MaterialManager.searchMaterials → `manage_asset`
- **"apply/change material on actor"** → `steering/material-workflow.md` → MaterialManager.applyMaterialToActor → `control_actor`
- **"replace/swap material"** → `steering/material-workflow.md` → `templates/workflows/material-swap.json` → MaterialManager.replaceMaterial
- **"create a material"** → `steering/material-workflow.md` → `templates/materials/*` → MaterialManager.createMaterial → `manage_material_authoring`
- **"create material instance"** → `steering/material-workflow.md` → MaterialManager.createMaterialInstance → `manage_material_authoring`
- **"create landscape material"** → `templates/materials/landscape-blend.json` → `manage_material_authoring` + `build_environment`
- **"create VFX material"** → `templates/materials/vfx-translucent.json` → `manage_material_authoring`

### Performance & Quality
- **"optimize performance / check FPS"** → `steering/performance.md` → PerformanceAnalyzer → `manage_performance` + `system_control`
- **"check code quality"** → `steering/architecture.md` → CodeQualityAnalyzer → `inspect`
- **"analyze dependencies"** → DependencyAnalyzer → `manage_asset` (action: `get_dependencies`)
- **"check platform compatibility"** → `steering/platform-compat.md` → CompatibilityChecker → `templates/platform-profiles/*`

### GAS & Combat
- **"create an ability / skill"** → `steering/gas-patterns.md` → `templates/gas/*` → `manage_gas` + `manage_blueprint`
- **"set up combat / weapons"** → `steering/gas-patterns.md` → `manage_combat` + `manage_gas`
- **"create attribute set"** → `templates/gas/attribute-set-base.json` → `manage_gas`

### AI Systems
- **"create AI behavior"** → `templates/ai/*` → `manage_ai` + `manage_behavior_tree`
- **"set up NPC patrol"** → `templates/ai/behavior-tree-patrol.json` → `manage_behavior_tree` + `manage_ai`
- **"create EQS query"** → `templates/ai/eqs-find-cover.json` → `manage_ai`

### Build & Platform
- **"build the project"** → `templates/build-configs/*` → `system_control` (action: `run_ubt`)
- **"check iOS/Android compatibility"** → `steering/platform-compat.md` → `templates/platform-profiles/*` → CompatibilityChecker
- **"configure for PS5/Xbox"** → `templates/platform-profiles/*` → `manage_performance`

### Workflows
- **"run asset import pipeline"** → `templates/workflows/asset-import-pipeline.json` → WorkflowEngine
- **"run material swap"** → `templates/workflows/material-swap.json` → WorkflowEngine + MaterialManager
- **"run performance audit"** → `templates/workflows/performance-audit.json` → WorkflowEngine + PerformanceAnalyzer
- **"run build and test"** → `templates/workflows/build-and-test.json` → WorkflowEngine

---

## Known Issues & Dangerous Operations

### NEVER use `ce` console command via MCP
The `ce` (CallEvent) console command causes an **immediate Unreal Editor crash** when executed through the MCP Automation Bridge. The crash occurs in `UEngine::HandleCeCommand` due to a null pointer access in the level array. **Never use `ce` as a workaround for any operation.** Always use the dedicated MCP tool actions instead.

**Crash signature:**
```
UEngine::HandleCeCommand → TArray<TObjectPtr<ULevel>> → Signal 0x143f8184 (SEGFAULT)
```

### `set_component_property` with `OverrideMaterials` is unreliable
When using `control_actor` → `set_component_property` to set `OverrideMaterials` on a `StaticMeshComponent`, the call may report `success: true` but the property remains `[None]` when verified. This is a known MCP bridge limitation for array-type material properties.

**Workaround (PROVEN):** Use the **Blueprint SCS approach**:
1. Create a Blueprint (`manage_blueprint` → `create`)
2. Add a `StaticMeshComponent` via `add_scs_component` with `meshPath` and `materialPath` parameters — both `mesh_applied: true` and `material_applied: true` must be confirmed
3. Spawn the Blueprint (`control_actor` → `spawn_blueprint`) at the desired location/scale
4. Delete the original actor if replacing

This is the only reliable method to apply materials to actors via MCP. Do NOT use `set_component_property` with `OverrideMaterials` — it always fails silently.

### Excessive Undo can corrupt scene state
Calling `undo` in bulk (e.g., 40+ times) to revert batch operations can overshoot and undo unrelated prior changes, leaving the scene in a broken state (missing materials, unlit surfaces). **Prefer targeted restoration** (re-applying original materials explicitly) over mass undo when reverting batch material changes.

---

## Analysis Modules

TypeScript modules providing deep analysis capabilities. Located in `src/`.

| Module | Path | Capabilities |
|---|---|---|
| **BlueprintManager** | `src/managers/BlueprintManager.ts` | Blueprint creation from templates, node graph logic generation (add nodes, connect pins, build complete event graphs), variable/function/component management, compile & validate |
| **MaterialManager** | `src/managers/MaterialManager.ts` | Material search/discovery, apply to actors (single/batch), create materials & instances, material replacement workflows |
| **AssetAnalyzer** | `src/analyzers/AssetAnalyzer.ts` | Asset type detection, Nanite compatibility validation, preset application, batch configuration |
| **PerformanceAnalyzer** | `src/analyzers/PerformanceAnalyzer.ts` | Scene profiling, draw call / memory / GPU analysis, Nanite & Lumen analysis, anti-pattern detection |
| **CodeQualityAnalyzer** | `src/analyzers/CodeQualityAnalyzer.ts` | Naming convention checks, circular dependency detection, Blueprint/C++ balance analysis, refactoring suggestions |
| **DependencyAnalyzer** | `src/analyzers/DependencyAnalyzer.ts` | Dependency tree building, orphaned asset detection, chunk duplication analysis, deletion impact analysis |
| **CompatibilityChecker** | `src/analyzers/CompatibilityChecker.ts` | Platform compatibility scanning, shader model checks, memory budget validation, scalability verification |
| **WorkflowEngine** | `src/engine/WorkflowEngine.ts` | Workflow definition & storage, sequential step execution with error handling (stop/skip/retry), conditional branching, scheduling |
| **ReportGenerator** | `src/generators/ReportGenerator.ts` | Multi-format report generation (JSON, Markdown), dashboard output for asset, performance, quality, and compatibility reports |
| **KnowledgeManager** | `src/utils/knowledge-manager.ts` | Document storage & retrieval, full-text search, expiry detection, API change tracking |
