# Kiro Unreal Accelerator

[English](README.md) | [繁體中文](README_TW.md) | [简体中文](README_CN.md) | [日本語](README_JP.md) | [한국어](README_KR.md)

> **Note on language availability**: README files are available in 5 languages to support our global community. Steering files (domain knowledge) are in Traditional Chinese with English summary sections. The Power responds in the developer's preferred language. If you encounter any language barriers, please open an issue for community support.

Transform your IDE into an Unreal Engine development AI assistant. Use natural language to command Unreal Editor via MCP (Model Context Protocol). This Power covers Blueprint logic generation, asset management, material workflows, performance analysis, code quality checks, cross-platform compatibility, and more — with 35 MCP tools and 10 domain knowledge files.

> **Key Concepts**:
> * **MCP** (Model Context Protocol): A standardized protocol for AI assistants to communicate with development tools
> * **Blueprint**: Unreal Engine's visual scripting system for game logic
> * **Nanite**: UE5's virtualized geometry system for automatic LOD and draw call optimization
> * **Lumen**: UE5's dynamic global illumination and reflection system
> * **GAS** (Gameplay Ability System): Unreal's framework for abilities, effects, and attributes

## Features

* **Blueprint Logic Generation** — Create nodes, connect pins, build complete event graphs directly in Blueprint Editor
* **Asset Automation** — Batch apply presets, auto-detect asset types, validate Nanite compatibility
* **Material Workflow** — Search, create, apply, and replace materials with proven MCP API workarounds
* **Performance Analysis** — Draw Call/Memory/GPU profiling, anti-pattern detection, optimization recommendations
* **Code Quality** — Naming convention checks, circular dependency detection, Blueprint/C++ balance analysis
* **Cross-Platform Compatibility** — Shader model checks, memory budget validation for 8 platforms
* **GAS Integration** — Generate abilities, effects, attribute sets with proper tag configuration
* **AI Behavior Trees** — Create behavior trees, blackboards, EQS queries from templates
* **Level Scaffolding** — One-command level structure generation (open world, linear, arena, interior)
* **Workflow Automation** — Multi-step workflows with conditional branching and failure strategies

## Architecture

```
Developer (Natural Language)
    → AI Layer (Intent Understanding & Planning)
        → MCP Protocol
            → Unreal Editor (Execution Layer)

Unreal Accelerator (Intelligence Layer)
├── POWER.md        → Main document defining tools & workflows
├── steering/       → 10 domain knowledge files
├── templates/      → 45 JSON templates (10 categories)
└── src/            → 35+ TypeScript tool modules
```

## Prerequisites

* [Unreal Engine 5.5+](https://www.unrealengine.com/) (5.5 / 5.6 / 5.7 supported)
* [Kiro IDE](https://kiro.dev/docs/getting-started/installation) installed
* Python 3.12+ and [uv](https://docs.astral.sh/uv/getting-started/installation/) (for Local MCP)
* Node.js 18+ (for development/testing of this Power only)
* (Optional) [Flopperam API Key](https://flopperam.com/account) — only if using the paid Hosted MCP

> **For complete step-by-step installation instructions, see the Installation section below.**

## Installation

### Step 1 — Install this Power in Kiro

Open Kiro → Left panel click Powers icon → Click "+" → Select "Add Custom Power" → Select this project's root directory

### Step 2 — Install MCP Server (FlopAI Plugin)

This Power uses [flopperam/unreal-engine-mcp](https://github.com/flopperam/unreal-engine-mcp) — the most advanced MCP server for Unreal Engine with 50+ tools across 9 domains. Supports UE 5.5 / 5.6 / 5.7.

**Option 1: Open-Source Local MCP (Free, Recommended)**

1. Clone the repo to a permanent location (NOT inside your UE project):

```bash
cd ~/Desktop
git clone https://github.com/flopperam/unreal-engine-mcp.git
```

2. Copy the `UnrealMCP` plugin into your Unreal project's `Plugins/` folder:

```bash
# Windows (CMD) — navigate to your UE project root first (where .uproject is)
cd "C:\Users\<YOU>\Documents\Unreal Projects\<YOUR_PROJECT>"

# Then copy the plugin (creates Plugins\UnrealMCP\ automatically)
xcopy /E /I "%USERPROFILE%\Desktop\unreal-engine-mcp\UnrealMCP" "Plugins\UnrealMCP"

# macOS / Linux — from your UE project root
cp -r ~/Desktop/unreal-engine-mcp/UnrealMCP Plugins/
```

> **Important**: Run this from the project root (where `.uproject` is), NOT from inside the `Plugins/` folder.

3. Build and enable the plugin:
   - Right-click your `.uproject` file → "Generate Visual Studio project files"
   - Open the `.sln`, set target to **Development Editor**, and Build
   - Open Unreal Editor → Edit → Plugins → search "UnrealMCP" → Enable → Restart Editor

4. Install Python dependencies:
   - Install [Python 3.12+](https://www.python.org/downloads/)
   - Install [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package runner):
     ```cmd
     pip install uv
     ```

5. Verify the Python server can start:

```bash
cd ~/Desktop/unreal-engine-mcp/Python
uv run unreal_mcp_server_advanced.py
```

If it starts without errors, press Ctrl+C to stop it. Kiro will manage the server automatically.

**Option 2: Hosted Flop MCP (Paid, 50+ tools)**

If you want the full 50+ tool experience with zero local setup:

1. Get an API key at [flopperam.com/account](https://flopperam.com/account)
2. Install the FlopAI Unreal plugin — see [flopperam.com/docs](https://flopperam.com/docs) (Installation tab)

### Step 3 — Configure MCP Connection

Edit `mcp.json` or `.kiro/settings/mcp.json`:

**Option 1: Local MCP (Free)**

```json
{
  "mcpServers": {
    "unreal-engine": {
      "command": "uv",
      "args": [
        "--directory",
        "C:/Users/<YOU>/Desktop/unreal-engine-mcp/Python",
        "run",
        "unreal_mcp_server_advanced.py"
      ]
    }
  }
}
```

> Replace `C:/Users/<YOU>/Desktop/unreal-engine-mcp/Python` with the actual path where you cloned the repo.

**Option 2: Hosted Flop MCP (Paid)**

```json
{
  "mcpServers": {
    "unreal-engine": {
      "url": "https://agent.flopperam.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Step 4 — Install Auto-Guidance Hook (Recommended)

```bash
mkdir -p .kiro/hooks
cp hooks/pre-unreal-tool.kiro.hook .kiro/hooks/
```

### Verify Connection

Type any Unreal-related command in Kiro (e.g., "List all actors in the current level"). If the AI responds correctly, the connection is successful.

## Usage

Tell the AI what you'd like to do in natural language. It will automatically select and execute the appropriate MCP tools.

### Example Commands

```
"Create a character Blueprint with SpringArm and Camera"
"Apply Nanite to all meshes in the Environment folder"
"Build a PBR metal material with roughness 0.3"
"Check the project's code architecture quality"
"Is my project compatible with iOS?"
"Analyze dependencies for BP_MainCharacter"
"Run the performance audit workflow"
```

## Development

```bash
npm install
npm test                 # Run all tests
npm run test:coverage    # Tests with coverage
npm run lint             # ESLint check
npx tsc --noEmit        # TypeScript type checking
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| MCP connection failed | Ensure Unreal Editor is open with FlopAI Plugin running. Check API Key (Hosted) or Python server (Local). See [flopperam.com/docs](https://flopperam.com/docs) |
| Blueprint compile errors | Use `listNodeTypes()` to verify node type names |
| Material apply not working | Use Blueprint SCS approach (see Known Issues in POWER.md) |
| Tests failing | Run `npm install` then `npm test` |
| TypeScript errors | Run `npx tsc --noEmit` after `npm install` |

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

MIT License. See the [LICENSE](LICENSE) file.
