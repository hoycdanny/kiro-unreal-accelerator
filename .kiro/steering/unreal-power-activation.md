---
inclusion: auto
---

# Unreal Accelerator Power Activation

When the user's request involves Unreal Engine development, always:

1. Reference the appropriate steering file from `steering/` directory based on the topic
2. Follow the intent routing rules defined in `POWER.md`
3. Use the correct MCP tool combinations as specified in the MCP Tool Mapping table

## Steering File Selection

| Topic Keywords | Steering File |
|---|---|
| material, shader, texture apply | `steering/material-workflow.md` |
| blueprint, node, graph, logic | `steering/blueprint-logic.md` |
| fps, draw call, memory, optimize | `steering/performance.md` |
| naming, module, c++, architecture | `steering/architecture.md` |
| import, asset, mesh, audio | `steering/asset-pipeline.md` |
| pattern, component, interface, event | `steering/blueprint-patterns.md` |
| nanite, lumen, world partition | `steering/ue5-features.md` |
| platform, ios, android, ps5, switch | `steering/platform-compat.md` |
| ability, effect, attribute, gas | `steering/gas-patterns.md` |
| widget, umg, hud, menu, ui | `steering/ui-patterns.md` |

## Known MCP API Pitfalls

- NEVER use `ce` console command via MCP (causes Editor crash)
- `set_component_property` with `OverrideMaterials` is unreliable — use Blueprint SCS approach
- Material result node connections use `manage_asset` → `connect_material_pins` (not `manage_material_authoring`)
- `connect_material_pins` parameter is `assetPath` (not `materialPath`)
- Blueprint Pin names are lowercase in MCP bridge (`then`, `execute`)
- `get_material_info` only works for Materials, not MaterialInstances
