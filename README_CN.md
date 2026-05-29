# Kiro Unreal Accelerator

[English](README.md) | [繁體中文](README_TW.md) | [简体中文](README_CN.md) | [日本語](README_JP.md) | [한국어](README_KR.md)

> **语言说明**：主 README 为繁体中文。Steering 文件（领域知识）为繁体中文并附英文摘要。Power 会以开发者偏好的语言回应。

将你的 IDE 变成 Unreal Engine 开发 AI 助手。通过自然语言经由 MCP（Model Context Protocol — 一种让 AI 助手与开发工具交互的标准化协议）操控 Unreal Editor。本 Power 涵盖 Blueprint 逻辑生成、资产管理、材质工作流、性能分析、代码质量检查、跨平台兼容性等功能 — 包含 35 个 MCP 工具和 10 个领域知识文件。

> **核心概念**：
> * **MCP**（Model Context Protocol）：AI 助手与开发工具通信的标准化协议
> * **Blueprint**：Unreal Engine 的可视化脚本系统
> * **Nanite**：UE5 的虚拟化几何系统，自动处理 LOD 和 Draw Call 优化
> * **Lumen**：UE5 的动态全局光照和反射系统
> * **GAS**（Gameplay Ability System）：Unreal 的技能、效果和属性框架

## 功能特性

* **Blueprint 逻辑生成** — 直接在 Blueprint Editor 中创建节点、连接引脚、构建完整事件图
* **资产自动化** — 批量应用预设、自动检测资产类型、验证 Nanite 兼容性
* **材质工作流** — 搜索、创建、应用和替换材质，内置已验证的 MCP API 解决方案
* **性能分析** — Draw Call/内存/GPU 分析、反模式检测、优化建议
* **代码质量** — 命名规范检查、循环依赖检测、Blueprint/C++ 平衡分析
* **跨平台兼容性** — 8 个平台的 Shader Model 检查和内存预算验证
* **GAS 集成** — 生成技能、效果、属性集，配置正确的 Tag 层级
* **AI 行为树** — 从模板创建行为树、黑板、EQS 查询
* **关卡脚手架** — 一条命令生成关卡结构（开放世界、线性、竞技场、室内）
* **工作流自动化** — 支持条件分支和失败策略的多步骤工作流

## 架构

```
开发者（自然语言）
    → AI 层（意图理解与规划）
        → MCP 协议
            → Unreal Editor（执行层）

Unreal Accelerator（智能层）
├── POWER.md        → 定义工具与工作流的主文档
├── steering/       → 10 个领域知识文件
├── templates/      → 45 个 JSON 模板（10 个类别）
└── src/            → 35+ TypeScript 工具模块
```

## 前置需求

* [Unreal Engine 5.5+](https://www.unrealengine.com/)（5.5 / 5.6 / 5.7 支持）
* [Kiro IDE](https://kiro.dev/docs/getting-started/installation)
* Python 3.12+ 和 [uv](https://docs.astral.sh/uv/getting-started/installation/)（Local MCP 用）
* Node.js 18+（仅本 Power 开发/测试需要）
* （可选）[Flopperam API Key](https://flopperam.com/account) — 仅付费 Hosted MCP 需要

> **完整安装步骤请参考 [SETUP.md](SETUP.md)**

## 安装

### 步骤 1 — 在 Kiro 中安装此 Power

打开 Kiro → 左侧面板点击 Powers 图标 → 点击 "+" → 选择 "Add Custom Power" → 选择本项目根目录

### 步骤 2 — 安装 MCP Server

本 Power 使用 [flopperam/unreal-engine-mcp](https://github.com/flopperam/unreal-engine-mcp)，支持 UE 5.5 / 5.6 / 5.7。

**方式 1：开源本地 MCP（免费，推荐）**

**2a — Clone repo 到固定位置（不要放在 UE 项目里面）**

```cmd
cd %USERPROFILE%\Desktop
git clone https://github.com/flopperam/unreal-engine-mcp.git
```

**2b — 复制 UnrealMCP Plugin 到你的 UE 项目**

在 UE 项目根目录（`.uproject` 所在位置）执行：

```cmd
xcopy /E /I "%USERPROFILE%\Desktop\unreal-engine-mcp\UnrealMCP" "Plugins\UnrealMCP"
```

最终结构：
```
你的UE项目/
├── Plugins/
│   └── UnrealMCP/
│       ├── Source/
│       └── UnrealMCP.uplugin
├── Content/
└── 你的项目.uproject
```

**2c — 编译并启用 Plugin**

1. 右键 `.uproject` → "Generate Visual Studio project files"
2. 打开 `.sln`，选择 **Development Editor** + **Win64**，Build
3. 打开 Unreal Editor → Edit → Plugins → 搜索 "UnrealMCP" → 启用 → 重启

**2d — 安装 Python 环境**

```powershell
# 安装 uv（PowerShell）
irm https://astral.sh/uv/install.ps1 | iex
```

**2e — 验证 Python Server**

```cmd
cd %USERPROFILE%\Desktop\unreal-engine-mcp\Python
uv run unreal_mcp_server_advanced.py
```

启动无错误后按 Ctrl+C 停止。Kiro 会自动管理 Server。

**方式 2：Hosted Flop MCP（付费，50+ 完整工具）**

如需完整 50+ 工具且不想本地架设：

1. 前往 [flopperam.com/account](https://flopperam.com/account) 获取 API Key
2. 安装 FlopAI Unreal 插件 — 参见 [flopperam.com/docs](https://flopperam.com/docs)

### 步骤 3 — 配置 MCP 连接

编辑 `mcp.json` 或 `.kiro/settings/mcp.json`：

**方式 1：本地 MCP（免费）**

```json
{
  "mcpServers": {
    "unreal-engine": {
      "command": "uv",
      "args": [
        "--directory",
        "C:/Users/<你的用户名>/Desktop/unreal-engine-mcp/Python",
        "run",
        "unreal_mcp_server_advanced.py"
      ]
    }
  }
}
```

> 将路径替换为你实际 clone 的位置。使用正斜杠 `/`。

**方式 2：Hosted Flop MCP（付费）**

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

### 步骤 4 — 安装自动引导 Hook（推荐）

```bash
mkdir -p .kiro/hooks
cp hooks/pre-unreal-tool.kiro.hook .kiro/hooks/
```

### 验证连接

在 Kiro 中输入任何 Unreal 相关命令（例如"列出当前关卡中的所有 Actor"）。如果 AI 正确回应，表示连接成功。

## 使用方法

用自然语言告诉 AI 你想做什么，它会自动选择并执行合适的 MCP 工具。

### 示例命令

```
"创建一个带 SpringArm 和 Camera 的角色 Blueprint"
"对 Environment 文件夹中的所有网格应用 Nanite"
"创建一个粗糙度 0.3 的 PBR 金属材质"
"检查项目的代码架构质量"
"我的项目兼容 iOS 吗？"
"分析 BP_MainCharacter 的依赖关系"
"执行性能审计工作流"
```

## 开发

```bash
npm install
npm test                 # 运行所有测试
npm run test:coverage    # 带覆盖率的测试
npm run lint             # ESLint 检查
npx tsc --noEmit        # TypeScript 类型检查
```

## 疑难排解

| 问题 | 解决方案 |
|------|----------|
| MCP 连接失败 | 确认 Unreal Editor 已打开且 MCP 插件已启用 |
| Blueprint 编译错误 | 使用 `listNodeTypes()` 验证节点类型名称 |
| 材质应用无效 | 使用 Blueprint SCS 方式（见 POWER.md 已知问题） |
| 测试失败 | 执行 `npm install` 后再 `npm test` |
| TypeScript 错误 | `npm install` 后执行 `npx tsc --noEmit` |

## 安全

详见 [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications)。

## 许可证

MIT License。详见 [LICENSE](LICENSE) 文件。
