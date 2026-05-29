# Local MCP Setup Guide (Free)

Complete step-by-step guide to set up the open-source Unreal Engine MCP server.

---

## Prerequisites

- Unreal Engine 5.5+ project
- Python 3.12+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package runner)
- Git
- Visual Studio 2022 (with C++ game development workload)

---

## Step 1 — Clone the MCP repo

Clone to a **permanent location** outside your UE project. This folder will stay here permanently because it contains both the Plugin source AND the Python MCP server that Kiro needs at runtime.

```cmd
cd %USERPROFILE%\Desktop
git clone https://github.com/flopperam/unreal-engine-mcp.git
```

After this you should have: `C:\Users\Danny\Desktop\unreal-engine-mcp\`

---

## Step 2 — Copy the Plugin into your UE project

Open CMD and navigate to your UE project root (where `.uproject` is):

```cmd
cd "C:\Users\Danny\Documents\Unreal Projects\MyProject"
xcopy /E /I "%USERPROFILE%\Desktop\unreal-engine-mcp\UnrealMCP" "Plugins\UnrealMCP"
```

Verify the structure:

```
MyProject/
├── Plugins/
│   └── UnrealMCP/
│       ├── Source/
│       ├── UnrealMCP.uplugin
│       └── ...
├── Content/
├── MyProject.uproject
└── ...
```

---

## Step 3 — Build the Plugin

1. Right-click `MyProject.uproject` → **Generate Visual Studio project files**
2. Open the generated `.sln` in Visual Studio
3. Set build target to **Development Editor** + **Win64**
4. Build the solution (Ctrl+Shift+B)
5. Open Unreal Editor → Edit → Plugins → search "UnrealMCP" → Enable
6. Restart the Editor when prompted

---

## Step 4 — Install Python & uv

If you don't have Python 3.12+ installed:
- Download from https://www.python.org/downloads/
- During install, check "Add Python to PATH"

Install uv (Python package runner):

```powershell
# PowerShell
irm https://astral.sh/uv/install.ps1 | iex
```

Or with pip:

```cmd
pip install uv
```

---

## Step 5 — Test the MCP Server

```cmd
cd "%USERPROFILE%\Desktop\unreal-engine-mcp\Python"
uv run unreal_mcp_server_advanced.py
```

If it starts without errors, press `Ctrl+C` to stop. Kiro will manage the server lifecycle automatically.

---

## Step 6 — Configure mcp.json

In your Kiro Unreal Accelerator project, edit `mcp.json`:

```json
{
  "mcpServers": {
    "unreal-engine": {
      "command": "uv",
      "args": [
        "--directory",
        "C:/Users/Danny/Desktop/unreal-engine-mcp/Python",
        "run",
        "unreal_mcp_server_advanced.py"
      ]
    }
  }
}
```

> **Important**: Use forward slashes `/` in the path, even on Windows.

---

## Step 7 — Verify Connection

1. Make sure Unreal Editor is open with your project (Plugin enabled)
2. In Kiro, type: "List all actors in the current level"
3. If the AI responds with actor names from your scene, the connection is working

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `uv` not found | Restart your terminal after installing uv, or use full path |
| Plugin won't compile | Ensure Visual Studio has "Game development with C++" workload installed |
| MCP server can't connect | Make sure Unreal Editor is open BEFORE testing the server |
| Python server errors | Run `cd Desktop\unreal-engine-mcp\Python && uv sync` to install dependencies |
| "Module not found" errors | Ensure Python 3.12+ is installed and on PATH |

---

## File Locations Summary

| What | Where |
|------|-------|
| MCP repo (permanent) | `C:\Users\Danny\Desktop\unreal-engine-mcp\` |
| Python MCP server | `C:\Users\Danny\Desktop\unreal-engine-mcp\Python\` |
| UE Plugin (copied) | `C:\Users\Danny\Documents\Unreal Projects\MyProject\Plugins\UnrealMCP\` |
| Kiro mcp.json | `C:\Users\Danny\Desktop\kiro-unreal-accelerator\mcp.json` |

---

## Clean Start

If something went wrong and you want to start over:

```cmd
:: Remove the plugin from UE project
rmdir /S /Q "C:\Users\Danny\Documents\Unreal Projects\MyProject\Plugins\UnrealMCP"

:: Remove the cloned repo
rmdir /S /Q "%USERPROFILE%\Desktop\unreal-engine-mcp"

:: Then start again from Step 1
```
